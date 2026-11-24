import { Stack, ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useImmersiveStatusBar } from '@/hooks/use-immersive-status-bar';
import { useSettingsStore } from '@/store/settingsStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useImmersiveStatusBar();
  // Load saved settings once at the root so the theme override and the
  // Fun Pick default direction are in place before any screen reads them.
  const loadSettings = useSettingsStore((state) => state.load);
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
  );
}
