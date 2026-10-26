# Hina Desktop 0.5.0

The voice assistant now opens a conversation while OpenClaw works, with available
public progress updates and a shared history for voice and typed follow-ups.

- **Minimize** returns to the small overlay. Click it to restore the same chat.
- **Close conversation** leaves its task running in History. The next invocation starts a new session.
- **History** opens running and completed conversations and their answers.
- Clicking the text composer after the assistant hotkey stops microphone capture without interrupting OpenClaw.
- Follow-up messages queue in the current conversation while a task runs.

## Update

Use **Check for updates** in the Hina tray menu, download the update and restart
when convenient. Manual installation uses `Hina-Desktop-Setup-0.5.0-x64.exe`.
Keep `latest.yml` and the installer blockmap with the release assets for in-app updates.

## Connector compatibility

This release requires the persistent-session API from Connector commit
`d9491cc` in `redmoondz/hine-whispr`. Older Connectors do not expose `/sessions`.
The paired local Connector service was updated and its session API verified
before publication. Other installations must update Connector separately.
Existing configured task deadlines still apply. Detailed progress depends on
Gateway history permissions; the UI reports when it is unavailable.

## Validation

- Desktop full suite: 8690 passed, zero failures; environment-dependent skips and the existing TODO remain.
- Connector suite: 230 passed.
- Desktop lint, types and renderer build passed.
- Chromium component screenshots cover desktop and narrow widths in light and dark themes.
- Native Windows packaging, updater metadata and focused regression tests run in the release workflow.
- Native microphone and hotkey interaction still require an interactive Windows session.

## Published release evidence

- Stable latest release: https://github.com/redmoondz/hina-desktop/releases/tag/v0.5.0
- Source and release tag: `51db2615bb9f810320efc7f06e8f73c486111af1`.
- Successful Windows build and draft creation: https://github.com/redmoondz/hina-desktop/actions/runs/40379064979
- Installer: `Hina-Desktop-Setup-0.5.0-x64.exe`, 187063700 bytes.
- Installer SHA-512: `lODZzAbXrBqmbHulm1RKcw83pmJT3jPCM3AUmALiPn5npVXOUi4702PzWGbU16NTTj+RH4Pn+DG+/OFjW3vWHg==`.
- Blockmap: `Hina-Desktop-Setup-0.5.0-x64.exe.blockmap`, 195797 bytes.
- `latest.yml`: version 0.5.0, consistent modern and legacy installer metadata;
  public bytes match the independently downloaded and verified draft artifact.
- Public unauthenticated Atom update feed includes v0.5.0. GitHub reports this
  release as latest, published and not a prerelease.
- Before restarting the paired Connector, its complete service cgroup contained
  only the main Node process. The updated authenticated `/sessions` API returned
  HTTP 200 and an empty history. No inference was started during rollout.
- Native installed Windows hotkey and microphone E2E remains user-side; the
  installed application was not replaced or restarted by this release process.
