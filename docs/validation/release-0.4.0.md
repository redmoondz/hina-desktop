# Hina Desktop 0.4.0 update acceptance

Release source: `b5459390831614bb43e860d536b2ddbda9de835e`.

Published release: <https://github.com/redmoondz/hina-desktop/releases/tag/v0.4.0>.

## Release validation

- Release version, manifest and lockfile agree on `0.4.0`.
- All 19 updater, release-asset and text-input assertions passed.
- Changed-file formatting and diff checks passed.
- Windows renderer and unsigned x64 NSIS installer builds succeeded.
- Asset validation checked version, exact filename, size, SHA-512 and blockmap.
- The uploaded draft metadata matched the local metadata before publication.

## Real installed update

The actual installed application's **Check for Updates** tray menu item was
invoked through Electron's main-process inspector. Only dialog confirmations
were automated. The GitHub provider, download verification, NSIS installer and
restart used the real public release without a replacement update server.

| Step                               | Result                                                 |
| ---------------------------------- | ------------------------------------------------------ |
| Initial installed version          | `0.3.1`                                                |
| Check for Updates                  | Offers `0.4.0` with readable dialog text               |
| Download                           | Completes and sets the updater's downloaded flag       |
| Install & Restart                  | Starts the real NSIS installer and restarts the app    |
| Installed executable after restart | `0.4.0.0`, running                                     |
| Check for Updates in `0.4.0`       | Shows `No Updates` and `You're on the latest version.` |

Checks immediately after publication briefly saw the previous GitHub release;
repeating after the public feed propagated found `0.4.0` without a code change.

Evidence: [update transition](../../evidence/releases/0.4.0/github-update.json)
and [current-version check](../../evidence/releases/0.4.0/github-current.json).

No agent/model API requests were made. This verifies the update path, not
interactive microphone or voice-command behavior.
