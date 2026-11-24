# Changelog

All notable changes to 3D Picker are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [semantic versioning](https://semver.org/).

## [1.1.0] - 2026-11-24

### Added
- **Settings screen rebuilt** — grouped panels (Appearance, Notifications, Data & Storage, Share & Updates, About) built from reusable `SettingsSection`, `SettingsRow`, `ComingSoonCard` and `OptionSheet` components.
- **Theme mode** — System / Light / Dark, persisted on-device and applied app-wide, including the bottom tabs.
- **Check for Update** — compares the installed version with the latest GitHub release and links the release page for the download.
- **Clear App Data** — confirmation-gated factory reset of boards, collection and settings.
- **Share 3D Picker** — native Android share sheet from Settings.
- **Collection tab** — the Selection Basket is now its own tab: every saved pick with the date and time it was added, share to other apps, delete individual picks.
- **Add to Collection** — one tap collects every combination currently shown in Fun Pick results (respects the active filter and search).
- **Fun Pick sequence search** — comma-separated sequences, each matched as a consecutive in-order run of a combination.
- **Exhaustive Fun Pick generation** — every valid angle walk is generated instead of a sample, with digit filters (With 0 / 1 / 2) and L-shape pattern filters (Г ㄱ ┘ L); results render progressively via "Show more".
- Board cards gained a favorite star, relative "updated" time, and an Active badge.
- Foldable card component with animated expand/collapse, used across selection, search and settings cards.
- Selected-cells insights row: cells, digits, combinations and start counts.

### Changed
- Fun Pick rules (type and direction) moved into a collapsible card; board columns labeled A–J with Excel-style cell references.
- Selected Cells card hides when empty, with Clear moved into its header.
- Bottom tab icons: Collection uses a list glyph, Settings its own gear icon; Collection shows the saved-picks count as a badge.

### Fixed
- Android navigation bar stays visible (only the status bar is hidden now).
- Duplicated boards appear in the library immediately.
- The board "⋯ More" options sheet now dismisses on outside tap, hardware back, or Cancel.
- The seeded Angle Board stores its real digits instead of an all-zero grid; repairs devices already affected.
- Drag selection on the Angle Board: correct coordinate space, stable responder, no ScrollView interception.
- Valid URL scheme and Android package/versionCode for builds.

## [1.0.0]

### Added
- Initial local-first Android release.
- **Angle Board** — 10×10 digit grid with Excel-style drag selection and fill.
- **Combination search** — find digit paths across the board.
- **Fun Pick** — angle-walk generator card with the 90-degree bend rule, direction options, and copy-to-clipboard.
- **Board library** — editable grids, board creation, persistence on-device, boards screen.
- Reusable UI primitives (button, input, text, confirm dialog) with light/dark theming.

[1.1.0]: https://github.com/jamesjomuad/3d-picker/releases/tag/v1.1.0
[1.0.0]: https://github.com/jamesjomuad/3d-picker/releases/tag/v1.0.0
