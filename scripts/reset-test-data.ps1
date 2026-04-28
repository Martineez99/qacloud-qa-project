# reset-test-data.ps1 - Reset del estado de la plataforma
# Uso: .\scripts\reset-test-data.ps1
# Requiere: .env con QACLOUD_BASE_URL y QACLOUD_API_KEY

Write-Host "`nQA Cloud - Resetting test data`n" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
    Write-Error ".env file not found. Run .\scripts\setup.ps1 first."
    exit 1
}

# Cargar variables del .env
Get-Content ".env" | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line -match "^([^=]+)=(.*)$") {
        [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

$baseUrl = [System.Environment]::GetEnvironmentVariable("QACLOUD_BASE_URL")
$apiKey  = [System.Environment]::GetEnvironmentVariable("QACLOUD_API_KEY")

if (-not $baseUrl -or -not $apiKey) {
    Write-Error "QACLOUD_BASE_URL or QACLOUD_API_KEY not set in .env"
    exit 1
}

Write-Host "Calling POST $baseUrl/api/reset ..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod `
        -Uri "$baseUrl/api/reset" `
        -Method POST `
        -Headers @{ Authorization = $apiKey } `
        -ContentType "application/json"

    Write-Host "OK - Test data reset successfully`n" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 3)
} catch {
    Write-Error "Reset failed: $($_.Exception.Message)"
    exit 1
}