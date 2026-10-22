# Hina Desktop 0.3.1

- Fix untranslated keys in the tray's update dialogs and menu item.
- Distinguish an empty GitHub release feed from an up-to-date installation and
  from network or metadata failures.
- Keep development/package-manager explanations intact.
- Use installer filenames that exactly match the update metadata.
- Verify release asset names, versions, sizes, SHA-512 checksums and blockmaps
  before publication.

The Windows installer preserves the existing Hina Desktop profile and model
cache. No Connector or provider token is required to check for public updates.
