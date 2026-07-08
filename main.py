import os
import uuid
import logging
import datetime
import csv
import io
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import bigquery

# Import local modules
import config
from config import PROJECT_ID, DATASET_ID
import ocr_digitizer
import forecaster
import optimizer
import tts_engine
from gcp_clients import bq_client

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Aushadha Vahini PHC Dashboard API", version="1.0.0")

# Enable CORS for local development flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload directory exists
UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs("static/audio", exist_ok=True)

# ----------------------------------------------------
# LOCAL MOCK STATE DATABASE (Survival mode fallback)
# ----------------------------------------------------
# Maintains local state when BigQuery client is disconnected
mock_inventory = {}
mock_review_queue = {}
mock_transfers = []

def init_mock_state():
    """Seeds the local mock state if BigQuery fails."""
    global mock_inventory
    alerts = forecaster.get_mock_forecast_alerts()
    for item in alerts:
        phc_id = item["phc_id"]
        med_id = item["medicine_id"]
        if phc_id not in mock_inventory:
            mock_inventory[phc_id] = {}
        mock_inventory[phc_id][med_id] = {
            "phc_name": item["phc_name"],
            "medicine_name": item["medicine_name"],
            "drug_class": item["drug_class"],
            "unit": item["unit"],
            "current_stock": item["current_stock"],
            "safety_threshold": item["safety_threshold"],
            "avg_daily_forecast": item["avg_daily_forecast"],
            "days_of_coverage": item["days_of_coverage"],
            "status": item["status"]
        }

init_mock_state()

def get_bq_client():
    return bq_client

# ----------------------------------------------------
# API ENDPOINTS
# ----------------------------------------------------

@app.get("/")
def read_root():
    return FileResponse("static/index.html")

@app.get("/api/inventory")
def get_inventory():
    """
    Returns current inventory levels for all PHCs.
    """
    client = get_bq_client()
    if not client:
        # Return local mock inventory state
        flat_inventory = []
        for phc_id, meds in mock_inventory.items():
            for med_id, data in meds.items():
                flat_inventory.append({"phc_id": phc_id, "medicine_id": med_id, **data})
        return flat_inventory

    try:
        sql = f"""
        SELECT 
          i.phc_id, p.name as phc_name, i.medicine_id, m.name as medicine_name, 
          m.drug_class, m.unit, i.current_stock, i.safety_threshold, i.last_updated
        FROM `{PROJECT_ID}.{DATASET_ID}.inventory` i
        JOIN `{PROJECT_ID}.{DATASET_ID}.phcs` p ON i.phc_id = p.id
        JOIN `{PROJECT_ID}.{DATASET_ID}.medicines` m ON i.medicine_id = m.id
        ORDER BY phc_id, medicine_id
        """
        query_job = client.query(sql)
        df = query_job.to_dataframe()
        return df.to_dict(orient="records")
    except Exception as e:
        logger.error(f"BQ inventory fetch failed: {e}. Returning mock state.")
        flat_inventory = []
        for phc_id, meds in mock_inventory.items():
            for med_id, data in meds.items():
                flat_inventory.append({"phc_id": phc_id, "medicine_id": med_id, **data})
        return flat_inventory

@app.get("/api/alerts")
def get_alerts():
    """
    Evaluates forecasts and returns warning alerts.
    """
    # Note: evaluate_forecasts handles its own GCP check and fallback
    alerts = forecaster.evaluate_forecasts()
    
    # Sync with local mock inventory state if running in fallback mode
    if not get_bq_client():
        for item in alerts:
            phc_id = item["phc_id"]
            med_id = item["medicine_id"]
            if phc_id in mock_inventory and med_id in mock_inventory[phc_id]:
                # Dynamic update based on mock inventory changes
                stock = mock_inventory[phc_id][med_id]["current_stock"]
                avg = mock_inventory[phc_id][med_id]["avg_daily_forecast"]
                doc = stock / avg if avg > 0 else 999.0
                
                status = "OPTIMAL"
                if doc <= 0.0:
                    status = "STOCKOUT"
                elif doc <= 5.0:
                    status = "CRITICAL_DEFICIT"
                elif doc <= 10.0:
                    status = "WARNING_DEFICIT"
                elif doc >= 25.0:
                    status = "SURPLUS"
                    
                mock_inventory[phc_id][med_id]["current_stock"] = stock
                mock_inventory[phc_id][med_id]["days_of_coverage"] = round(doc, 1)
                mock_inventory[phc_id][med_id]["status"] = status
                
                item["current_stock"] = stock
                item["days_of_coverage"] = round(doc, 1)
                item["status"] = status
    return alerts

@app.post("/api/upload-log")
async def upload_log(image: UploadFile = File(...), phc_id: int = Form(...)):
    """
    Receives an inventory log image, triggers Gemini OCR, 
    and routes it based on the confidence score (Direct vs Review Queue).
    """
    # Save the file locally
    filename = f"{uuid.uuid4()}_{image.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as buffer:
        buffer.write(await image.read())
        
    logger.info(f"File uploaded to {file_path} for PHC {phc_id}")
    
    # Run Gemini Multimodal Vision API OCR
    ocr_result = ocr_digitizer.digitize_inventory_sheet(file_path)
    confidence = ocr_result.get("confidence_score", 0.0)
    items = ocr_result.get("items", [])
    
    client = get_bq_client()
    batch_id = str(uuid.uuid4())
    image_url = f"/static/uploads/{filename}"
    
    # Check confidence threshold (0.85)
    if confidence >= 0.85:
        # Route 1: High Confidence -> Write directly to inventory database
        logger.info(f"High confidence OCR ({confidence}). Updating inventory directly.")
        if client:
            try:
                now_str = datetime.datetime.utcnow().isoformat() + "Z"
                for item in items:
                    # Update stock in BigQuery. Enforce exact match on medicine name
                    sql = f"""
                    UPDATE `{PROJECT_ID}.{DATASET_ID}.inventory`
                    SET current_stock = {item['quantity']}, last_updated = '{now_str}'
                    WHERE phc_id = {phc_id} AND medicine_id = (
                      SELECT id FROM `{PROJECT_ID}.{DATASET_ID}.medicines` WHERE LOWER(name) = LOWER('{item['medicine_name']}') LIMIT 1
                    )
                    """
                    client.query(sql).result()
            except Exception as e:
                logger.error(f"BQ inventory update failed: {e}. Writing to mock state.")
                update_local_mock_inventory(phc_id, items)
        else:
            update_local_mock_inventory(phc_id, items)
            
        return {
            "status": "APPROVED",
            "confidence_score": confidence,
            "items": items,
            "image_url": image_url,
            "review_required": False
        }
    else:
        # Route 2: Low Confidence -> Route to the verification review queue
        logger.info(f"Low confidence OCR ({confidence}). Routing to review queue.")
        if client:
            try:
                queue_rows = []
                now_str = datetime.datetime.utcnow().isoformat() + "Z"
                for item in items:
                    # Get medicine ID matching the name
                    sql = f"SELECT id FROM `{PROJECT_ID}.{DATASET_ID}.medicines` WHERE LOWER(name) = LOWER('{item['medicine_name']}') LIMIT 1"
                    query_job = client.query(sql)
                    med_df = query_job.to_dataframe()
                    med_id = int(med_df.iloc[0]["id"]) if not med_df.empty else 1 # Fallback to paracetamol
                    
                    # Encode original medicine name inside image_url query param
                    import urllib.parse
                    encoded_name = urllib.parse.quote(item['medicine_name'])
                    row_image_url = f"{image_url}?ocr_name={encoded_name}"
                    
                    queue_rows.append({
                        "id": batch_id,
                        "phc_id": phc_id,
                        "medicine_id": med_id,
                        "quantity": item["quantity"],
                        "confidence_score": confidence,
                        "image_url": row_image_url,
                        "created_at": now_str
                    })
                
                queue_table = f"{PROJECT_ID}.{DATASET_ID}.inventory_review_queue"
                client.insert_rows_json(queue_table, queue_rows)
            except Exception as e:
                logger.error(f"BQ review queue write failed: {e}. Writing to mock review queue.")
                write_local_mock_review_queue(batch_id, phc_id, items, confidence, image_url)
        else:
            write_local_mock_review_queue(batch_id, phc_id, items, confidence, image_url)
            
        return {
            "status": "REVIEW_REQUIRED",
            "batch_id": batch_id,
            "confidence_score": confidence,
            "items": items,
            "image_url": image_url,
            "review_required": True
        }

@app.get("/api/review-queue")
def get_review_queue():
    """
    Returns items pending in the review queue.
    """
    client = get_bq_client()
    if not client:
        return list(mock_review_queue.values())

    try:
        sql = f"""
        SELECT 
          rq.id as batch_id, rq.phc_id, p.name as phc_name, rq.medicine_id, 
          m.name as medicine_name, rq.quantity, rq.confidence_score, rq.image_url, rq.created_at
        FROM `{PROJECT_ID}.{DATASET_ID}.inventory_review_queue` rq
        JOIN `{PROJECT_ID}.{DATASET_ID}.phcs` p ON rq.phc_id = p.id
        JOIN `{PROJECT_ID}.{DATASET_ID}.medicines` m ON rq.medicine_id = m.id
        ORDER BY rq.created_at DESC
        """
        query_job = client.query(sql)
        df = query_job.to_dataframe()
        
        # Group by batch_id
        grouped = {}
        for _, row in df.iterrows():
            bid = row["batch_id"]
            
            img_url = str(row["image_url"])
            
            # Parse out original predicted name from image_url if present
            ocr_name = str(row["medicine_name"])
            base_img_url = img_url
            if img_url and "?ocr_name=" in img_url:
                parts = img_url.split("?ocr_name=", 1)
                base_img_url = parts[0]
                import urllib.parse
                ocr_name = urllib.parse.unquote(parts[1])
                
            # Safeguard: Skip any old records pointing to 16-byte corrupted/mock dummy images
            if base_img_url:
                local_path = base_img_url.lstrip("/")
                if os.path.exists(local_path) and os.path.getsize(local_path) <= 16:
                    continue
            
            if bid not in grouped:
                grouped[bid] = {
                    "batch_id": bid,
                    "phc_id": int(row["phc_id"]),
                    "phc_name": str(row["phc_name"]),
                    "confidence_score": float(row["confidence_score"]),
                    "image_url": base_img_url,
                    "created_at": str(row["created_at"]),
                    "items": []
                }
            grouped[bid]["items"].append({
                "medicine_id": int(row["medicine_id"]),
                "medicine_name": ocr_name,
                "quantity": int(row["quantity"])
            })
        return list(grouped.values())
    except Exception as e:
        logger.error(f"BQ review queue fetch failed: {e}. Returning mock state.")
        return list(mock_review_queue.values())

@app.post("/api/review-queue/approve")
def approve_review_item(payload: dict):
    """
    Approves a review batch after manual verification, 
    committing changes to the active inventory table.
    """
    batch_id = payload.get("batch_id")
    phc_id = payload.get("phc_id")
    items = payload.get("items", []) # Array of {"medicine_id": id, "quantity": qty}
    
    client = get_bq_client()
    if client:
        try:
            now_str = datetime.datetime.utcnow().isoformat() + "Z"
            # 1. Update inventory
            for item in items:
                safe_name = item.get("medicine_name", "").replace("'", "''").strip()
                # Resolve medicine ID by name matching
                sql = f"SELECT id FROM `{PROJECT_ID}.{DATASET_ID}.medicines` WHERE LOWER(name) = LOWER('{safe_name}') LIMIT 1"
                query_job = client.query(sql)
                med_df = query_job.to_dataframe()
                
                if not med_df.empty:
                    med_id = int(med_df.iloc[0]["id"])
                else:
                    # Dynamically register new medicine
                    max_job = client.query(f"SELECT MAX(id) as max_id FROM `{PROJECT_ID}.{DATASET_ID}.medicines`")
                    max_df = max_job.to_dataframe()
                    next_id = int(max_df.iloc[0]["max_id"]) + 1 if not max_df.empty and max_df.iloc[0]["max_id"] is not None else 15
                    
                    insert_med_sql = f"INSERT INTO `{PROJECT_ID}.{DATASET_ID}.medicines` (id, name, unit, drug_class) VALUES ({next_id}, '{safe_name}', 'Tablets', 'ROUTINE')"
                    client.query(insert_med_sql).result()
                    
                    # Seed inventory for this new medicine across all clinics
                    for p_id in range(1, 6):
                        insert_inv_sql = f"INSERT INTO `{PROJECT_ID}.{DATASET_ID}.inventory` (phc_id, medicine_id, current_stock, safety_threshold, last_updated) VALUES ({p_id}, {next_id}, 0, 20, '{now_str}')"
                        client.query(insert_inv_sql).result()
                    
                    med_id = next_id
                    logger.info(f"Dynamically registered '{safe_name}' (ID: {med_id}) in BigQuery.")
                
                update_sql = f"""
                UPDATE `{PROJECT_ID}.{DATASET_ID}.inventory`
                SET current_stock = {item['quantity']}, last_updated = '{now_str}'
                WHERE phc_id = {phc_id} AND medicine_id = {med_id}
                """
                client.query(update_sql).result()
                
            # 2. Delete from review queue
            del_sql = f"DELETE FROM `{PROJECT_ID}.{DATASET_ID}.inventory_review_queue` WHERE id = '{batch_id}'"
            client.query(del_sql).result()
            logger.info(f"Review batch {batch_id} approved and cleared from BigQuery.")
        except Exception as e:
            logger.error(f"BQ review approval query failed: {e}. Approving via mock state.")
            approve_mock_review_item(batch_id, phc_id, items)
    else:
        approve_mock_review_item(batch_id, phc_id, items)
        
    return {"status": "APPROVED", "batch_id": batch_id}

@app.post("/api/optimize")
def run_optimization(lang: str = "en"):
    """
    Calculates redistribution plans and triggers SSML speech synthesis.
    """
    # 1. Generate routing plans
    # Note: optimizer automatically delegates BQ-to-mock fallbacks
    plans = optimizer.generate_redistribution_plans()
    
    # Log recommended transfers to DB
    client = get_bq_client()
    if client:
        try:
            transfer_rows = []
            now_str = datetime.datetime.utcnow().isoformat() + "Z"
            for plan in plans:
                transfer_rows.append({
                    "id": str(uuid.uuid4()),
                    "source_phc_id": plan["source_phc_id"],
                    "target_phc_id": plan["target_phc_id"],
                    "medicine_id": plan["medicine_id"],
                    "quantity": plan["quantity"],
                    "status": "RECOMMENDED",
                    "created_at": now_str
                })
            if transfer_rows:
                table_ref = f"{PROJECT_ID}.{DATASET_ID}.transfers"
                client.insert_rows_json(table_ref, transfer_rows)
        except Exception as e:
            logger.error(f"Failed logging transfers to BigQuery: {e}")
            
    # 2. Synthesize TTS audio instructions (Hindi or English based on lang preference)
    logger.info(f"OPTIMIZATION ENDPOINT CALLED. Lang: {lang}")
    tts_response = tts_engine.synthesize_advisory_voice(plans, lang=lang)
    logger.info(f"TTS Synthesis complete. Response: {tts_response}")
    
    return {
        "plans": plans,
        "tts": tts_response
    }

# ----------------------------------------------------
# MOCK SYNC UTILITIES
# ----------------------------------------------------

def update_local_mock_inventory(phc_id, items):
    global mock_inventory
    if phc_id not in mock_inventory:
        mock_inventory[phc_id] = {}
    for item in items:
        # Match by name in local inventory
        name = item["medicine_name"]
        matched_med_id = None
        for med_id, m_data in mock_inventory[phc_id].items():
            if m_data["medicine_name"].lower() == name.lower():
                matched_med_id = med_id
                break
                
        if matched_med_id:
            mock_inventory[phc_id][matched_med_id]["current_stock"] = item["quantity"]
            logger.info(f"Mock Inventory updated: PHC {phc_id}, Med {matched_med_id} = {item['quantity']}")

def write_local_mock_review_queue(batch_id, phc_id, items, confidence, image_url):
    global mock_review_queue
    # Fetch PHC name
    phc_name = mock_inventory.get(phc_id, {}).get(1, {}).get("phc_name", f"PHC-{phc_id}")
    
    flat_items = []
    for item in items:
        name = item["medicine_name"]
        # Find matched medicine ID
        med_id = 1
        for m_id, m_data in mock_inventory.get(phc_id, {}).items():
            if m_data["medicine_name"].lower() == name.lower():
                med_id = m_id
                break
        flat_items.append({
            "medicine_id": med_id,
            "medicine_name": name,
            "quantity": item["quantity"]
        })
        
    mock_review_queue[batch_id] = {
        "batch_id": batch_id,
        "phc_id": phc_id,
        "phc_name": phc_name,
        "confidence_score": confidence,
        "image_url": image_url,
        "created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "items": flat_items
    }

def approve_mock_review_item(batch_id, phc_id, items):
    global mock_review_queue, mock_inventory
    # Update mock inventory
    if phc_id in mock_inventory:
        for item in items:
            med_name = item.get("medicine_name", "").strip()
            qty = item["quantity"]
            
            # Find matching medicine by name (case-insensitive)
            found_med_id = None
            for m_id, m_data in mock_inventory[phc_id].items():
                if m_data["medicine_name"].lower() == med_name.lower():
                    found_med_id = m_id
                    break
            
            if found_med_id is not None:
                mock_inventory[phc_id][found_med_id]["current_stock"] = qty
                logger.info(f"Mock Inventory updated via Review Approval: PHC {phc_id}, Med {found_med_id} = {qty}")
            else:
                # Add new mock medicine dynamically
                next_id = max(mock_inventory[phc_id].keys()) + 1 if mock_inventory[phc_id] else 15
                for p_id in mock_inventory.keys():
                    mock_inventory[p_id][next_id] = {
                        "phc_name": mock_inventory[p_id].get(1, {}).get("phc_name", f"PHC-{p_id}"),
                        "medicine_name": med_name,
                        "drug_class": "ROUTINE",
                        "unit": "Tablets",
                        "current_stock": 0 if p_id != phc_id else qty,
                        "safety_threshold": 20,
                        "avg_daily_forecast": 10,
                        "days_of_coverage": 10,
                        "status": "MODERATE"
                    }
                logger.info(f"Mock Inventory dynamically created and updated new medicine '{med_name}' (ID: {next_id}) = {qty}")
                
    # Remove from mock review queue
    if batch_id in mock_review_queue:
        del mock_review_queue[batch_id]

@app.get("/api/status")
def get_status():
    from gcp_clients import bq_client, tts_client, GEMINI_API_KEY
    bq_ok = bq_client is not None
    gemini_ok = GEMINI_API_KEY is not None
    tts_ok = tts_client is not None
    
    return {
        "bigquery": "CONNECTED" if bq_ok else "MOCK_FALLBACK",
        "gemini": "CONNECTED" if gemini_ok else "MOCK_FALLBACK",
        "tts": "CONNECTED" if tts_ok else "MOCK_FALLBACK",
        "mode": "GCP_LIVE_MODE" if (bq_ok and gemini_ok) else "OFFLINE_DEMO_MODE"
    }

@app.get("/api/reports/nhm")
def get_nhm_report():
    """
    Generates and downloads the National Health Mission compliance report.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(["Primary Health Center", "Medicine Name", "Current Stock", "Safety Threshold", "Deficit Quantity", "Status"])
    
    client = get_bq_client()
    if client:
        try:
            sql = f"""
            SELECT 
              p.name as phc_name, m.name as medicine_name, i.current_stock, i.safety_threshold
            FROM `{PROJECT_ID}.{DATASET_ID}.inventory` i
            JOIN `{PROJECT_ID}.{DATASET_ID}.phcs` p ON i.phc_id = p.id
            JOIN `{PROJECT_ID}.{DATASET_ID}.medicines` m ON i.medicine_id = m.id
            ORDER BY p.name, m.name
            """
            df = client.query(sql).to_dataframe()
            for _, row in df.iterrows():
                stock = int(row["current_stock"])
                safety = int(row["safety_threshold"])
                deficit = max(0, safety - stock)
                status = "DEFICIT" if stock < safety else "SAFE"
                writer.writerow([row["phc_name"], row["medicine_name"], stock, safety, deficit, status])
        except Exception as e:
            logger.error(f"Failed to query NHM Report from BQ: {e}")
            generate_mock_nhm_rows(writer)
    else:
        generate_mock_nhm_rows(writer)
        
    response_stream = io.BytesIO(output.getvalue().encode("utf-8"))
    return StreamingResponse(
        response_stream,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=NHM_Inventory_Compliance_Report.csv"}
    )

def generate_mock_nhm_rows(writer):
    for phc_id, meds in mock_inventory.items():
        for med_id, data in meds.items():
            stock = data["current_stock"]
            safety = data["safety_threshold"]
            deficit = max(0, safety - stock)
            status = "DEFICIT" if stock < safety else "SAFE"
            writer.writerow([data["phc_name"], data["medicine_name"], stock, safety, deficit, status])


@app.get("/api/reports/transfers")
def get_transfers_report():
    """
    Generates and downloads the Logistics Transfer Ledger.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(["Transfer ID", "Source Clinic", "Target Clinic", "Medicine Name", "Quantity Transferred", "Status", "Timestamp"])
    
    client = get_bq_client()
    if client:
        try:
            sql = f"""
            SELECT 
              t.id, p1.name as source_phc, p2.name as target_phc, m.name as medicine_name, t.quantity, t.status, t.created_at
            FROM `{PROJECT_ID}.{DATASET_ID}.transfers` t
            JOIN `{PROJECT_ID}.{DATASET_ID}.phcs` p1 ON t.source_phc_id = p1.id
            JOIN `{PROJECT_ID}.{DATASET_ID}.phcs` p2 ON t.target_phc_id = p2.id
            JOIN `{PROJECT_ID}.{DATASET_ID}.medicines` m ON t.medicine_id = m.id
            ORDER BY t.created_at DESC
            """
            df = client.query(sql).to_dataframe()
            for _, row in df.iterrows():
                writer.writerow([
                    row["id"], row["source_phc"], row["target_phc"],
                    row["medicine_name"], row["quantity"], row["status"], row["created_at"]
                ])
        except Exception as e:
            logger.error(f"Failed to query Transfer Ledger from BQ: {e}")
            generate_mock_transfer_rows(writer)
    else:
        generate_mock_transfer_rows(writer)
        
    response_stream = io.BytesIO(output.getvalue().encode("utf-8"))
    return StreamingResponse(
        response_stream,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=Logistics_Transfer_Ledger.csv"}
    )

def generate_mock_transfer_rows(writer):
    if not mock_transfers:
        import datetime
        mock_transfers.append({
            "id": "mock-t1-9c8b",
            "source_phc": "PHC Bazarhatnoor",
            "target_phc": "PHC Utnoor",
            "medicine_name": "Paracetamol",
            "quantity": 180,
            "status": "COMPLETED",
            "created_at": (datetime.datetime.now() - datetime.timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S")
        })
        mock_transfers.append({
            "id": "mock-t2-ef21",
            "source_phc": "PHC Indervelly",
            "target_phc": "PHC Narnoor",
            "medicine_name": "Amoxicillin",
            "quantity": 90,
            "status": "COMPLETED",
            "created_at": (datetime.datetime.now() - datetime.timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")
        })
    for t in mock_transfers:
        writer.writerow([
            t.get("id"),
            t.get("source_phc"),
            t.get("target_phc"),
            t.get("medicine_name"),
            t.get("quantity"),
            t.get("status"),
            t.get("created_at")
        ])


# Mount static files (must be registered last)
app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
