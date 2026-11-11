# Hina Desktop GitHub Actions

The desktop CI workflow runs quality checks, translation validation, the npm
security audit, and the test suite on pushes to `main` and pull requests. It
then builds Windows x64, Linux x64, and macOS arm64 and x64 packages. CodeQL
performs a separate security analysis.

A push of a stable tag such as `v1.2.3` starts the release workflow. The tag
must match the version in `package.json`. The same CI workflow must succeed for
every platform before the release job collects and checks the installers and
update metadata. It creates a draft, uploads the files, and publishes it once
all uploads succeed. Existing releases are not overwritten.

Windows builds include the NSIS installer, blockmap and `latest.yml`. Linux
builds include AppImage, deb, rpm and tar.gz packages and AppImage update
metadata. macOS builds include DMG and ZIP packages and separate update
metadata for each architecture.

The current configuration produces unsigned Windows and macOS builds. macOS
Gatekeeper and Windows SmartScreen may warn users, and macOS automatic updates
require a signed application. Configure and test signing and notarization
before relying on macOS automatic updates.

The release build still downloads some native helper binaries from upstream
OpenWhispr releases because those helpers are used by the application. They
are not Hina release automation, and should only be replaced after equivalent
Hina-built binaries have been published and tested on all supported platforms.
The mobile app, upstream Nix and WinGet publication workflows, and paid API
canaries are not part of Hina CI.
