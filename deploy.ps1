# deploy.ps1 - Windows PowerShell deployment script for Cloud Run

# Get the current active GCP project
$projectId = gcloud config get-value project 2>$null
$serviceName = "smart-health-prototype"
$region = "asia-south1"

if ([string]::IsNullOrEmpty($projectId)) {
    Write-Error "No active GCP project configured in gcloud CLI."
    Write-Host "Please set one using: gcloud config set project [PROJECT_ID]" -ForegroundColor Yellow
    exit 1
}

Write-Host "Deploying $serviceName to project $projectId in region $region..." -ForegroundColor Cyan

# Deploy using Cloud Build and Cloud Run
gcloud run deploy $serviceName `
  --source . `
  --platform managed `
  --region $region `
  --project $projectId `
  --allow-unauthenticated `
  --set-env-vars GOOGLE_CLOUD_PROJECT=$projectId

Write-Host "Deployment complete! Verify the URL printed above." -ForegroundColor Green
