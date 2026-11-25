import { InfoLink, InfoScreen } from '@/components/info/info-screen';
import { OPEN_SOURCE_LICENSES } from '@/constants/licenses';

const ITEMS = OPEN_SOURCE_LICENSES.map((dependency) => ({
  text: dependency.name,
  detail: `Version ${dependency.version} · ${dependency.license} license`,
  icon: 'doc.text',
}));

export default function LicensesScreen() {
  return (
    <InfoScreen
      title="Open-Source Licenses"
      intro="Runtime dependencies bundled with this app and the licenses declared by their packages."
      sections={[{ title: 'Dependencies', items: ITEMS }]}
      footer={
        <InfoLink href="https://github.com/jamesjomuad/3d-picker">
          View the project on GitHub
        </InfoLink>
      }
    />
  );
}
