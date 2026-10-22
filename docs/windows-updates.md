# Windows updates

The tray's **Check for Updates** action checks public releases in
`redmoondz/hina-desktop`. It offers a download, then asks before restarting to
install. Failed checks and downloads show a retryable error. A staged update can
be installed by using the tray action again.

Use the Windows NSIS installer for the installed update flow. The former
`win-unpacked` CI artifact is a folder intended for manual testing; it is not an
installer and cannot reliably replace itself in place.

To prepare a release:

1. Increase `version` in `package.json` and `package-lock.json` together.
2. Run **Hina Desktop Windows** in GitHub Actions. Leave **Create a draft
   release** off to build a downloadable installer artifact only, or turn it on
   to prepare a draft release after the build succeeds.
3. Test the generated `.exe` on Windows. Inspect the draft and keep the installer,
   its `.blockmap`, and `latest.yml` together in the release assets.
4. Publish the draft when ready. Draft releases are invisible to public update
   checks. Existing installs can then download and install the newer version
   through the tray without using Git.

The workflow builds an unsigned installer, so Windows may show a SmartScreen
warning on first installation. It does not disable updater integrity checks or
require application users to supply a GitHub token. Code signing can be added
later with a signing certificate. The separate upstream `Release` workflow has
additional platform and service secret requirements; use the Hina workflow for
this Windows distribution.

See the [electron-builder update documentation](https://www.electron.build/v26/docs/features/auto-update/)
for supported packaging and release metadata requirements.
