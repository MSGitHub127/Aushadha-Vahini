#!/bin/bash

# Configuration
PROJECT_ID=$(gcloud config get-value project)
SERVICE_NAME="smart-health-prototype"
REGION="asia-south1"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: No active GCP project configured in gcloud CLI."
  echo "Please set one using: gcloud config set project [PROJECT_ID]"
  exit 1
fi

echo "Deploying $SERVICE_NAME to project $PROJECT_ID in region $REGION..."

# Deploy using Cloud Build and Cloud Run
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=$PROJECT_ID

echo "Deployment complete! Verify the URL printed above."
