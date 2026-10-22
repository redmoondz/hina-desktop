# Hina Desktop v0.1: Windows acceptance

Hina Desktop is an OpenWhispr fork with an explicit connection to the existing
OpenClaw `hina` agent. Original dictation, providers, notes, meetings, shortcuts,
and overlays remain available. This milestone adds no Hands, Analytics, or
Dashboard features and no new dictation or overlay behavior.

## Build and launch

On the configured Windows host, run `scripts/hina-verify-win.ps1` using Windows
PowerShell. It checks types, lint, Connector transport tests, restores SQLite's
Electron ABI, builds the renderer, and packages an unsigned directory.

The local executable is:

```text
C:\Users\siriu\projects\hina-desktop\desktop\dist\win-unpacked\Hina Desktop.exe
```

Keep the complete `win-unpacked` directory together. Copying only the executable
does not produce a usable app. The local build is unsigned and is not an NSIS
installer. Windows may ask for confirmation before launching an unsigned app.

For a fresh checkout with Node 24, run `npm ci`, `npm run prebuild:win`,
`npx electron-rebuild --force --which-module better-sqlite3`, and
`npm run build:hina:win`. The manual GitHub workflow `Hina Desktop Windows`
performs these steps and uploads the complete directory. A successful workflow
does not by itself prove microphone or agent connectivity.

## Connect the existing agent

1. Start the existing Hina Connector with its existing private environment.
   See `../connector/README.md`. No new agent or direct provider credentials
   are needed in Desktop. Verify `/health` reports `agent: hina`.
2. Launch **Hina Desktop**. Account-free onboarding remains available.
3. Open **Settings > AI Models / LLMs > Voice Assistant > Hina Connector**.
4. Choose **Windows / local machine** if Connector runs on Windows, or
   **WSL default distribution (Windows)** if it runs in the default WSL distro.
   The WSL option requires `wsl.exe` and `/usr/bin/curl` in that distribution.
5. Enter `http://127.0.0.1:3210` and the Connector bearer token. Press
   **Test and connect Hina**. The test checks health and authenticated metrics
   without sending a paid agent turn. The key uses OpenWhispr's existing
   main-process secret storage; it is not written to this repository.
6. Configure speech recognition separately under **Speech to Text**. For an
   offline check, download a local speech model with Russian support.

The Hina request path is the packaged renderer's `ReasoningService` -> preload
IPC -> main-process Connector transport -> `/v1/chat/completions` -> existing
`openclaw agent --agent hina`. Main-process HTTP avoids packaged-renderer CORS.
The WSL option runs curl without a shell; credentials travel on stdin rather
than process arguments. The Connector URL is restricted to loopback.

## Voice acceptance on Windows

1. Under **Settings > Hotkeys**, assign a free **Voice Assistant** shortcut, for example
   `Ctrl+Alt+H`. The original dictation shortcut is a separate setting.
2. Focus an application with no writable text cursor if you want the answer in
   the assistant panel; upstream auto-paste behavior can otherwise paste it.
3. Press the Voice Assistant shortcut, say a short command asking Hina to reply
   with `HINA_CONNECTION_OK`, then stop recording with the configured shortcut.
4. Verify the recognized text and Hina's response. The response must come from
   the existing `hina` agent. The Connector should record one successful chat
   command. Check the agent session for the same command if needed.
5. Repeat with Connector stopped: expect an explicit connection error and no
   silent switch to a cloud model. An invalid token should fail the connection
   test with HTTP 401 before it can be saved as the active connection.
6. Close and reopen Hina Desktop. Verify the connection settings persist.
7. Launch the original OpenWhispr alongside Hina Desktop. Check both open and
   keep independent settings. Shortcuts can still conflict between two running
   apps; assign different shortcuts for this check.

## Isolation and limitations

- Windows identity: `com.hina.desktop`; profile: `%APPDATA%\Hina Desktop`.
- URI protocol: `hina-desktop://`; auth bridge port: 5299.
- Updates point to `redmoondz/hina-desktop`, not the upstream product. Cloud
  OAuth provider callbacks require fork-specific registration; unconfigured
  upstream cloud accounts are not part of the Hina Connector acceptance path.
- Installer cleanup does not remove OpenWhispr startup entries or model cache.
- Connector currently forwards only the final user message. Its agent session
  owns conversation context; Desktop history is not forwarded as a full chat.
- Replies arrive after the Connector's agent turn completes. Stopping the
  assistant hides a cancelled result; it does not stop an already-running
  Connector CLI turn. HTTP/CLI timeouts bound the request.
- A microphone/hotkey check requires an interactive Windows user session and
  is distinct from an automated text-command check through the packaged app.

See `HINA-VERIFICATION.md` for actual results and remaining checks.
