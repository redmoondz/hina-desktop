# Hina Desktop 0.4.1

- Improve quiet USB microphone capture in dictation and Voice Assistant with
  shared application gain. Automatic boost defaults on for local Windows;
  saved user choices are preserved. System microphone volume is not adjusted.
- Add a microphone level meter, local test recording/playback, automatic boost
  toggle and manual gain control in microphone settings.
- Ignore punctuation-only Voice Assistant transcripts instead of sending empty
  commands to Hina.
- Include the security and GitHub workflow fixes from `1ea385ef8`, the Electron
  update, compatible SQLite bindings and a Windows navigation test fix.
- Include the native macOS audio and calendar helpers in packaged applications.
- Bound the main CI test pool to two concurrent processes.

The Windows installer, blockmap and `latest.yml` are released together for
in-app updates. Microphone selection and Hina Connector settings are preserved.
