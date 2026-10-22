param([string]$Checkout = "C:\Users\siriu\projects\hina-desktop\desktop")
$ErrorActionPreference = "Continue"
. "C:\Users\siriu\tools\hina-env.ps1"
Set-Location $Checkout
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npx prettier --write src/helpers/hinaConnector.js test/helpers/hinaConnector.test.js src/components/settings/HinaConnectorSettings.tsx src/components/settings/DictationAgentSettings.tsx src/types/electron.ts src/services/ReasoningService.ts main.js preload.js src/updater.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run typecheck
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npx eslint src/helpers/hinaConnector.js test/helpers/hinaConnector.test.js src/components/settings/HinaConnectorSettings.tsx src/components/settings/DictationAgentSettings.tsx src/types/electron.ts src/services/ReasoningService.ts main.js preload.js src/updater.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node --import tsx --test test/helpers/hinaConnector.test.js test/services/hinaVoiceAssistant.test.js test/helpers/dictationAgentInference.test.js test/helpers/secretKeys.test.js test/services/lanReasoningOutput.test.js test/components/fieldDirectionPolicy.test.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
# The upstream test pipeline rebuilds SQLite for Node. Force the Electron
# prebuilt binary before packaging; electron-builder's cache can retain Node ABI.
npx electron-rebuild --force --which-module better-sqlite3
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run build:hina:win
exit $LASTEXITCODE
