import os

# Manually parse and load .env file into environment variables
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                key_val = line.split("=", 1)
                if len(key_val) == 2:
                    k, v = key_val
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k not in os.environ:
                        os.environ[k] = v

# Project-wide GCP configurations
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCP_PROJECT") or "smart-health-hackathon-demo"
DATASET_ID = "smart_health_db"
LOCATION = "asia-south1"  # Adjust based on preference (e.g., 'asia-south1' for India)
