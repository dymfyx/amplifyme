# Market Simulation — install the desktop shortcut
#
# Creates (or refreshes) "Market Simulation.lnk" on the current user's desktop,
# pointing at launcher/start-sim.ps1 with the terminal icon in public/icon.ico.

param(
  [string]$Name = 'Market Simulation',
  [string]$IconPath = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$launcher = Join-Path $root 'launcher\start-sim.ps1'
$icon = if ($IconPath) { $IconPath } else { Join-Path $root 'public\icon.ico' }
$link = Join-Path $desktop "$Name.lnk"

if (-not (Test-Path $launcher)) {
  throw "Launcher script not found: $launcher"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($link)
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcher`""
$shortcut.WorkingDirectory = $root
$shortcut.Description = 'Market Simulation - practice terminal (Sales / Market Maker)'
$shortcut.WindowStyle = 7
if (Test-Path $icon) {
  $shortcut.IconLocation = "$icon,0"
}
$shortcut.Save()

Write-Output $link
