import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Settings persistence
 *
 * Same tolerant, versioned-JSON pattern as the basket and board library:
 * one key holds the whole preferences document, a corrupt or missing read
 * falls back to the defaults, and nothing here knows about stores or React.
 *
 * The stored shape is:
 *   { version: 1, themeMode: 'system' | 'light' | 'dark',
 *     funPickDirection: 'all' | 'orthogonal' | 'diagonal',
 *     funPickType: '2D' | '3D' | '4D' }
 */

const STORAGE_KEY = '***';

/** Theme modes the app can render. */
export const THEME_MODES = ['system', 'light', 'dark'];

/**
 * Fun Pick direction values. Mirrors `FUN_PICK_DIRECTIONS` in
 * `@/features/angle-board/fun-pick/fun-pick-utils`; kept as literal strings
 * here so the storage layer never imports from a feature.
 */
export const FUN_PICK_DIRECTION_VALUES = ['all', 'orthogonal', 'diagonal'];

/**
 * Fun Pick combination types (which fix the combination length). Mirrors
 * `FUN_PICK_TYPES` in the same feature file, for the same reason.
 */
export const FUN_PICK_TYPE_VALUES = ['2D', '3D', '4D'];

export const DEFAULT_SETTINGS = {
  themeMode: 'system',
  funPickDirection: 'all',
  funPickType: '3D',
};

/**
 * Loads the saved settings. Any unreadable, malformed or unknown value
 * falls back to its default instead of throwing or poisoning the store.
 * @returns {Promise<{ themeMode: string, funPickDirection: string, funPickType: string }>}
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
      funPickDirection: FUN_PICK_DIRECTION_VALUES.includes(parsed.funPickDirection)
        ? parsed.funPickDirection
        : DEFAULT_SETTINGS.funPickDirection,
      funPickType: FUN_PICK_TYPE_VALUES.includes(parsed.funPickType)
        ? parsed.funPickType
        : DEFAULT_SETTINGS.funPickType,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Persists the settings document.
 * @param {{ themeMode: string, funPickDirection: string, funPickType: string }} settings
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  const document = {
    version: 1,
    themeMode: settings.themeMode,
    funPickDirection: settings.funPickDirection,
    funPickType: settings.funPickType,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(document));
}
