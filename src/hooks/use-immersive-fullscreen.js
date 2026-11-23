import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';

/**
 * Immersive fullscreen on Android.
 *
 * Hides the status bar and the navigation bar while the app runs, so content
 * uses the whole screen. Applied once at launch from the root layout and never
 * undone, so it survives tab and screen navigation — the bars are window state,
 * not per-screen state.
 *
 * The `AppState` listener exists because Android clears system UI visibility
 * flags while another app is in the foreground: after a background round trip
 * both bars would be back unless they are hidden again on resume.
 *
 * No-op on iOS and web — this is an Android system-UI feature, and the
 * libraries' non-Android stubs only warn that the method is unavailable.
 */
export function useImmersiveFullscreen() {
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    const hideSystemBars = () => {
      StatusBar.setHidden(true);
      NavigationBar.setHidden(true);
    };

    hideSystemBars();

    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        hideSystemBars();
      }
    });

    return () => subscription.remove();
  }, []);
}
