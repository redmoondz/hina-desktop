# Hina assets

The neutral microphone is a placeholder until a custom icon is supplied.

`node scripts/generate-hina-icons.cjs` regenerates the application PNG, Windows ICO, macOS ICNS, tray template PNG, and the `hina.icon/Assets/ICON.png` layer for Apple's Icon Composer.

On macOS with Xcode, `node scripts/compile-macos-icon.js` compiles `hina.icon` into `Assets.car` using the `hina` app icon name. The application otherwise uses its generated ICNS fallback.
