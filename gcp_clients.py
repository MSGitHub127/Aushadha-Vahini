import os
import logging
from google.cloud import bigquery
from google.cloud import texttospeech
import google.generativeai as genai
from config import PROJECT_ID

logger = logging.getLogger(__name__)

bq_client = None
tts_client = None

# BigQuery client reuse
try:
    bq_client = bigquery.Client(project=PROJECT_ID)
    logger.info("GCP Clients: BigQuery client initialized.")
except Exception as e:
    logger.warning(f"GCP Clients: BigQuery auth failed: {e}. Fallback active.")

# Text-to-Speech client reuse
try:
    tts_client = texttospeech.TextToSpeechClient()
    logger.info("GCP Clients: TextToSpeech client initialized.")
except Exception as e:
    logger.warning(f"GCP Clients: TextToSpeech auth failed: {e}. Fallback active.")

# Gemini initialization
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    logger.info("GCP Clients: Gemini API configured.")
else:
    logger.warning("GCP Clients: GEMINI_API_KEY missing. Mock fallback mode.")
