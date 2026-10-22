# Hina Desktop 0.3.1: real update acceptance

Source commit: `86d34075631114c1851e9e81ace6addf4aaba2da`.

Public release: <https://github.com/redmoondz/hina-desktop/releases/tag/v0.3.1>.

## Fixes

- Tray update strings now resolve under `settingsPage.general.updates`, using
  the real application translations rather than displaying keys.
- An empty release feed has a distinct informational result. Network failures
  and missing release metadata remain errors.
- The installer filename exactly matches `latest.yml`. Release validation
  checks its name, version, byte count, SHA-512 and blockmap.

## Automated verification

- 29 focused assertions passed: tray dialogs, actual English/Russian resources,
  release-feed outcomes, updater lifecycle and release assets.
- `npm run quality-check` passed: ESLint, formatting and TypeScript. Existing
  lint warnings remain.
- Windows TypeScript and 26 tray/updater assertions passed.
- Windows NSIS packaging succeeded. Packaged SQLite, updater and Connector
  dependencies loaded successfully.
- The uploaded draft's asset names and byte counts matched the local build;
  downloaded `latest.yml` matched byte-for-byte before publication.

## Installed application acceptance

The real installed `0.3.0` tray handler was invoked through Electron's main
process inspector. Only dialog confirmation was automated. The real updater,
GitHub provider, public release URLs, download verification and NSIS installer
were used; no fake release or replacement update server was supplied.

| Step                                                       | Result                                                                |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Installed `0.3.0` checks GitHub                            | Offers `0.3.1`                                                        |
| Its updater downloads the installer                        | Completes and marks it verified/downloaded                            |
| Its tray handler requests installation                     | Real updater invokes NSIS and restart                                 |
| Installed executable after restart                         | `0.3.1.0`, running                                                    |
| Updated app checks GitHub again                            | Informational `No Updates` dialog with readable description           |
| One update request blocked in updater-only network session | Error dialog with readable title and description, no translation keys |
| Request blocker removed, real check repeated               | Succeeds and reports current version                                  |

The old `0.3.0` dialogs in the transition trace still contain the original keys;
the `0.3.1` success and failure traces contain the corrected text. Error
acceptance used an actual cancelled Electron network request scoped to the
updater partition, and the blocker was removed afterwards. The application
profile, saved Connector credentials and model cache were preserved.

Evidence:

- [Real transition](../../evidence/settings-enhancements/github-update-0.3.1.json)
- [Updated current-version dialog](../../evidence/settings-enhancements/github-current-0.3.1.json)
- [Updated error dialog](../../evidence/settings-enhancements/github-offline-0.3.1.json)

No agent/model API turns were used. This update check does not claim interactive
microphone or media-player acceptance.
