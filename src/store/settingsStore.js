import { create } from 'zustand';

import {
  DEFAULT_SETTINGS,
  FUN_PICK_DIRECTION_VALUES,
  FUN_PICK_TYPE_VALUES,
  THEME_MODES,
  loadSettings,
  saveSettings,
} from '@/services/settings-storage';

/**
 * App Settings store
 *
 * Holds the user's persisted preferences (theme mode, Fun Pick default
 * direction and combination type). Like the basket, the data lives here and
 * through
 * `@/services/settings-storage`; everything else reads it. Only settings
 * with real effects are stored — an unknown value is refused rather than
 * written, so a bad caller can never persist a state the UI cannot render.
 */
export const useSettingsStore = create((set, get) => ({
  /** 'system' | 'light' | 'dark' */
  themeMode: DEFAULT_SETTINGS.themeMode,

  /** 'all' | 'orthogonal' | 'diagonal' */
  funPickDirection: DEFAULT_SETTINGS.funPickDirection,

  /** '2D' | '3D' | '4D' — also fixes the combination length */
  funPickType: DEFAULT_SETTINGS.funPickType,

  /** @type {boolean} Whether the saved settings have been loaded */
  isLoaded: false,

  /**
   * Loads the saved settings once. Idempotent: the root layout calls it on
   * mount and a second call never clobbers newer in-memory values.
   * @returns {Promise<void>}
   */
  load: async () => {
    if (get().isLoaded) return;
    try {
      const settings = await loadSettings();
      set({ ...settings, isLoaded: true });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ isLoaded: true });
    }
  },

  /**
   * Sets the theme mode; anything outside THEME_MODES is ignored.
   * @param {'system' | 'light' | 'dark'} mode
   */
  setThemeMode: (mode) => {
    if (!THEME_MODES.includes(mode)) return;
    set({ themeMode: mode });
    get()._persist();
  },

  /**
   * Sets the default Fun Pick direction; unknown values are ignored.
   * @param {'all' | 'orthogonal' | 'diagonal'} direction
   */
  setFunPickDirection: (direction) => {
    if (!FUN_PICK_DIRECTION_VALUES.includes(direction)) return;
    set({ funPickDirection: direction });
    get()._persist();
  },

  /**
   * Sets the default Fun Pick combination type; unknown values are ignored.
   * @param {'2D' | '3D' | '4D'} type
   */
  setFunPickType: (type) => {
    if (!FUN_PICK_TYPE_VALUES.includes(type)) return;
    set({ funPickType: type });
    get()._persist();
  },

  /**
   * Returns preferences to defaults after app data was wiped. Deliberately
   * does not persist — storage was just cleared and defaults are what an
   * empty store would load anyway.
   */
  reset: () => {
    set({ ...DEFAULT_SETTINGS, isLoaded: true });
  },

  /**
   * Persists the current preferences; failures are logged, not surfaced —
   * the in-memory settings stay applied for the session either way.
   * @returns {Promise<void>}
   */
  _persist: async () => {
    try {
      const { themeMode, funPickDirection, funPickType } = get();
      await saveSettings({ themeMode, funPickDirection, funPickType });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  },
}));
