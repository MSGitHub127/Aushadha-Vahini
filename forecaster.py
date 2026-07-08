import logging
from google.cloud import bigquery
from config import PROJECT_ID, DATASET_ID

logger = logging.getLogger(__name__)

from gcp_clients import bq_client

def get_bq_client():
    return bq_client

def evaluate_forecasts():
    """
    Queries BigQuery ML.FORECAST to retrieve forecasted consumption for the next 15 days,
    combines it with current inventory levels, and identifies stockout alert conditions.
    """
    client = get_bq_client()
    
    if not client:
        return get_mock_forecast_alerts()

    # BQ SQL Query joining current inventory, medicines classification, and BQML ARIMA forecast
    sql = f"""
    WITH forecast_summary AS (
      SELECT 
        phc_id, 
        medicine_id, 
        -- Sum the positive forecasts over the 15-day horizon to get total expected demand
        SUM(GREATEST(forecast_value, 0)) as total_forecasted_demand_15d,
        -- Get average daily forecast demand
        AVG(GREATEST(forecast_value, 0)) as avg_daily_forecast
      FROM ML.FORECAST(MODEL `{PROJECT_ID}.{DATASET_ID}.forecast_model`, STRUCT(15 AS horizon))
      GROUP BY phc_id, medicine_id
    )
    SELECT 
      p.id as phc_id,
      p.name as phc_name,
      m.id as medicine_id,
      m.name as medicine_name,
      m.drug_class,
      m.unit,
      i.current_stock,
      i.safety_threshold,
      COALESCE(f.total_forecasted_demand_15d, 15 * (i.safety_threshold / 5.0)) as total_forecast_15d,
      COALESCE(f.avg_daily_forecast, i.safety_threshold / 5.0) as avg_daily_forecast
    FROM `{PROJECT_ID}.{DATASET_ID}.inventory` i
    JOIN `{PROJECT_ID}.{DATASET_ID}.phcs` p ON i.phc_id = p.id
    JOIN `{PROJECT_ID}.{DATASET_ID}.medicines` m ON i.medicine_id = m.id
    LEFT JOIN forecast_summary f ON i.phc_id = f.phc_id AND i.medicine_id = f.medicine_id
    """

    try:
        query_job = client.query(sql)
        results = query_job.to_dataframe()
        
        alerts = []
        for _, row in results.iterrows():
            curr_stock = int(row["current_stock"])
            avg_burn = float(row["avg_daily_forecast"])
            
            # Days of Coverage (DoC)
            doc = curr_stock / avg_burn if avg_burn > 0 else 999.0
            
            # Identify warning states
            status = "OPTIMAL"
            if doc <= 0.0:
                status = "STOCKOUT"
            elif doc <= 5.0:
                status = "CRITICAL_DEFICIT"
            elif doc <= 10.0:
                status = "WARNING_DEFICIT"
            elif doc >= 25.0:
                status = "SURPLUS"
                
            alerts.append({
                "phc_id": int(row["phc_id"]),
                "phc_name": str(row["phc_name"]),
                "medicine_id": int(row["medicine_id"]),
                "medicine_name": str(row["medicine_name"]),
                "drug_class": str(row["drug_class"]),
                "unit": str(row["unit"]),
                "current_stock": curr_stock,
                "safety_threshold": int(row["safety_threshold"]),
                "avg_daily_forecast": round(avg_burn, 2),
                "days_of_coverage": round(doc, 1),
                "status": status
            })
            
        return alerts

    except Exception as e:
        logger.error(f"BQML forecast query failed: {e}. Falling back to mock forecasting.")
        return get_mock_forecast_alerts()

def get_mock_forecast_alerts():
    """
    Fallback mock forecaster for offline or credentials-free environments.
    """
    # 5 Mock PHCs
    phc_names = {1: "PHC Utnoor", 2: "PHC Indervelly", 3: "PHC Narnoor", 4: "PHC Ichoda", 5: "PHC Bazarhatnoor"}
    # 6 Medicines
    meds = [
        {"id": 1, "name": "Amoxicillin", "unit": "Tablets", "drug_class": "ROUTINE", "avg": 30.0},
        {"id": 2, "name": "Paracetamol", "unit": "Tablets", "drug_class": "ROUTINE", "avg": 40.0},
        {"id": 3, "name": "Insulin Glargine", "unit": "Vials", "drug_class": "CRITICAL", "avg": 8.0},
        {"id": 4, "name": "Oxytocin Injection", "unit": "Ampoules", "drug_class": "CRITICAL", "avg": 12.0},
        {"id": 5, "name": "Metformin", "unit": "Tablets", "drug_class": "ROUTINE", "avg": 25.0},
        {"id": 6, "name": "ORS Sachet", "unit": "Packets", "drug_class": "ROUTINE", "avg": 50.0},
    ]
    
    alerts = []
    # Seed fixed states for mock demo:
    # PHC 1 has stockout of Insulin (Critical)
    # PHC 3 has deficit of Oxytocin (Critical)
    # PHC 2 has surplus of Insulin and Oxytocin
    # PHC 5 has surplus of Insulin
    for phc_id, phc_name in phc_names.items():
        for med in meds:
            avg_burn = med["avg"]
            safety = int(avg_burn * 5)
            
            # Deterministic stocks to trigger redistribution logic
            if phc_id == 1 and med["name"] == "Insulin Glargine":
                stock = 3  # DoC = 3/8 = 0.3 days -> CRITICAL_DEFICIT
            elif phc_id == 3 and med["name"] == "Oxytocin Injection":
                stock = 4  # DoC = 4/12 = 0.3 days -> CRITICAL_DEFICIT
            elif phc_id == 2 and med["name"] == "Insulin Glargine":
                stock = 240 # DoC = 30 days -> SURPLUS
            elif phc_id == 2 and med["name"] == "Oxytocin Injection":
                stock = 360 # DoC = 30 days -> SURPLUS
            elif phc_id == 5 and med["name"] == "Insulin Glargine":
                stock = 200 # DoC = 25 days -> SURPLUS
            else:
                stock = int(avg_burn * 12)  # Healthy (12 days)
                
            doc = stock / avg_burn
            
            status = "OPTIMAL"
            if doc <= 0.0:
                status = "STOCKOUT"
            elif doc <= 5.0:
                status = "CRITICAL_DEFICIT"
            elif doc <= 10.0:
                status = "WARNING_DEFICIT"
            elif doc >= 25.0:
                status = "SURPLUS"
                
            alerts.append({
                "phc_id": phc_id,
                "phc_name": phc_name,
                "medicine_id": med["id"],
                "medicine_name": med["name"],
                "drug_class": med["drug_class"],
                "unit": med["unit"],
                "current_stock": stock,
                "safety_threshold": safety,
                "avg_daily_forecast": avg_burn,
                "days_of_coverage": round(doc, 1),
                "status": status
            })
            
    return alerts
