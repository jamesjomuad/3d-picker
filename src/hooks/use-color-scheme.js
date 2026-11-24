import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useSettingsStore } from '@/store/settingsStore';

/**
 * Resolved color scheme.
 *
 * Returns the OS scheme unless the user picked Light or Dark in Settings
 * (`themeMode` in the settings store), in which case that choice wins.
 * Components subscribing to the store re-render the moment the mode
 * changes, so the whole app follows the toggle without a reload; before
 * the store has loaded it holds 'system', which is the system scheme
 * itself. The web variant lives in use-color-scheme.web.js.
 */
export function useColorScheme() {
  const systemScheme = useSystemColorScheme();
  const themeMode = useSettingsStore((state) => state.themeMode);

  return themeMode === 'system' ? systemScheme : themeMode;
}
