import { InfoLink, InfoScreen } from '@/components/info/info-screen';

const SECTIONS = [
  {
    title: 'Version 2.0.0 — November 28, 2026',
    items: [
      'Cached Results with local SQLite history, pending/upcoming states, pull-to-refresh and paging',
      'Month, day and numeric search filters for cached Results',
      'Collection basket persisted in SQLite with swipe actions, bulk select and a modal sheet',
      {
        text: 'Changed',
        detail:
          'Filtered results show a dash for missing sessions. Fun Pick accepts straight board walks as well as 90-degree turns.',
        icon: 'arrow.clockwise',
      },
      {
        text: 'Fixed',
        detail:
          'Contextual sheets hide bottom tabs and pass outside taps through. Collection select mode and row highlight behave correctly.',
        icon: 'checkmark.circle',
      },
    ],
  },
  {
    title: 'Version 1.4.0 — November 27, 2026',
    items: [
      'Configurable rectangular grids: 2–20 rows and 2–12 columns in the visual editor',
      'Angle Board selection uses double tap; double tap and drag extends the range',
      'Editable cells open with an empty field on double tap',
      'Tap a board card to open More options, Set Board with a toast, or read-only Preview',
      {
        text: 'Changed',
        detail:
          'Edit board actions use one compact row. JSON board output keeps each grid row on one line.',
        icon: 'arrow.clockwise',
      },
      {
        text: 'Fixed',
        detail:
          'Visual edits save before closing or switching editors. JSON Apply validates current text without requiring Preview.',
        icon: 'checkmark.circle',
      },
    ],
  },
  {
    title: 'Version 1.3.0 — November 25, 2026',
    items: [
      'Backup and restore saved boards and collection with JSON export and import',
      'In-app pages for What’s New, Privacy Policy and open-source licenses',
      'Selected Cells Insights grouped in a simple bordered card',
      {
        text: 'Changed',
        detail:
          'Dark active tab icons use the app primary color. Clear App Data now clears cached draw results too.',
        icon: 'arrow.clockwise',
      },
      {
        text: 'Fixed',
        detail: 'Foldable cards and option sheets no longer nest web buttons.',
        icon: 'checkmark.circle',
      },
    ],
  },
  {
    title: 'Version 1.2.0 — November 25, 2026',
    items: [
      'JSON board editor with syntax highlighting, line numbers, errors, preview and apply',
      'New Board asks for a name before creating a board',
      'Fun Pick bottom sheet generates and filters picks while the board stays visible',
      'Multi-select digit, direction and L-pattern filters with Distinct grouping',
      'Collection detail sheets preview saved picks on the active board',
      'Numeric keyboard for Android combination search',
      {
        text: 'Changed',
        detail:
          'Board edit layout and fixed footer, clearer replace actions, stable generation chips, virtualized collection, shorter share text and no temporary highlight.',
        icon: 'arrow.clockwise',
      },
      {
        text: 'Fixed',
        detail:
          'More-menu actions, dialog and sheet dismissal, and copied boards now deep-copy the grid without inheriting favorite or active state.',
        icon: 'checkmark.circle',
      },
    ],
  },
  {
    title: 'Version 1.1.0 — November 24, 2026',
    items: [
      'Settings rebuilt as grouped panels with theme mode, update check, clear data and share',
      'Collection tab, Add to Collection and sequence search',
      'Exhaustive Fun Pick generation with updated rules and columns',
      'Favorite stars, relative update times and Active badges in the board library',
      'Foldable cards, selected-cell insights and refreshed bottom tab icons',
    ],
  },
  {
    title: 'Version 1.0.0',
    items: [
      'Initial release with the Angle Board, combination search, Fun Pick and board library',
      'Shared themed UI primitives for Android',
    ],
  },
];

export default function ChangelogScreen() {
  return (
    <InfoScreen
      title="What's New"
      intro="Release notes for the version installed on this device."
      sections={SECTIONS}
      footer={
        <>
          <InfoLink href="https://github.com/jamesjomuad/3d-picker/releases/tag/v2.0.0">
            View v2.0.0 release notes
          </InfoLink>
          <InfoLink href="https://github.com/jamesjomuad/3d-picker/releases">
            View all releases
          </InfoLink>
        </>
      }
    />
  );
}
