# Application logo validation

The supplied `~/Documents/logo.png` is preserved byte-for-byte as `src/assets/logo.png` and displayed in the README. SHA-256: `c10a6d7af2c5fef515faf55ad78ab0495f1c698ddfd4b30c0021ccef01786a49`.

The generated assets cover the application icon, Windows tray and executable icon, macOS ICNS and monochrome tray template, Linux PNG, and Apple Icon Composer layer. Windows ICO entries were checked at 16, 24, 32, 48, 64, 128, and 256 pixels; ICNS entries at 256, 512, and 1024 pixels. The settings header and remaining brand image import use the new icon.

Validation:

- `npm run quality-check` and `npm run build:renderer`.
- Browser smoke checks at 1280 and 390 pixels, light and dark themes: no page or console errors and no horizontal overflow. Screenshots and results are in `evidence/logo/`.
- Windows renderer build, TypeScript check, and unsigned NSIS build in `build-0.3.1/dist-logo`, separate from the published release artifacts.
- Packaged SQLite, updater, and Connector dependency checks passed before local installation. The installed app loaded the 512-pixel logo without page errors; see `evidence/logo/installed-windows.json` and its screenshot.

The local build retains version 0.3.1. Published GitHub release files are unchanged.
