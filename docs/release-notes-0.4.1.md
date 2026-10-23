# Hina Desktop 0.4.1

- Improve recognition of quiet speech from USB microphones in local Windows
  dictation and Voice Assistant recordings. Digital automatic gain control is
  enabled while Chromium's system microphone volume adjustment is disabled.
- Ignore punctuation-only Voice Assistant transcripts instead of sending empty
  commands to Hina.
- Include the security and GitHub workflow fixes from `1ea385ef8`, including the
  Electron update and fixes for the reported CodeQL findings.

The Windows installer, blockmap and `latest.yml` are released together for
in-app updates. Microphone selection and Hina Connector settings are preserved.
