# generate-report.ps1 - Generar y abrir Allure Report
# Uso: .\scripts\generate-report.ps1 [-Open] [-Serve]

param(
    [switch]$Open,
    [switch]$Serve
)

$resultsDir = "reports/allure-results"
$reportDir  = "reports/allure-report"

Write-Host "`nQA Cloud - Allure Report`n" -ForegroundColor Cyan

if (-not (Get-Command allure -ErrorAction SilentlyContinue)) {
    Write-Error "Allure CLI not installed. Run: npm install -g allure-commandline"
    exit 1
}

if ($Serve) {
    Write-Host "Starting Allure live server..." -ForegroundColor Yellow
    allure serve $resultsDir
    return
}

if (-not (Test-Path $resultsDir)) {
    Write-Error "Results folder not found: '$resultsDir'. Run tests first."
    exit 1
}

$resultFiles = Get-ChildItem $resultsDir -Filter "*.json" -ErrorAction SilentlyContinue
if (-not $resultFiles) {
    Write-Error "No Allure results found in '$resultsDir'. Run tests first."
    exit 1
}

Write-Host "Generating Allure report from $($resultFiles.Count) result files..." -ForegroundColor Yellow
allure generate $resultsDir -o $reportDir --clean

if ($LASTEXITCODE -ne 0) {
    Write-Error "Report generation failed"
    exit 1
}

Write-Host "OK - Report generated at: $reportDir`n" -ForegroundColor Green

if ($Open) {
    Write-Host "Opening report in browser..." -ForegroundColor Yellow
    allure open $reportDir
} else {
    Write-Host "To open the report run: .\scripts\generate-report.ps1 -Open"
}