# run-perf.ps1
# Carga el .env y ejecuta un test K6
#
# Uso completo (dry run):
#   .\scripts\run-perf.ps1 -Scenario market-load -VUs 2 -Duration 15s
#
# Uso normal (usa los stages del script):
#   .\scripts\run-perf.ps1 -Scenario market-load

param(
    [string]$Scenario = "market-load",
    [int]$VUs         = 0,
    [string]$Duration = ""
)

# Cargar .env
if (-not (Test-Path ".env")) {
    Write-Error ".env no encontrado. Copia .env.example y rellena tus credenciales."
    exit 1
}

Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.+)$') {
        $key   = $matches[1].Trim()
        $value = $matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($key, $value, 'Process')
        Write-Host "  OK $key cargada" -ForegroundColor DarkGray
    }
}

# Construir comando
$scriptPath = "src/performance/scenarios/$Scenario.js"

if (-not (Test-Path $scriptPath)) {
    Write-Error "Escenario no encontrado: $scriptPath"
    exit 1
}

Write-Host ""
Write-Host "Ejecutando: $Scenario" -ForegroundColor Cyan

if ($VUs -gt 0 -and $Duration -ne "") {
    k6 run --vus $VUs --duration $Duration $scriptPath
} else {
    k6 run $scriptPath
}