# Packaging, Updates, and Distribution

A macOS-native-feeling app is not complete until installation, signing, updates, and app identity are handled.

## App identity

Define early:

- app name;
- bundle identifier / app ID;
- icon set;
- document types if importing files;
- URL scheme/deep links if needed;
- copyright and About panel metadata.

Avoid names/icons that imply Apple affiliation.

## macOS signing and notarization

For distribution outside the Mac App Store, plan:

- Apple Developer Program account;
- Developer ID Application certificate;
- hardened runtime;
- entitlements;
- signing configuration;
- notarization credentials/API key;
- stapling/notarization validation in CI.

Electron Forge and Electron Builder both support signing/notarization workflows. Choose one packaging path and document it.

## Distribution formats

| Format | Use |
| --- | --- |
| `.dmg` | Common user-friendly macOS installer |
| `.zip` | Auto-update feed and simple distribution |
| Mac App Store | Only if sandboxing, entitlements, and review constraints are acceptable |
| Web/PWA | Browser deployment via HTTPS |

## Auto-updates

Auto-updates require signed macOS apps. The update UX should be calm:

- check silently;
- notify when update is ready;
- allow restart now/later;
- do not interrupt data import;
- show release notes;
- support rollback strategy for local DB migrations.

## Migrations

Local-first apps need safe migrations:

- version the local schema;
- run migrations before app UI reads new fields;
- backup critical local DB before destructive migrations;
- allow export before major upgrades;
- never block user from exporting data due to a failed optional migration.

## Icons

Use original icon art. App icons should work in:

- Dock;
- Finder;
- notifications;
- app switcher;
- PWA install surfaces;
- dark/light backgrounds.

Do not use Apple Health/Fitness icons or badges.

## Release checklist

- [ ] App menu customized.
- [ ] About panel metadata correct.
- [ ] App ID set.
- [ ] Icon generated for macOS and web/PWA.
- [ ] Privacy copy reviewed.
- [ ] Import/export tested with large files.
- [ ] App signed.
- [ ] App notarized.
- [ ] Auto-update feed configured.
- [ ] Update signature path tested.
- [ ] Local DB migration tested from previous version.
- [ ] Web build served over HTTPS.
- [ ] PWA manifest and service worker validated.
