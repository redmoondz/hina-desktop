# Hina assets

`logo.png` is the original Hina Desktop logo, also displayed in the main README. Preserve this source when regenerating platform icons.

`node scripts/generate-hina-icons.cjs` uses the installed Electron image codecs to regenerate the application PNG, Windows ICO (16–256 px), macOS ICNS (256–1024 px), monochrome tray template PNG, and the `hina.icon/Assets/ICON.png` layer for Apple's Icon Composer.

On macOS with Xcode, `node scripts/compile-macos-icon.js` compiles `hina.icon` into `Assets.car` using the `hina` app icon name. The application otherwise uses its generated ICNS fallback.
