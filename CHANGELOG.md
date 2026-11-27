# Changelog

All notable changes to 3D Picker are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [semantic versioning](https://semver.org/).

## [1.4.0] - 2026-11-27

### Added
- **Configurable grid size** — resize boards from 2–20 rows and 2–12 columns in the visual editor.
- **Board card options** — tap a board card to open More options instead of switching boards.
- **Set Board** — choose the active board from the Boards page and see a success toast.
- **Board preview** — open a read-only grid preview from board options.

### Changed
- Angle Board selection now requires a double tap; double tap and drag extends the range.
- Editable cells open with an empty field on double tap.
- Edit board action buttons share one compact row in both editor modes.

### Fixed
- JSON Apply validates the current text without requiring Preview first.
- JSON board output keeps each grid row on one line.
- Visual cell edits save before closing the sheet, switching editors, or opening Replace.
- Toast uses a valid Android accessibility role.

## [1.3.0] - 2026-11-25

### Added
- **Backup and restore** — export saved boards and collection as versioned JSON, then import with strict validation and destructive confirmation.
- **In-app info pages** — What's New, Privacy Policy and open-source licenses are available from Settings.

### Changed
- Selected Cells Insights now sits in a simple themed bordered card.
- Active dark-mode tab icons use the app primary color.
- Clear App Data now clears cached draw results in memory as well as on device.

### Fixed
- Foldable cards and option sheets no longer nest web buttons, avoiding React hydration warnings on web.

## [1.2.0] - 2026-11-25

### Added
- **JSON board editor** — advanced edit mode with syntax highlighting, line numbers, line/column errors, preview, and apply. Visual Editor stays the default.
- **New board naming** — New Board asks for a name before creating a board.
- **Fun Pick bottom sheet** — generate and filter picks while the board stays visible.
- **Multi-select Fun Pick filters** — digit, direction and L-pattern filters each support multiple choices, with Distinct grouping.
- **Saved-pick plotting** — Collection detail sheets preview a saved pick on the active board and highlight matching paths without changing the board.
- **Numeric search keyboard** — Android combination search opens the numeric keypad.

### Changed
- Board edit view puts the grid at the top and groups all actions in a fixed bottom footer.
- Replace tool uses clearer action buttons and still matches against the original edit snapshot.
- Fun Pick generation is fixed at 3D; direction chips filter results.
- Collection basket list is virtualized and share text is shorter.
- Board cards no longer draw the temporary highlight border.

### Fixed
- Board More-menu actions now work: Open, Edit, Rename, Duplicate, Favorite, Delete and Cancel.
- Dialogs and option sheets respond to outside taps, hardware back and Cancel.
- Duplicated boards deep-copy the grid and do not inherit favorite or active status.

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

[1.4.0]: https://github.com/jamesjomuad/3d-picker/releases/tag/v1.4.0
[1.3.0]: https://github.com/jamesjomuad/3d-picker/releases/tag/v1.3.0
[1.2.0]: https://github.com/jamesjomuad/3d-picker/releases/tag/v1.2.0
[1.1.0]: https://github.com/jamesjomuad/3d-picker/releases/tag/v1.1.0
[1.0.0]: https://github.com/jamesjomuad/3d-picker/releases/tag/v1.0.0
