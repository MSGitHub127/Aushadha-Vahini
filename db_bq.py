import datetime
import random
import time
from google.cloud import bigquery
from google.api_core.exceptions import Conflict
from config import PROJECT_ID, DATASET_ID, LOCATION

def get_client():
    return bigquery.Client(project=PROJECT_ID)

def insert_rows_with_retry(client, table_id, rows):
    import time
    for attempt in range(15):
        try:
            errors = client.insert_rows_json(table_id, rows)
            if errors:
                raise Exception(f"Insert errors: {errors}")
            return
        except Exception as e:
            if "not found" in str(e).lower() and attempt < 14:
                print(f"Table {table_id} not found yet. Sleeping 4s and retrying (attempt {attempt+1}/15)...")
                time.sleep(4)
            else:
                raise e

def create_tables():
    client = get_client()
    
    # Create dataset if it doesn't exist
    dataset_ref = bigquery.DatasetReference(PROJECT_ID, DATASET_ID)
    dataset = bigquery.Dataset(dataset_ref)
    dataset.location = LOCATION
    try:
        client.create_dataset(dataset, exists_ok=True)
        print(f"Dataset {DATASET_ID} verified/created.")
    except Exception as e:
        print(f"Error creating dataset: {e}")
        return

    # Define table schemas
    schemas = {
        "phcs": [
            bigquery.SchemaField("id", "INT64", mode="REQUIRED"),
            bigquery.SchemaField("name", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("sub_district", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("lat", "FLOAT64", mode="REQUIRED"),
            bigquery.SchemaField("lon", "FLOAT64", mode="REQUIRED"),
        ],
        "medicines": [
            bigquery.SchemaField("id", "INT64", mode="REQUIRED"),
            bigquery.SchemaField("name", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("unit", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("drug_class", "STRING", mode="REQUIRED"),
        ],
        "inventory": [
            bigquery.SchemaField("phc_id", "INT64", mode="REQUIRED"),
            bigquery.SchemaField("medicine_id", "INT64", mode="REQUIRED"),
            bigquery.SchemaField("current_stock", "INT64", mode="REQUIRED"),
            bigquery.SchemaField("safety_threshold", "INT64", mode="REQUIRED"),
            bigquery.SchemaField("last_updated", "TIMESTAMP", mode="REQUIRED"),
        ],
        "consumption_history": [
            bigquery.SchemaField("phc_id", "INT64", mode="REQUIRED"),
            bigquery.SchemaField("medicine_id", "INT64", mode="REQUIRED"),
            bigquery.SchemaField("date", "DATE", mode="REQUIRED"),
            bigquery.SchemaField("quantity_consumed", "INT64", mode="REQUIRED"),
        ],
        "transfers": [
            bigquery.SchemaField("id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("source_phc_id", "INT64", mode="REQUIRED"),
            bigquery.SchemaField("target_phc_id", "INT64", mode="REQUIRED"),
            bigquery.SchemaField("medicine_id", "INT64", mode="REQUIRED"),
            bigquery.SchemaField("quantity", "INT64", mode="REQUIRED"),
            bigquery.SchemaField("status", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="REQUIRED"),
        ],
        "inventory_review_queue": [
            bigquery.SchemaField("id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("phc_id", "INT64", mode="REQUIRED"),
            bigquery.SchemaField("medicine_id", "INT64", mode="REQUIRED"),
            bigquery.SchemaField("quantity", "INT64", mode="REQUIRED"),
            bigquery.SchemaField("confidence_score", "FLOAT64", mode="REQUIRED"),
            bigquery.SchemaField("image_url", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("created_at", "TIMESTAMP", mode="REQUIRED"),
        ]
    }

    for table_name, schema in schemas.items():
        table_ref = bigquery.TableReference(dataset_ref, table_name)
        
        # WIPE/DROP Table to bypass streaming buffer locks on multiple runs
        if table_name in ["phcs", "medicines", "inventory", "consumption_history", "transfers"]:
            try:
                client.delete_table(table_ref, not_found_ok=True)
                print(f"Dropped table {table_name} for reset.")
            except Exception as e:
                print(f"Error dropping table {table_name}: {e}")
                
        table = bigquery.Table(table_ref, schema=schema)
        try:
            client.create_table(table, exists_ok=True)
            print(f"Table {table_name} verified/created.")
        except Exception as e:
            print(f"Error creating table {table_name}: {e}")

def seed_data():
    client = get_client()
    
    # 1. Seed PHCs (Adilabad district, Telangana, India)
    phc_data = [
        {"id": 1, "name": "PHC Utnoor", "sub_district": "Utnoor", "lat": 19.3722, "lon": 78.7844},
        {"id": 2, "name": "PHC Indervelly", "sub_district": "Indervelly", "lat": 19.4312, "lon": 78.6511},
        {"id": 3, "name": "PHC Narnoor", "sub_district": "Narnoor", "lat": 19.4925, "lon": 78.8562},
        {"id": 4, "name": "PHC Ichoda", "sub_district": "Ichoda", "lat": 19.4428, "lon": 78.4715},
        {"id": 5, "name": "PHC Bazarhatnoor", "sub_district": "Bazarhatnoor", "lat": 19.4611, "lon": 78.3524},
    ]
    phc_table = f"{PROJECT_ID}.{DATASET_ID}.phcs"
    insert_rows_with_retry(client, phc_table, phc_data)
    print("PHCs table seeded.")
 
    # 2. Seed Medicines
    medicine_data = [
        {"id": 1, "name": "Amoxicillin", "unit": "Tablets", "drug_class": "ROUTINE"},
        {"id": 2, "name": "Paracetamol", "unit": "Tablets", "drug_class": "ROUTINE"},
        {"id": 3, "name": "Insulin Glargine", "unit": "Vials", "drug_class": "CRITICAL"},
        {"id": 4, "name": "Oxytocin Injection", "unit": "Ampoules", "drug_class": "CRITICAL"},
        {"id": 5, "name": "Metformin", "unit": "Tablets", "drug_class": "ROUTINE"},
        {"id": 6, "name": "ORS Sachet", "unit": "Packets", "drug_class": "ROUTINE"},
        {"id": 7, "name": "Cetirizine", "unit": "Tablets", "drug_class": "ROUTINE"},
        {"id": 8, "name": "Ibuprofen", "unit": "Tablets", "drug_class": "ROUTINE"},
        {"id": 9, "name": "Omeprazole", "unit": "Capsules", "drug_class": "ROUTINE"},
        {"id": 10, "name": "Azithromycin", "unit": "Tablets", "drug_class": "ROUTINE"},
        {"id": 11, "name": "Montelukast", "unit": "Tablets", "drug_class": "ROUTINE"},
        {"id": 12, "name": "Vitamin D3", "unit": "Capsules", "drug_class": "ROUTINE"},
        {"id": 13, "name": "B-Complex", "unit": "Tablets", "drug_class": "ROUTINE"},
        {"id": 14, "name": "Zinc Sulphate", "unit": "Tablets", "drug_class": "ROUTINE"},
    ]
    medicine_table = f"{PROJECT_ID}.{DATASET_ID}.medicines"
    insert_rows_with_retry(client, medicine_table, medicine_data)
    print("Medicines table seeded.")

    # 3. Seed Consumption History (90 Days)
    end_date = datetime.date.today()
    start_date = end_date - datetime.timedelta(days=90)
    
    consumption_rows = []
    
    # Generate daily consumption with trends and seasonal noise
    for phc in phc_data:
        for med in medicine_data:
            # Base parameters
            if med["drug_class"] == "CRITICAL":
                base_daily = random.randint(3, 10)
            else:
                base_daily = random.randint(15, 45)
                
            # Create a slight upward consumption trend in some PHCs
            trend_factor = 0.05 if phc["id"] in [1, 3] else -0.02
            
            curr_date = start_date
            while curr_date <= end_date:
                # Add day-of-week effect (Mondays are busy, Sundays are slow)
                day_effect = 1.3 if curr_date.weekday() == 0 else (0.4 if curr_date.weekday() == 6 else 1.0)
                # Random fluctuation
                noise = random.uniform(0.8, 1.2)
                # Trend calculation
                days_since_start = (curr_date - start_date).days
                trend = 1.0 + (trend_factor * (days_since_start / 90.0))
                
                qty = int(base_daily * day_effect * noise * trend)
                
                # Scripted seasonal anomaly: Dengue outbreak spike at PHC Narnoor (ID 3) for Paracetamol (ID 2)
                anomaly_date = end_date - datetime.timedelta(days=14)
                if phc["id"] == 3 and med["id"] == 2 and curr_date == anomaly_date:
                    qty = int(base_daily * 8.5)  # 8.5x increase spike
                    
                qty = max(0, qty)
                
                consumption_rows.append({
                    "phc_id": phc["id"],
                    "medicine_id": med["id"],
                    "date": curr_date.strftime("%Y-%m-%d"),
                    "quantity_consumed": qty
                })
                
                curr_date += datetime.timedelta(days=1)

    # Batch insert to avoid size limits
    chunk_size = 1000
    consumption_table = f"{PROJECT_ID}.{DATASET_ID}.consumption_history"
    for i in range(0, len(consumption_rows), chunk_size):
        chunk = consumption_rows[i:i+chunk_size]
        insert_rows_with_retry(client, consumption_table, chunk)
    print(f"Consumption history table seeded with {len(consumption_rows)} entries.")

    # 4. Seed Current Inventory
    # Generate state: Some clinics have stockouts or deficits, others have surpluses
    inventory_rows = []
    now_str = datetime.datetime.utcnow().isoformat() + "Z"
    
    for phc in phc_data:
        for med in medicine_data:
            # Determine daily average consumption for thresholds
            historical_phc_med = [r for r in consumption_rows if r["phc_id"] == phc["id"] and r["medicine_id"] == med["id"]]
            avg_daily = sum(r["quantity_consumed"] for r in historical_phc_med) / len(historical_phc_med)
            
            # Set safety threshold (e.g. 5 days of coverage)
            safety = int(avg_daily * 5)
            
            # Create distribution state
            # PHC 1 and 3 are in severe deficit for Critical items
            # PHC 2 and 5 are in surplus for Critical items
            if phc["id"] in [1, 3] and med["drug_class"] == "CRITICAL":
                stock = random.randint(0, safety)  # Deficit/Critical Warning
            elif phc["id"] in [2, 5] and med["drug_class"] == "CRITICAL":
                stock = int(avg_daily * 30)  # Major surplus (~30 days)
            else:
                stock = int(avg_daily * random.uniform(8, 22))  # Moderate range (8-22 days)
                
            inventory_rows.append({
                "phc_id": phc["id"],
                "medicine_id": med["id"],
                "current_stock": stock,
                "safety_threshold": safety,
                "last_updated": now_str
            })
            
    inventory_table = f"{PROJECT_ID}.{DATASET_ID}.inventory"
    insert_rows_with_retry(client, inventory_table, inventory_rows)
    print("Current inventory table seeded.")

def build_forecast_model():
    client = get_client()
    model_name = f"`{PROJECT_ID}.{DATASET_ID}.forecast_model`"
    history_table = f"`{PROJECT_ID}.{DATASET_ID}.consumption_history`"
    
    sql = f"""
    CREATE OR REPLACE MODEL {model_name}
    OPTIONS(
      model_type='ARIMA_PLUS',
      time_series_timestamp_col='date',
      time_series_data_col='quantity_consumed',
      time_series_id_col=['phc_id', 'medicine_id'],
      auto_arima=TRUE,
      data_frequency='DAILY'
    ) AS
    SELECT CAST(date AS TIMESTAMP) as date, phc_id, medicine_id, quantity_consumed
    FROM {history_table}
    """
    
    print("Training BQML ARIMA_PLUS forecasting model (this can take 30-60 seconds)...")
    start = time.time()
    query_job = client.query(sql)
    query_job.result()  # Wait for training to complete
    end = time.time()
    print(f"Model trained and saved successfully in {end - start:.2f} seconds.")

if __name__ == "__main__":
    import sys
    print("Initializing BigQuery schema...")
    create_tables()
    import time
    time.sleep(5)
    
    print("Seeding mock telemetry...")
    try:
        seed_data()
    except Exception as e:
        print(f"Error seeding data: {e}. (Tables might already contain data)")
        
    print("Building forecasting model...")
    try:
        build_forecast_model()
    except Exception as e:
        print(f"Error building model: {e}")
        
    print("Database initialization complete.")
