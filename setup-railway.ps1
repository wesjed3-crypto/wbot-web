$projectName = "wbot-web"
$envFile = ".env"
$repoUrl = "https://github.com/wesjed3-crypto/wbot-web.git"

Write-Host "=== Setup Railway: $projectName ===" -ForegroundColor Cyan

# Login si no está
$status = railway login --check 2>$null
if (-not $?) {
  railway login
}

# Crear proyecto en Railway
$project = railway init $projectName 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "El proyecto ya existe o hubo un error. Intentando linkear..." -ForegroundColor Yellow
  railway link
} else {
  Write-Host "Proyecto '$projectName' creado en Railway." -ForegroundColor Green
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
  Write-Warning "No se encontro .env. Las variables deberan setearse manualmente."
}

Write-Host ""
Write-Host "=== Listo! Ve a Railway Dashboard para verificar ===" -ForegroundColor Cyan
Write-Host "Proyecto: $projectName"
