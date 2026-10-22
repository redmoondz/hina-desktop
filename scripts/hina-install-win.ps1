param(
  [string]$Build = "C:\Users\siriu\projects\hina-desktop\desktop\dist\win-unpacked",
  [string]$Destination = "$env:LOCALAPPDATA\Programs\Hina Desktop"
)
$ErrorActionPreference = "Stop"
$sourceExe = Join-Path $Build "Hina Desktop.exe"
if (!(Test-Path -LiteralPath $sourceExe)) { throw "Verified Windows build not found." }
# Copy to a stable location so rebuilding the checkout cannot break the install.
$running = Get-Process -Name "Hina Desktop" -ErrorAction SilentlyContinue
if ($running) { throw "Quit Hina Desktop before installing the verified build." }
New-Item -ItemType Directory -Path $Destination -Force | Out-Null
& robocopy $Build $Destination /E /R:2 /W:1 /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -ge 8) { throw "Application copy failed." }
$shell = New-Object -ComObject WScript.Shell
$startMenu = [Environment]::GetFolderPath("Programs")
$shortcut = $shell.CreateShortcut((Join-Path $startMenu "Hina Desktop.lnk"))
$shortcut.TargetPath = Join-Path $Destination "Hina Desktop.exe"
$shortcut.WorkingDirectory = $Destination
$shortcut.Description = "Local dictation and Hina agent connection"
$shortcut.Save()
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Start-Process -FilePath $shortcut.TargetPath -ArgumentList "--hidden"
Write-Output "Installed Hina Desktop: $Destination"
exit 0
