$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

function Test-PortListening {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  try {
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
    return [bool]$listener
  }
  catch {
    return $false
  }
}

function Run-NpmScript {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ScriptName
  )

  Write-Host "Running npm script: $ScriptName" -ForegroundColor Cyan
  Push-Location $projectRoot
  try {
    & npm.cmd run $ScriptName
    if ($LASTEXITCODE -ne 0) {
      throw "npm run $ScriptName failed with exit code $LASTEXITCODE"
    }
  }
  finally {
    Pop-Location
  }
}

function Start-TerminalCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Title,
    [Parameter(Mandatory = $true)]
    [string]$Command
  )

  $wrapped = @"
`$Host.UI.RawUI.WindowTitle = '$Title'
Set-Location '$projectRoot'
$Command
"@

  Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command", $wrapped
  ) | Out-Null
}

Write-Host "Starting AutoFix local stack..." -ForegroundColor Green

Push-Location $projectRoot
try {
  & npm.cmd run backend:db:runtime:ping *> $null
  $mysqlAlreadyReady = ($LASTEXITCODE -eq 0)
}
finally {
  Pop-Location
}

if ($mysqlAlreadyReady) {
  Write-Host "MySQL runtime is already running." -ForegroundColor Yellow
}
else {
  $installedMysqlService = Get-Service -Name "AutoFixMySQL" -ErrorAction SilentlyContinue
  if ($installedMysqlService) {
    Write-Host "AutoFixMySQL Windows service is installed but not required for local startup. Falling back to the project runtime." -ForegroundColor Yellow
  }

  Run-NpmScript "backend:db:runtime:start"
}

$mysqlReady = $false
for ($attempt = 1; $attempt -le 20; $attempt++) {
  Push-Location $projectRoot
  try {
    & npm.cmd run backend:db:runtime:ping *> $null
    if ($LASTEXITCODE -eq 0) {
      $mysqlReady = $true
      break
    }
  }
  finally {
    Pop-Location
  }

  Start-Sleep -Milliseconds 800
}

if (-not $mysqlReady) {
  throw "MySQL runtime did not become ready in time."
}

Run-NpmScript "backend:db:init"

if (-not (Test-PortListening -Port 4000)) {
  Start-TerminalCommand -Title "AutoFix Backend" -Command "npm.cmd run backend:start"
  Write-Host "Backend window opened on port 4000." -ForegroundColor Yellow
}
else {
  Write-Host "Backend is already running on port 4000." -ForegroundColor Yellow
}

Start-Sleep -Milliseconds 1200

if (-not (Test-PortListening -Port 5173)) {
  Start-TerminalCommand -Title "AutoFix Frontend" -Command "npm.cmd run dev"
  Write-Host "Frontend window opened on port 5173." -ForegroundColor Yellow
}
else {
  Write-Host "Frontend is already running on port 5173." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "AutoFix is ready:" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173"
Write-Host "Backend health: http://localhost:4000/api/health"
