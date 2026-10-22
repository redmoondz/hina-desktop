#!/usr/bin/env bash
# Copy only reviewed integration files after checking the Windows checkout.
set -euo pipefail
target=/mnt/c/Users/siriu/projects/hina-desktop/desktop
if [[ -n "$(git -C "$target" status --porcelain)" ]]; then
  echo "Windows checkout has changes; refusing to overwrite."
  exit 1
fi
for file in .gitattributes main.js preload.js package.json package-lock.json electron-builder.json resources/nsis/installer.nsh src/index.html src/updater.js src/types/electron.ts src/services/ReasoningService.ts src/components/settings/DictationAgentSettings.tsx src/components/settings/HinaConnectorSettings.tsx src/helpers/hinaConnector.js test/helpers/hinaConnector.test.js test/services/hinaVoiceAssistant.test.js test/components/fieldDirectionPolicy.test.js scripts/hina-verify-win.ps1; do
  mkdir -p "$target/$(dirname "$file")"
  cp "$file" "$target/$file"
done
