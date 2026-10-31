# Local XTTS v2 speech

In Hina Settings → Speech, choose **XTTS v2**. Windows system voices remain the default until explicitly changed.

1. Install 64-bit Python 3.10–3.12. On Windows the installer uses `py -3.11` by default; use **Select Python executable** for a different supported Python installation.
2. Choose CPU or NVIDIA CUDA. CPU needs no GPU; generation can be substantially slower than playback. CUDA installs PyTorch's CUDA 12.8 wheels and requires a compatible NVIDIA GPU/driver. Several GB of free space and an Internet connection are required during setup.
3. Read the linked model license and confirm your rights for the intended use. Click **Install / repair XTTS v2** and keep Hina open. The Python environment, dependencies and model are installed under the Hina user-data directory (`xtts-v2/`), outside the application bundle.
4. Click **Check model / load voices**. Choose a built-in voice or a clean 3–30 second WAV recording (one speaker, no music, under 20 MB) for voice conditioning. Use only recordings you have permission to use.
5. Choose Russian, English or another supported language, speed (0.5–2), sampling temperature (0.1–1) and volume. Preview the voice before enabling routine use. Temperature varies sampling; it is not a guaranteed emotion control. Voice character comes from the selected voice/sample; there is no independent pitch slider.

Model files are downloaded through the upstream Coqui model manager from `tts-hub/XTTS-v2` on Hugging Face. Network/TLS verification is not disabled. CPML model weights are not distributed in the Hina installer and are separate from the application's MIT license. CPML restricts commercial use unless appropriate rights have been obtained; see https://tts-hub.github.io/cpml.

The retained worker loads local model files directly with `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1`. Assistant text and voice recordings are passed to this local subprocess; there is no TTS HTTP server or external synthesis provider. Generated WAV audio stays in memory. Voices and conditioning are retained between requests. Stop during generation terminates the worker; the next request reloads the model. Stop during playback pauses audio and releases its object URL. Switching engines or playing a preview stops other Hina renderer players.

After setup, generation works without a network connection. First synthesis/model checks take longer while loading weights. Changing CPU/CUDA requires **Check model**; if the appropriate PyTorch runtime is missing, repair the installation for that device. Errors never trigger a cloud fallback. A missing sample or failed model load produces a visible error; reinstall/repair or select another sample/voice. Installation failure does not write the readiness marker; a retry reuses package/model caches.

Portable JSON settings include the engine, built-in voice, language, device, speed, temperature and volume. Python executable paths, WAV paths, model weights and voice recordings are local to this machine and excluded from exports.

## Development validation

```bash
python -m pip install torch==2.8.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r resources/xtts/requirements.txt
python resources/xtts/test_worker.py
node --import tsx --test test/helpers/hinaXtts.test.js test/helpers/hinaSpeechPlayback.test.js
```

The worker unit tests use synthetic conditioning/audio to check settings, language selection, WAV encoding, reference validation and reference-cache invalidation. They do not prove pretrained speech quality. A real model test must additionally install accepted licensed weights and synthesize both Russian and English. Interactive Windows audio, CUDA acceleration and installer integration require their respective Windows/GPU environments.
