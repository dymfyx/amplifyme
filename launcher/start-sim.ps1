# Market Simulation — desktop launcher
#
# Double-clicked from the desktop shortcut. Starts the local preview server if
# it is not already answering on the port, then opens the terminal in the
# default browser. Safe to run twice: an already-running server is reused.

param(
  [switch]$NoBrowser,
  [int]$Port = 4173
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$url = "http://127.0.0.1:$Port"

function Test-ServerUp {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-ServerUp)) {
  $dist = Join-Path $root 'dist\index.html'
  if (-not (Test-Path $dist)) {
    Push-Location $root
    try {
      & npm.cmd run build | Out-Null
    } finally {
      Pop-Location
    }
  }

  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', "npm run preview -- --port $Port --host 127.0.0.1" `
    -WorkingDirectory $root `
    -WindowStyle Hidden

  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    Start-Sleep -Milliseconds 500
    if (Test-ServerUp) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
      "The simulation server did not start on port $Port.`n`nRun 'npm run preview' in $root to see the error.",
      'Market Simulation') | Out-Null
    exit 1
  }
}

if (-not $NoBrowser) {
  Start-Process $url
}
