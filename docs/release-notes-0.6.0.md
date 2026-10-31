# Hina Desktop 0.6.0 — local XTTS v2 voices

Release preparation. This version has not been published and no Windows installer has been verified yet.

## Assistant speech

- Choose **XTTS v2** or existing **Windows system voices** in Speech settings. System voices stay the default.
- Generate assistant speech locally in Russian, English and the other XTTS v2 languages. No answer text or sample recording is sent to a speech provider. Runtime network downloads are disabled.
- Install/repair an isolated Python runtime and model from Settings after reviewing and accepting the model license. Python 3.10–3.12 (64-bit) must be installed; Windows defaults to Python 3.11, with an executable picker for other supported installations.
- Choose a built-in voice or a clean 3–30 second WAV recording for voice conditioning. Adjust speed, sampling temperature and playback volume. XTTS does not expose independent pitch control.
- Choose CPU or NVIDIA CUDA and test the model/preview the voice before use. CUDA requires compatible hardware and drivers. CPU generation may be slow; the first request loads the model.
- Stop speech during generation or playback without losing the assistant's response. Previewing or changing engines stops other Hina speech players.
- Portable JSON settings retain voice preferences and parameters but exclude recordings, Python paths and model files.

XTTS weights are downloaded separately and use CPML, not the application's MIT license. CPML restricts commercial use unless appropriate rights have been obtained. Hina does not silently accept the model license or bundle the weights. See `resources/xtts/README.md` for installation and troubleshooting.

## Validation and publication status

- CPU runtime dependencies installed and real XTTS imports/model architecture initialization verified with PyTorch 2.8.0, coqui-tts 0.28.0 and transformers 4.57.6.
- Worker tests cover argument validation, reference conditioning/cache behavior, WAV encoding, invalid languages/voices and non-finite audio using synthetic model outputs.
- Renderer/controller tests cover explicit model installation/license confirmation, selection and storage of settings, retained workers, stop/replacement races, local audio playback and portable settings.
- Release-workflow Node suites passed: 3 + 194 + 57 tests, zero failures or skips. The final focused XTTS/settings/locale suite passed 32 tests, and all 5 Python worker tests passed.
- `npm run quality-check` (lint/format/types), renderer production build and `git diff --check` passed. Existing lint and bundle-size warnings remain. The full repository test suite was not run.
- Real pretrained Russian/English synthesis remains unverified: model download is blocked by the cloud environment's Hugging Face network policy, and model-license confirmation is required before downloading weights for testing.
- Windows installer, interactive Windows playback and CUDA are unverified. The Windows release workflow now checks the Python runtime/worker and new regressions before packaging.
- GitHub API access is blocked by the current cloud proxy, preventing workflow dispatch, artifact verification and release publication. The required network additions are saved in the environment configuration draft; saving a draft does not apply them to the running machine.

Do not publish this release as verified until the real-model smoke tests and Windows release workflow succeed. The prepared version is a stable `0.6.0`; it is not marked as a prerelease by the release workflow.
