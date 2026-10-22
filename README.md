# Hina Desktop

<img src="src/assets/logo.png" alt="Hina Desktop logo" width="128" height="128" />

A tray application for local voice dictation and sending voice requests to an existing Hina/OpenClaw agent.

- Speech recognition runs on this computer with Whisper or another installed local engine.
- Global shortcuts start dictation or send transcribed speech to the configured agent.
- Settings cover the microphone, shortcuts, local speech models, acceleration, and Hina connection.
- No account, subscription, cloud transcription, calendar, integrations, notes, uploads, dictionary, or chat workspace.

The Hina connector sends text to the existing agent. The agent's own model provider and network access are configured in Hina/OpenClaw.

## Existing downloads

On first launch, Hina imports downloaded Whisper `.bin` models from the previous application's cache and a complete Windows CUDA runtime pack. Files are copied into Hina's own cache/profile, verified with SHA-256, and published only after successful verification. Originals are preserved; account state, credentials, API keys, and browser storage are never imported. Existing Hina assets are preserved.

Windows locations:

- Models: `%USERPROFILE%\.cache\hina\whisper-models`
- CUDA pack: `%APPDATA%\Hina Desktop\bin\whisper-cuda`
- Profile: `%APPDATA%\Hina Desktop`

A first import may take a little time because it verifies several gigabytes. No model download is required when the previous assets are available.

## Development

Use Node.js 24 and npm. Do not regenerate the lockfile with another Node major.

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build:renderer
```

Build an unsigned Windows application on Windows:

```powershell
npm run build:hina:win
```

The output is `dist/win-unpacked/Hina Desktop.exe`. `scripts/hina-install-win.ps1` copies a verified build to a stable per-user location and creates a Start menu shortcut. It refuses to install while Hina is running. `scripts/hina-sync-windows.sh` synchronizes reviewed source to an existing clean Windows checkout while preserving its dependencies and build output; it requires filesystem approval when run from the restricted workspace.

The original application logo is stored in `src/assets/logo.png`. Regenerate its PNG, ICO, ICNS, and macOS tray variants with `node scripts/generate-hina-icons.cjs` after installing dependencies.

Based on MIT-licensed OpenWhispr. Original copyright and licensing notices remain in `LICENSE` and third-party materials.

For an existing OpenClaw installation in WSL/Linux, `bash scripts/hina-connector-service.sh --print-unit` previews a standalone user service. After review, running the script without arguments installs and enables `hina-connector.service` for the existing sibling Connector build. It creates a private `~/.config/hina-desktop/connector.env` with a new bearer token only when absent; reruns preserve that file and never print its token. The service clears inherited agent-execution flags, uses the installed OpenClaw executable, and checks local health without an agent turn. OpenClaw configuration and provider credentials remain managed by OpenClaw.
