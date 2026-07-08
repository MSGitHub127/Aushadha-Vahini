import math
import logging
import json
from config import PROJECT_ID, DATASET_ID
from forecaster import evaluate_forecasts
from gcp_clients import bq_client, genai, GEMINI_API_KEY

logger = logging.getLogger(__name__)

def haversine(lat1, lon1, lat2, lon2):
    """
    Computes the great-circle distance between two points on the Earth's surface
    in kilometers using the Haversine formula.
    """
    R = 6371.0  # Earth's radius in km
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0)**2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0)**2
    
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def get_phc_coordinates():
    """
    Retrieves latitude/longitude coordinates for all PHCs.
    """
    # Fetch from BigQuery if available
    try:
        if not bq_client:
            raise Exception("BigQuery client not initialized")
        sql = f"SELECT id, name, lat, lon FROM `{PROJECT_ID}.{DATASET_ID}.phcs`"
        query_job = bq_client.query(sql)
        df = query_job.to_dataframe()
        return {row["id"]: {"name": row["name"], "lat": row["lat"], "lon": row["lon"]} for _, row in df.iterrows()}
    except Exception as e:
        logger.warning(f"Could not fetch PHC coords from BQ: {e}. Falling back to default coordinates.")
        # Local mock coordinates for Adilabad district
        return {
            1: {"name": "PHC Utnoor", "lat": 19.3722, "lon": 78.7844},
            2: {"name": "PHC Indervelly", "lat": 19.4312, "lon": 78.6511},
            3: {"name": "PHC Narnoor", "lat": 19.4925, "lon": 78.8562},
            4: {"name": "PHC Ichoda", "lat": 19.4428, "lon": 78.4715},
            5: {"name": "PHC Bazarhatnoor", "lat": 19.4611, "lon": 78.3524},
        }

def generate_redistribution_plans():
    """
    Analyzes supply (surplus) and demand (deficit) profiles for medicines,
    and runs a distance-minimized greedy matching solver.
    """
    alerts = evaluate_forecasts()
    phc_coords = get_phc_coordinates()
    
    # Group items by medicine
    med_groups = {}
    for item in alerts:
        med_id = item["medicine_id"]
        if med_id not in med_groups:
            med_groups[med_id] = []
        med_groups[med_id].append(item)
        
    plans = []
    
    for med_id, items in med_groups.items():
        med_name = items[0]["medicine_name"]
        drug_class = items[0]["drug_class"]
        unit = items[0]["unit"]
        
        # Urgency multiplier based on drug class (10x for CRITICAL)
        urgency_multiplier = 10.0 if drug_class == "CRITICAL" else 1.0
        
        deficits = []
        surpluses = []
        
        for item in items:
            phc_id = item["phc_id"]
            curr_stock = item["current_stock"]
            avg_daily = item["avg_daily_forecast"]
            
            # Target healthy coverage: 12 days
            # Safe minimum coverage: 15 days (for surplus donors)
            target_stock = int(avg_daily * 12)
            safe_limit = int(avg_daily * 15)
            
            if item["status"] in ["STOCKOUT", "CRITICAL_DEFICIT", "WARNING_DEFICIT"]:
                qty_needed = max(1, target_stock - curr_stock)
                deficits.append({
                    "phc_id": phc_id,
                    "phc_name": item["phc_name"],
                    "needed": qty_needed,
                    "avg_daily": avg_daily
                })
            elif item["status"] == "SURPLUS":
                qty_available = max(0, curr_stock - safe_limit)
                if qty_available > 0:
                    surpluses.append({
                        "phc_id": phc_id,
                        "phc_name": item["phc_name"],
                        "available": qty_available,
                        "avg_daily": avg_daily
                    })
                    
        # Match deficits with nearest surpluses
        for def_node in deficits:
            target_id = def_node["phc_id"]
            needed = def_node["needed"]
            
            # Sort surpluses by distance to the target deficit node
            surplus_candidates = []
            for sur_node in surpluses:
                if sur_node["available"] <= 0:
                    continue
                
                # Calculate real distance
                lat1, lon1 = phc_coords[sur_node["phc_id"]]["lat"], phc_coords[sur_node["phc_id"]]["lon"]
                lat2, lon2 = phc_coords[target_id]["lat"], phc_coords[target_id]["lon"]
                dist = haversine(lat1, lon1, lat2, lon2)
                
                surplus_candidates.append((dist, sur_node))
                
            # Sort by distance ascending
            surplus_candidates.sort(key=lambda x: x[0])
            
            for dist, sur_node in surplus_candidates:
                if needed <= 0:
                    break
                    
                transfer_qty = min(needed, sur_node["available"])
                if transfer_qty <= 0:
                    continue
                    
                # Update records
                needed -= transfer_qty
                sur_node["available"] -= transfer_qty
                
                # Append optimization recommendation
                plans.append({
                    "source_phc_id": sur_node["phc_id"],
                    "source_phc_name": sur_node["phc_name"],
                    "target_phc_id": target_id,
                    "target_phc_name": def_node["phc_name"],
                    "medicine_id": med_id,
                    "medicine_name": med_name,
                    "unit": unit,
                    "quantity": int(transfer_qty),
                    "distance_km": round(dist, 2),
                    "urgency_score": round(urgency_multiplier * (10.0 / max(1.0, def_node["avg_daily"])), 2),
                    "impact_score": round(transfer_qty * urgency_multiplier, 1)
                })
                
    # Sort recommendations by impact score descending
    plans.sort(key=lambda x: x["impact_score"], reverse=True)
    
    # 2. Invoke Gemini Reasoning Layer for Rationale Synthesis
    if plans and GEMINI_API_KEY:
        try:
            model = genai.GenerativeModel("gemini-2.5-flash")
            
            prompt_data = []
            for p in plans:
                prompt_data.append({
                    "source_phc_name": p["source_phc_name"],
                    "target_phc_name": p["target_phc_name"],
                    "medicine_name": p["medicine_name"],
                    "quantity": p["quantity"],
                    "unit": p["unit"],
                    "distance_km": p["distance_km"],
                    "urgency": "CRITICAL" if p["urgency_score"] >= 5.0 else "ROUTINE"
                })
                
            prompt = f"""
            You are the Chief Medical Logistics Officer for Adilabad district, Telangana. 
            Analyze the following recommended medicine transfers:
            {json.dumps(prompt_data, indent=2)}
            
            For each transfer in the list, write a concise, professional plain-language justification (rationale) in English explaining why the transfer is necessary.
            Mention:
            - The name of the medicine and quantity.
            - That the source PHC has a surplus while the destination PHC has an urgent deficit.
            - The distance in kilometers between them.
            - The critical nature of the transfer if the urgency is CRITICAL.
            
            Return the output strictly as a JSON array of strings in the exact same order as the input transfers. 
            Example output format:
            [
              "Transferring 150 tablets of Paracetamol from PHC Indervelly to PHC Utnoor due to a critical shortage at Utnoor and surplus at Indervelly over a distance of 14 km.",
              "..."
            ]
            """
            
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            
            rationales = json.loads(response.text)
            if isinstance(rationales, list) and len(rationales) == len(plans):
                for idx, plan in enumerate(plans):
                    plan["hindi_rationale"] = rationales[idx]
            else:
                logger.warning("Gemini rationales count mismatch. Using fallback templates.")
                inject_fallback_rationales(plans)
        except Exception as e:
            logger.error(f"Gemini logistics reasoning failed: {e}. Using fallback templates.")
            inject_fallback_rationales(plans)
    else:
        inject_fallback_rationales(plans)
        
    return plans
 
def inject_fallback_rationales(plans):
    for plan in plans:
        is_critical = plan["urgency_score"] >= 5.0
        urgency_text = "CRITICAL" if is_critical else "standard"
        plan["hindi_rationale"] = (
            f"Transferring {plan['quantity']} {plan['unit']} of {plan['medicine_name']} from PHC {plan['source_phc_name']} (surplus) "
            f"to PHC {plan['target_phc_name']} (deficit) over {plan['distance_km']} km to resolve a {urgency_text} shortage."
        )
