param([string]$Checkout = "C:\Users\siriu\projects\hina-desktop\desktop")
$ErrorActionPreference = "Stop"
$nodeHome = "C:\Users\siriu\tools\node-v24.22.1-win-x64"
$env:PATH = "$nodeHome;$env:PATH"
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Set-Location $Checkout
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run format:check
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run typecheck
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
# Tests can load Node SQLite. Restore Electron's native ABI before packaging.
npx electron-rebuild --force --which-module better-sqlite3
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run build:hina:win
exit $LASTEXITCODE
