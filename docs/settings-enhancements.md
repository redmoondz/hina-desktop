# Dictation and settings enhancements

## Behavior

- Windows tap dictation uses physical key transitions when the native listener
  is ready. OS accelerator registration remains in place as a fallback. A held
  key does not create repeated recording toggles; releasing and pressing it
  again stops immediately, including during microphone preparation.
- Stopping or cancelling preparation invalidates that start. A microphone
  stream that arrives afterwards is released; a failed cancelled acquisition
  never retries another device. Batch Stop releases recorder tracks immediately.
- The media preference uses the existing player controller for dictation and
  voice-assistant capture. It resumes players paused by the app after capture.
- Clipboard retention uses the existing paste pipeline: insert and retain the
  transcript when enabled; insert and restore the previous clipboard otherwise.
- The GPU panel reuses the existing CUDA/Vulkan selection policy and download
  handlers. It provides status, hardware details, reinstall, remove, retry,
  progress and cancellation.
- Local usage reads existing analytics directly from the device database. The
  metric cards and activity calendar are shared with upstream Insights without
  importing its account, leaderboard or sync components.
- OpenClaw Control opens an independently configured HTTP(S) dashboard in the
  browser. It does not proxy the dashboard through the Connector.
- The connection test distinguishes invalid endpoints, unreachable services,
  wrong service identity and rejected credentials. The WSL subprocess honors
  the connection deadline. Health/authentication checks send no agent turns.
- The tray offers update checking, download and installation with confirmation
  before restarting. See [Windows updates](windows-updates.md).

## Portable JSON

Use **Portable settings > Export JSON / Import JSON**. Version 1 files use:

```json
{
  "format": "hina-desktop",
  "version": 1,
  "settings": {
    "theme": "dark",
    "activationMode": "tap",
    "dictationKey": "Control+Super",
    "whisperModel": "large-v3-turbo",
    "pauseMediaOnDictation": true,
    "keepTranscriptionInClipboard": true
  },
  "connector": {
    "transport": "wsl",
    "controlUrl": "http://127.0.0.1:18789/"
  }
}
```

An explicit allowlist excludes credentials, session/account state, history,
model binaries and system startup registration. The whole document is validated
before applying settings. Changing an imported Connector endpoint or transport
invalidates the saved connection; test and authenticate it again. Microphone IDs
can differ between computers and may require selecting the device again.

## Validation

The evidence directory is `evidence/settings-enhancements/`. The built renderer
was checked in Chromium at 1280 and 390 pixels, in light and dark themes, with a
simulated Electron bridge. Each scenario exercised export, import, preference
switches, rejection of invalid JSON and opening the dashboard. The browser
report records the results and screenshots show each section.

To repeat the browser check after `npm run build:renderer`, make
`playwright-core` available and run:

```bash
node scripts/verify-hina-settings.mjs
```

`HINA_PLAYWRIGHT_MODULE` can name an external Playwright module and
`HINA_CHROMIUM_PATH` can select an existing Chromium executable. No paid API or
real Connector credential is used in this check.

## Remaining interactive checks

- A real Windows microphone/hotkey session and media-player playback are
  separate from automated lifecycle tests and browser simulation.
- When a Windows native key listener is unavailable, OS accelerators expose no
  key-up event. The fallback prioritizes Stop but cannot perfectly distinguish
  an intentional rapid tap from OS autorepeat.
- The optional microphone warm-hold preference retains its existing semantics;
  leave it off to release the physical microphone between recordings.
- The Windows NSIS installer was built and installed locally after automated
  verification; the running app reported `0.3.0` and passed its saved Connector
  check. See [live Windows evidence](../evidence/settings-enhancements/README.md).
  Other portable installations require the first NSIS installation before
  relying on automatic replacement. No release was published to GitHub.
- Interactive voice conversation with the agent remains outside this change.
