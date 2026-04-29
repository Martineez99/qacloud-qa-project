# setup.ps1 - Inicializacion completa del proyecto QA Cloud
# Uso: .\scripts\setup.ps1

Write-Host "`nQA Cloud - Project Setup" -ForegroundColor Cyan
Write-Host "============================================`n"

# 1. Verificar Node.js >= 20
Write-Host "[1/5] Checking Node.js version..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Error "Node.js not found. Install Node.js >= 20 from https://nodejs.org"
    exit 1
}
$nodeMajor = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
if ($nodeMajor -lt 20) {
    Write-Error "Node.js $nodeVersion detected. Required: >= 20"
    exit 1
}
Write-Host "OK - Node.js $nodeVersion`n"

# 2. Instalar dependencias
Write-Host "[2/5] Installing npm dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed"; exit 1 }
Write-Host "OK - Dependencies installed`n"

# 3. Instalar browsers de Playwright
Write-Host "[3/5] Installing Playwright browsers (Chromium + Firefox)..." -ForegroundColor Yellow
npx playwright install --with-deps chromium firefox
if ($LASTEXITCODE -ne 0) { Write-Error "Playwright browser install failed"; exit 1 }
Write-Host "OK - Browsers installed`n"

# 4. Configurar .env
Write-Host "[4/5] Configuring .env..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "OK - .env created from .env.example"
    Write-Host "IMPORTANT: Open .env and fill in your qacloud.dev credentials`n" -ForegroundColor Yellow
} else {
    Write-Host "INFO - .env already exists, skipping`n" -ForegroundColor Gray
}

# 5. Verificar herramientas opcionales (con Get-Command para evitar errores de consola)
Write-Host "[5/5] Checking optional tools..." -ForegroundColor Yellow

if (Get-Command k6 -ErrorAction SilentlyContinue) {
    $k6Version = k6 version
    Write-Host "OK - $k6Version"
} else {
    Write-Host "WARNING - K6 not found. Install with: winget install k6 --source winget" -ForegroundColor Yellow
}

if (Get-Command allure -ErrorAction SilentlyContinue) {
    $allureVersion = allure --version
    Write-Host "OK - Allure $allureVersion"
} else {
    Write-Host "WARNING - Allure CLI not found. Install with: npm install -g allure-commandline" -ForegroundColor Yellow
}

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Setup complete! Next steps:" -ForegroundColor Green
Write-Host "  1. Edit .env with your credentials"
Write-Host "  2. Run: .\scripts\run-tests.ps1 -Suite smoke"
Write-Host "============================================`n"