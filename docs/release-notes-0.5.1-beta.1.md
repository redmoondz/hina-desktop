# Hina Desktop 0.5.1-beta.1

Intermediate prerelease; publication and Windows installer build are pending.

- While an assistant reply is being spoken, the conversation header shows **Stop speaking** (**Остановить озвучку** in Russian).
- Clicking it stops the current speech immediately while preserving the response and conversation. Later replies can still be spoken; the saved speech preference is unchanged.
- Intentional cancellation no longer appears as a Windows speech failure.
- Closing the renderer stops its speech process. A stale speech completion cannot clear a newer reply's playback state.

## Validation

Targeted renderer interaction and speech-process tests cover manual cancellation, retained answer text, subsequent replies and stale completion. Type checking and renderer build pass. The focused suite passes all 56 tests, with no skips or failures; lint passes with existing repository warnings.

Native Windows audio playback and the Windows installer require Windows validation in the release workflow and an interactive Windows session.

## Release procedure

Run the **Hina Desktop Windows** workflow on the prepared commit with `create_draft_release=true`. It runs quality checks and focused regressions, builds the Windows installer and validates update assets before creating a draft prerelease for `v0.5.1-beta.1`. Publish only after that workflow succeeds. Keep this release marked as a prerelease so stable users remain on the stable update channel.
