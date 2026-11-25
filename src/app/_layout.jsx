import { Stack, ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BorderRadius, Colors, Typography } from '@/constants/theme';
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
  const palette = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const infoScreenOptions = {
    headerShown: true,
    headerStyle: { backgroundColor: palette.background },
    headerTintColor: palette.text,
    headerShadowVisible: false,
    headerTitleStyle: { fontWeight: Typography.weight.semibold },
  };

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
        <Stack.Screen
          name="changelog"
          options={{ ...infoScreenOptions, title: "What's New" }}
        />
        <Stack.Screen
          name="privacy-policy"
          options={{ ...infoScreenOptions, title: 'Privacy Policy' }}
        />
        <Stack.Screen
          name="licenses"
          options={{ ...infoScreenOptions, title: 'Open-Source Licenses' }}
        />
      </Stack>
    </ThemeProvider>
  );
}
