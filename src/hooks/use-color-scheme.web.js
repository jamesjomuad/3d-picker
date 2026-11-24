import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useSettingsStore } from '@/store/settingsStore';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 *
 * A stored themeMode (Light/Dark from Settings) overrides the OS scheme
 * once hydrated, mirroring use-color-scheme.js; pre-hydration static
 * output can only ever show the default, which is 'light'.
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const themeMode = useSettingsStore((state) => state.themeMode);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return themeMode === 'system' ? colorScheme : themeMode;
  }

  return 'light';
}
