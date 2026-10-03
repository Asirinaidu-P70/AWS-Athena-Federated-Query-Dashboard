# PowerShell script to package the Lambda function for AWS deployment

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Packaging Retail Athena Query API Lambda " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Ensure dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing production dependencies..." -ForegroundColor Yellow
    npm install --omit=dev
}

$ZipPath = Join-Path $ScriptDir "retail-athena-query-api.zip"

if (Test-Path $ZipPath) {
    Remove-Item $ZipPath -Force
}

Write-Host "Creating deployment package: retail-athena-query-api.zip..." -ForegroundColor Yellow
Compress-Archive -Path "src", "node_modules", "package.json" -DestinationPath $ZipPath -Force

if (Test-Path $ZipPath) {
    $Size = (Get-Item $ZipPath).Length / 1MB
    Write-Host "Package created successfully! Size: $([math]::Round($Size, 2)) MB" -ForegroundColor Green
    Write-Host "Zip location: $ZipPath" -ForegroundColor Green
    Write-Host "Upload this zip file to AWS Lambda (Handler: src/handler.handler)" -ForegroundColor Cyan
} else {
    Write-Host "Failed to create zip package." -ForegroundColor Red
}
