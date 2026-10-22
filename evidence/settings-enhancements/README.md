# Hina Desktop 0.3.0 validation

Verified on 2026-10-22 using Node 24.22.0 in the WSL checkout.

| Check                                                                              | Result                                                                 |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `npm run quality-check`                                                            | Passed: ESLint, Prettier and TypeScript; existing lint warnings remain |
| `npm run build:renderer`                                                           | Passed; existing large-chunk warnings remain                           |
| Core settings, Connector, tray and updater tests                                   | 33 passed                                                              |
| Broader recording, hotkey, media, analytics and UI regression tests                | 676 passed, 24 skipped, zero failed                                    |
| Final streaming startup/stop, routing and settlement tests                         | 143 passed, zero failed                                                |
| Built renderer, 1280 and 390 px, light and dark                                    | Four scenarios passed; zero console/page errors and no page overflow   |
| JSON export/import, switch interaction, invalid-import rejection, dashboard action | Passed in all four browser scenarios                                   |
| Local WSL Connector `/health`                                                      | HTTP 200, agent `hina`                                                 |
| Local WSL OpenClaw Control                                                         | HTTP 200                                                               |
| Public GitHub releases                                                             | None existed at verification time                                      |

The broader regression run preceded the final streaming-stop refinements. Those
refinements were then covered by the final 143-test run. The full inherited
upstream suite is not claimed green by this report.

The screenshots and `browser-results.json` use the real production renderer
with a simulated Electron bridge and example data. Run
`scripts/verify-hina-settings.mjs` to repeat that check. Local command logs are
ignored by Git; no credentials or paid agent requests were used for validation.

An interactive Windows microphone session, actual media-player playback and
installation of the Windows NSIS build were not executed in this checkout.
No source push, workflow run or GitHub release publication was performed.

See [behavior and limitations](../../docs/settings-enhancements.md) and
[Windows release instructions](../../docs/windows-updates.md).
