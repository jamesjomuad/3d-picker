import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';

/**
 * Immersive status bar on Android.
 *
 * Hides the status bar while the app runs so the board gains the top of
 * the screen. The navigation bar stays visible — back, home and recents
 * remain available. Applied once at launch from the root layout and never
 * undone, so it survives tab and screen navigation — the bar is window
 * state, not per-screen state.
 *
 * The `AppState` listener exists because Android clears system UI
 * visibility flags while another app is in the foreground: after a
 * background round trip the status bar would be back unless it is hidden
 * again on resume.
 *
 * No-op on iOS and web — this is an Android system-UI feature, and the
 * library's non-Android stub only warns that the method is unavailable.
 */
export function useImmersiveStatusBar() {
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }

    const hideStatusBar = () => {
      StatusBar.setHidden(true);
    };

    hideStatusBar();

    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        hideStatusBar();
      }
    });

    return () => subscription.remove();
  }, []);
}
