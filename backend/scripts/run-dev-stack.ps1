$ErrorActionPreference = "Stop"

$backendRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $backendRoot
$mysqlBinary = Join-Path $backendRoot "mysql-runtime\mysql-8.0.45-winx64\bin\mysqld.exe"
$mysqlConfig = Join-Path $backendRoot "mysql-runtime\my.ini"
$pingScript = Join-Path $backendRoot "src\scripts\ping-mysql-runtime.js"
$serverScript = Join-Path $backendRoot "src\server.js"

if (!(Test-Path $mysqlBinary)) {
  throw "MySQL binary was not found at $mysqlBinary"
}

$mysqlProcess = Start-Process -FilePath $mysqlBinary -ArgumentList "--defaults-file=$mysqlConfig", "--console" -WorkingDirectory $projectRoot -PassThru -WindowStyle Hidden

$ready = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
  cmd /c "node `"$pingScript`" >nul 2>nul"
  if ($LASTEXITCODE -eq 0) {
    $ready = $true
    break
  }
  Start-Sleep -Seconds 1
}

if (-not $ready) {
  if ($mysqlProcess -and -not $mysqlProcess.HasExited) {
    Stop-Process -Id $mysqlProcess.Id -Force -ErrorAction SilentlyContinue
  }
  throw "MySQL runtime did not become ready in time."
}

try {
  Write-Host "MySQL runtime is ready. Starting AutoFix backend..."
  node $serverScript
}
finally {
  if ($mysqlProcess -and -not $mysqlProcess.HasExited) {
    Stop-Process -Id $mysqlProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
