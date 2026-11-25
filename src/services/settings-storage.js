import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Settings persistence
 *
 * Same tolerant, versioned-JSON pattern as the basket and board library:
 * one key holds the whole preferences document, a corrupt or missing read
 * falls back to the defaults, and nothing here knows about stores or React.
 *
 * The stored shape is:
 *   { version: 1, themeMode: 'system' | 'light' | 'dark' }
 */

const STORAGE_KEY = '***';

/** Theme modes the app can render. */
export const THEME_MODES = ['system', 'light', 'dark'];

export const DEFAULT_SETTINGS = {
  themeMode: 'system',
};

/**
 * Loads the saved settings. Any unreadable, malformed or unknown value
 * falls back to its default instead of throwing or poisoning the store.
 * @returns {Promise<{ themeMode: string }>}
 */
export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      return { ...DEFAULT_SETTINGS };
    }

    return {
      themeMode: THEME_MODES.includes(parsed.themeMode)
        ? parsed.themeMode
        : DEFAULT_SETTINGS.themeMode,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Persists the settings document.
 * @param {{ themeMode: string }} settings
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  const document = {
    version: 1,
    themeMode: settings.themeMode,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(document));
}
