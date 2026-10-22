$ErrorActionPreference = "Stop"
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$exe = "C:\Users\siriu\projects\hina-desktop\desktop\dist\win-unpacked\Hina Desktop.exe"
$process = Start-Process -FilePath $exe -ArgumentList "--remote-debugging-port=9333", "--enable-logging" -RedirectStandardOutput "$env:TEMP\hina-launch.stdout.log" -RedirectStandardError "$env:TEMP\hina-launch.stderr.log" -PassThru
Write-Output "HINA_PID=$($process.Id)"
Start-Sleep -Seconds 5
Write-Output "HINA_RUNNING=$(-not $process.HasExited)"
if ($process.HasExited) { Write-Output "HINA_EXIT=$($process.ExitCode)" }
