import { NativeTabs } from 'expo-router/native-tabs';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useBasketStore } from '@/store/basketStore';
import { useContextualSheetStore } from '@/store/contextualSheetStore';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const basketCount = useBasketStore((state) => state.entries.length);
  const contextualSheetVisible = useContextualSheetStore((state) => state.visible);
  const iconColor = scheme === 'dark' ? { selected: colors.primary } : undefined;

  return (
    <NativeTabs
      backgroundColor={colors.background}
      hidden={contextualSheetVisible}
      iconColor={iconColor}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Picker</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="collection">
        <NativeTabs.Trigger.Label>Collection</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle.fill" md="list_alt" />
        {basketCount > 0 && (
          <NativeTabs.Trigger.Badge>{String(basketCount)}</NativeTabs.Trigger.Badge>
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="results">
        <NativeTabs.Trigger.Label>Results</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="insert_chart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="boards">
        <NativeTabs.Trigger.Label>Boards</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" md="grid_view" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
