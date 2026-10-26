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
The paired Connector deployment is verified separately before publication.
Existing configured task deadlines still apply. Detailed progress depends on
Gateway history permissions; the UI reports when it is unavailable.

## Validation

- Desktop full suite: 8690 passed, zero failures; environment-dependent skips and the existing TODO remain.
- Connector suite: 230 passed.
- Desktop lint, types and renderer build passed.
- Chromium component screenshots cover desktop and narrow widths in light and dark themes.
- Native Windows packaging, updater metadata and focused regression tests run in the release workflow.
- Native microphone and hotkey interaction still require an interactive Windows session.
