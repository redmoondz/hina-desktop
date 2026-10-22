# Hina connection and voice replies

Open Hina settings from the tray. The connection card appears near the top.
Choose WSL when Connector runs in the default WSL distribution on Windows;
choose Local when Connector runs on the same operating system as the app.
Use the Connector URL (normally `http://127.0.0.1:3210`) and its bearer
token. The OpenClaw Gateway URL and token are separate credentials.

The app verifies Connector identity and authentication on connection, on
opening settings, after JSON import, and every 30 seconds while settings are
open. This verifies the Connector service, not a paid agent turn. A successful
voice request still depends on the running OpenClaw agent.

## JSON configuration

Import [hina-settings.example.json](examples/hina-settings.example.json)
through Portable settings. Version 1 files remain compatible. Connection
fields are `connector.url`, `connector.transport` (`local` or `wsl`), and
optional `connector.token` and `connector.timeoutSeconds`. Omitting the token reuses the credential already
saved on this device. An imported connection must authenticate before settings
are applied. Invalid documents and failed authentication leave preferences
unchanged. A shortcut registration conflict also prevents applying settings.

Agent timeout is configurable in the connection card, defaults to 300 seconds
(5 minutes), and accepts whole seconds from 1 to 3600. It applies to the next
request and is passed through Connector to OpenClaw's own timeout. HTTP and WSL
transports allow 30 seconds of extra time for the final result or error. While
waiting, chat and the assistant panel show elapsed time. This is an elapsed
wait indicator: the CLI does not expose live individual tool progress. Closing
the client does not cancel the server's agent turn; the configured deadline
still bounds it. Check the agent session before retrying a disconnected request.

Keep credentials in the designated private configuration file or enter them
in the password field. Never commit a real token. JSON exports omit tokens;
they include the Connector address, transport, language and voice preferences.
If both `connector.url` and the legacy `settings.dictationAgentRemoteUrl` are
present, they must match.

## Push-to-talk on Windows

Choose Hold in the activation mode selector and assign the Talk to Hina
shortcut. Hold it for at least 150 ms, speak, then release it. A short tap
cancels preparation. Only the key that started a hold can stop that hold.
Dictation and assistant shortcuts both support this mode on Windows.
The native key listener must be available. Other platforms retain their
existing shortcut behavior; Windows voice playback requires Windows.

The local transcription model must be downloaded and a microphone selected.
Assistant answers appear in the panel and are spoken without pasting into
the focused application. Starting another recording stops playback.

## Windows speech voices

Windows voice replies lists enabled voices available to the built-in
`System.Speech` engine. Select Speech language, then Windows voice. Refresh
voices after installing compatible speech voices in Windows Settings. Some
Windows online or Narrator-only voices are not available to this engine.
Test voice plays a short sample; Stop speech interrupts playback.

`speech.enabled`, `speech.language` (for example `ru-RU`), and `speech.voice`
(the exact installed voice name, or an empty string for automatic selection)
are persisted locally and included in JSON exports. Importing a voice name
does not install it. Missing voices produce a visible playback error.
Speech runs locally through PowerShell and System.Speech. Answer text and
voice names travel as JSON on stdin, never as executable PowerShell source.
