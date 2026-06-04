$projectName = "wbot-web"
$envFile = ".env"

Write-Host "=== Setup Railway: $projectName ===" -ForegroundColor Cyan

railway login --check 2>$null
if (-not $?) {
  railway login
}

# Ver si ya hay proyecto linkeado
$linked = railway link --check 2>$null
if ($linked -match "^https://railway.app/project/") {
  Write-Host "Proyecto ya linkeado: $linked" -ForegroundColor Green
} else {
  railway init --name $projectName 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Error creando proyecto, usa 'railway link' manualmente y vuelve a correr el script." -ForegroundColor Red
    exit 1
  }
  Write-Host "Proyecto '$projectName' creado y linkeado." -ForegroundColor Green
}

# Leer .env y setear variables
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*([^#=]+?)\s*=\s*(.+?)\s*$") {
      $key = $matches[1].Trim()
      $value = $matches[2].Trim()
      if ($value -match "^""(.+)""$") {
        $value = $matches[1]
      }
      Write-Host "  Seteando $key..." -ForegroundColor Gray
      railway variable set "${key}=${value}" --skip-deploys 2>&1 | Out-Null
    }
  }
  Write-Host "Variables de entorno cargadas desde .env" -ForegroundColor Green
} else {
  Write-Warning "No se encontro .env"
}

Write-Host ""
Write-Host "=== Listo! ===" -ForegroundColor Cyan
