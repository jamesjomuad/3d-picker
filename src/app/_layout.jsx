import { Stack, ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useImmersiveStatusBar } from '@/hooks/use-immersive-status-bar';
import { useSettingsStore } from '@/store/settingsStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useImmersiveStatusBar();
  // Load saved settings once at the root so the theme override is in place
  // before any screen reads it.
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
        <Stack.Screen
          name="fun-pick"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.5, 0.75, 1],
            sheetInitialDetentIndex: 2,
            sheetGrabberVisible: false,
            sheetCornerRadius: BorderRadius.lg,
            sheetLargestUndimmedDetentIndex: 1,
            sheetExpandsWhenScrolledToEdge: false,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
