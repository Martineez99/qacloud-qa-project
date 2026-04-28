# run-tests.ps1 - Ejecutar suites de tests
# Uso: .\scripts\run-tests.ps1 -Suite <suite> [-Headed] [-Debug]
#
# Ejemplos:
#   .\scripts\run-tests.ps1 -Suite smoke
#   .\scripts\run-tests.ps1 -Suite market -Headed
#   .\scripts\run-tests.ps1 -Suite api
#   .\scripts\run-tests.ps1 -Suite perf -Scenario market-load

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("smoke","e2e","market","hotel","bank","api","perf","all")]
    [string]$Suite,

    [string]$Scenario = "market-load",
    [switch]$Headed,
    [switch]$Debug
)

Write-Host "`nQA Cloud - Running Suite: $Suite`n" -ForegroundColor Cyan

$headedFlag = if ($Headed) { "--headed --slowMo=300" } else { "" }
$debugFlag  = if ($Debug)  { "--debug" } else { "" }

switch ($Suite) {
    "smoke"  {
        Write-Host "Running: Smoke tests (all apps)" -ForegroundColor Yellow
        Invoke-Expression "npx playwright test --grep @smoke $headedFlag $debugFlag"
    }
    "e2e"    {
        Write-Host "Running: All E2E tests" -ForegroundColor Yellow
        Invoke-Expression "npx playwright test src/e2e/ $headedFlag $debugFlag"
    }
    "market" {
        Write-Host "Running: Market E2E tests" -ForegroundColor Yellow
        Invoke-Expression "npx playwright test src/e2e/market/ $headedFlag $debugFlag"
    }
    "hotel"  {
        Write-Host "Running: Hotel E2E tests" -ForegroundColor Yellow
        Invoke-Expression "npx playwright test src/e2e/hotel/ $headedFlag $debugFlag"
    }
    "bank"   {
        Write-Host "Running: Bank E2E tests" -ForegroundColor Yellow
        Invoke-Expression "npx playwright test src/e2e/bank/ $headedFlag $debugFlag"
    }
    "api"    {
        Write-Host "Running: API tests" -ForegroundColor Yellow
        Invoke-Expression "npx playwright test --config=config/playwright.api.config.ts src/api/"
    }
    "perf"   {
        Write-Host "Running: K6 performance - scenario: $Scenario" -ForegroundColor Yellow
        $scenarioPath = "src/performance/scenarios/$Scenario.js"
        if (-not (Test-Path $scenarioPath)) {
            Write-Error "Scenario file not found: $scenarioPath"
            exit 1
        }
        if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
            Write-Error "K6 not installed. Run: winget install k6 --source winget"
            exit 1
        }
        k6 run $scenarioPath
    }
    "all"    {
        Write-Host "Running: Full regression (E2E + API)" -ForegroundColor Yellow
        npx playwright test
    }
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nOK - Suite '$Suite' passed`n" -ForegroundColor Green
} else {º
    Write-Host "`nFAIL - Suite '$Suite' failed. Check output above`n" -ForegroundColor Red
}