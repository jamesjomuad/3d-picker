import { InfoLink, InfoScreen } from '@/components/info/info-screen';

const SECTIONS = [
  {
    title: 'No account, no cloud',
    items: [
      {
        text: 'You do not sign in',
        detail: '3D Picker has no accounts, authentication or user profiles.',
      },
      {
        text: 'Your data stays on this device',
        detail:
          'Boards, saved picks, settings and exported backups are stored locally. There is no backend, database or cloud synchronization.',
      },
      {
        text: 'No analytics or advertising',
        detail:
          'The app does not embed trackers, analytics SDKs, ad networks or crash-reporting uploads.',
      },
    ],
  },
  {
    title: 'What the app sends out',
    items: [
      {
        text: 'Results are fetched only when you open or refresh them',
        detail:
          'The Results page requests public 3DL draw data from Lottomatik. No boards, picks, settings or personal data are sent with that request.',
        icon: 'info.circle',
      },
      {
        text: 'Sharing is your choice',
        detail:
          'The share sheet and backup file picker open only after you tap Export Backup, Import Backup or Share 3D Picker.',
      },
      {
        text: 'External links open in your browser',
        detail:
          'Release, source and license links open outside the app through the system browser.',
      },
    ],
  },
  {
    title: 'Your controls',
    items: [
      {
        text: 'Clear App Data',
        detail:
          'Settings → Data & Storage → Clear App Data erases local boards, saved picks and settings, then restores defaults.',
      },
      {
        text: 'Backups',
        detail:
          'Export Backup writes a JSON file you can keep or share. Import Backup replaces local boards and saved picks only after you confirm.',
      },
    ],
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <InfoScreen
      title="Privacy Policy"
      intro="Plain-language privacy practices for the local-first 3D Picker app."
      sections={SECTIONS}
      footer={
        <InfoLink href="https://github.com/jamesjomuad/3d-picker">
          View the source on GitHub
        </InfoLink>
      }
    />
  );
}
