/**
 * Tests for the App Settings store
 */

import { saveSettings } from '@/services/settings-storage';
import { useSettingsStore } from '@/store/settingsStore';

// Mock the persistence service: what is under test is the validation and
// the write policy, not AsyncStorage. The constants are redefined here
// (rather than requireActual) so the real service module — and its
// AsyncStorage import — never loads.
let mockStored = null;
jest.mock('@/services/settings-storage', () => ({
  THEME_MODES: ['system', 'light', 'dark'],
  FUN_PICK_DIRECTION_VALUES: ['all', 'orthogonal', 'diagonal'],
  FUN_PICK_TYPE_VALUES: ['2D', '3D', '4D'],
  DEFAULT_SETTINGS: { themeMode: 'system', funPickDirection: 'all', funPickType: '3D' },
  loadSettings: jest.fn(async () => mockStored),
  saveSettings: jest.fn(async () => {}),
}));

/** Helper to reset the store to initial state */
function resetStore() {
  useSettingsStore.setState({
    themeMode: 'system',
    funPickDirection: 'all',
    funPickType: '3D',
    isLoaded: false,
  });
}

/** Let the fire-and-forget persist promise settle. */
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('settingsStore', () => {
  beforeEach(() => {
    resetStore();
    mockStored = null;
    jest.clearAllMocks();
  });

  it('starts on defaults and reports itself unloaded', () => {
    const { themeMode, funPickDirection, funPickType, isLoaded } = useSettingsStore.getState();
    expect(themeMode).toBe('system');
    expect(funPickDirection).toBe('all');
    expect(funPickType).toBe('3D');
    expect(isLoaded).toBe(false);
  });

  it('loads saved settings once and never re-reads storage', async () => {
    mockStored = { themeMode: 'dark', funPickDirection: 'diagonal', funPickType: '2D' };

    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().themeMode).toBe('dark');
    expect(useSettingsStore.getState().funPickDirection).toBe('diagonal');
    expect(useSettingsStore.getState().funPickType).toBe('2D');
    expect(useSettingsStore.getState().isLoaded).toBe(true);

    // A second mount must not clobber newer in-memory values.
    mockStored = { themeMode: 'light', funPickDirection: 'all', funPickType: '4D' };
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().themeMode).toBe('dark');
  });

  it('applies and persists a valid theme mode', async () => {
    useSettingsStore.getState().setThemeMode('light');
    await flush();

    expect(useSettingsStore.getState().themeMode).toBe('light');
    expect(saveSettings).toHaveBeenCalledTimes(1);
    expect(saveSettings).toHaveBeenCalledWith({
      themeMode: 'light',
      funPickDirection: 'all',
      funPickType: '3D',
    });
  });

  it('refuses unknown values without state change or write', async () => {
    useSettingsStore.getState().setThemeMode('neon');
    useSettingsStore.getState().setFunPickDirection('up-left');
    useSettingsStore.getState().setFunPickType('5D');
    await flush();

    const state = useSettingsStore.getState();
    expect(state.themeMode).toBe('system');
    expect(state.funPickDirection).toBe('all');
    expect(state.funPickType).toBe('3D');
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('applies and persists the Fun Pick defaults', async () => {
    useSettingsStore.getState().setFunPickDirection('orthogonal');
    useSettingsStore.getState().setFunPickType('4D');
    await flush();

    expect(useSettingsStore.getState().funPickDirection).toBe('orthogonal');
    expect(useSettingsStore.getState().funPickType).toBe('4D');
    expect(saveSettings).toHaveBeenLastCalledWith({
      themeMode: 'system',
      funPickDirection: 'orthogonal',
      funPickType: '4D',
    });
  });

  it('reset returns to defaults without writing storage', async () => {
    useSettingsStore.getState().setThemeMode('dark');
    await flush();
    const writesBefore = saveSettings.mock.calls.length;

    useSettingsStore.getState().reset();
    await flush();

    const state = useSettingsStore.getState();
    expect(state.themeMode).toBe('system');
    expect(state.funPickDirection).toBe('all');
    expect(state.funPickType).toBe('3D');
    expect(state.isLoaded).toBe(true);
    expect(saveSettings).toHaveBeenCalledTimes(writesBefore);
  });
});
