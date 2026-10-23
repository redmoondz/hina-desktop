# Microphone gain and local test verification

Goal: adjust and preview microphone input consistently for dictation and assistant voice input.

## Rules

1. Gain runs before batch/streaming dictation, assistant voice input and local test recording. Meeting capture is outside scope.
2. Automatic mode targets speech RMS 0.12, caps amplification at 8x, and returns toward unity below RMS 0.003. Output peaks are limited to 0.98.
3. Manual gain ranges from 0% to 400%; 100% is unity. The saved manual value is retained while automatic mode disables its slider.
4. Local Windows installations default to automatic mode to preserve quiet-microphone compensation. Other platforms default to manual unity. An explicitly saved choice wins.
5. Tests run only on request, stop within 60 seconds and never upload audio. Stop releases the mic; playback uses a revocable local blob URL.
6. Device changes, errors and leaving settings dispose capture resources. A pending acquisition resolving after disposal is stopped immediately.
7. Processing preserves device identity, raw mute state and health events for dictation recovery. Native AGC remains disabled.
8. Audio context startup has a 1.5-second resume deadline and releases capture on failure.

## Acceptance cases

| Case | Input | Expected result | Evidence |
| --- | --- | --- | --- |
| Manual gain | 0%, 100%, 300% | Mute, unity, triple amplitude | Signal unit tests |
| Invalid settings | Negative, excessive, nonfinite | Clamp to 0–400%, fallback to 100% | Signal and settings tests |
| Quiet speech | RMS 0.02 | Gain rises toward target within 8x cap | Signal unit tests |
| Silence and faint noise | RMS below 0.003 | No automatic gain growth | Signal unit tests |
| Loud transient | Peak 0.9 after 8x gain | Output bounded below clipping | Signal unit tests |
| Mode switch | Automatic to manual | Retained manual value applies | Signal and settings tests |
| Device health | Raw mute/unmute/ended | State and events visible downstream | Processing unit tests |
| Cleanup | Stop or failed worklet/resume | Input and processing resources released | Processing unit tests |
| Pending acquisition | Leave settings before permission resolves | Late input stopped | Hook unit tests |
| Record/playback | Browser fake microphone | Nonzero meter, local recording and playback | Browser verification |
| Responsive themes | 1100px and 390px, light/dark | No overflow or console errors | PNG screenshots |

Browser verification used actual Chromium AudioWorklet and MediaRecorder with its synthetic audio input. Physical microphones and Windows hotkey capture require platform testing.

## Final validation

- `PATH=/usr/local/bin:/usr/bin:/bin node --import tsx --test --test-concurrency=2 'test/**/*.test.js'`: 8,688 passed, 0 failed, 37 skipped, 1 todo; 8726 total tests, 734.3 seconds.
- `npm run quality-check`: passed (existing lint warnings only).
- `npm run build:renderer`: passed, including the bundled microphone AudioWorklet asset.
- Chromium component verification: passed recording, a nonzero processed meter, local playback, auto/manual control state, light/dark themes and desktop/mobile layout; no console errors during the checks.
