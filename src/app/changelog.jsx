import { InfoLink, InfoScreen } from '@/components/info/info-screen';

const SECTIONS = [
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
          <InfoLink href="https://github.com/jamesjomuad/3d-picker/releases/tag/v1.2.0">
            View v1.2.0 release notes
          </InfoLink>
          <InfoLink href="https://github.com/jamesjomuad/3d-picker/releases">
            View all releases
          </InfoLink>
        </>
      }
    />
  );
}
