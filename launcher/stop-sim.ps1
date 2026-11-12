# Market Simulation — stop the local preview server
#
# Kills whatever process is listening on the simulation port. Used when the
# desktop launcher left a server behind or the port is stuck.

param([int]$Port = 4173)

$ErrorActionPreference = 'Stop'
$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

if (-not $listeners) {
  Write-Output "No simulation server is listening on port $Port."
  exit 0
}

foreach ($listener in $listeners) {
  try {
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop
    Write-Output "Stopped process $($listener.OwningProcess) on port $Port."
  } catch {
    Write-Output "Could not stop process $($listener.OwningProcess): $($_.Exception.Message)"
  }
}
