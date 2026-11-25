import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
} from '../backup';
import { saveBasket } from '../basket-storage';
import { saveLibrary } from '../board-storage';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
      setItem: jest.fn(async (key, value) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key) => {
        store.delete(key);
      }),
      clear: jest.fn(async () => {
        store.clear();
      }),
    },
  };
});

const BOARD = {
  id: 'board-1',
  name: 'Test Board',
  isFavorite: true,
  grid: Array.from({ length: 10 }, () => Array(10).fill(3)),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const LIBRARY = {
  version: 1,
  activeBoardId: BOARD.id,
  boards: [BOARD],
};

const ENTRIES = [
  {
    digits: '037',
    path: [{ row: 0, column: 0 }],
    addedAt: '2026-01-03T00:00:00.000Z',
  },
];

describe('backup service', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('creates a versioned backup from local library and basket data', async () => {
    await saveLibrary(LIBRARY);
    await saveBasket(ENTRIES);

    const backup = await createBackup();

    expect(backup.format).toBe('3d-picker-backup');
    expect(backup.version).toBe(1);
    expect(backup.data.library).toEqual(LIBRARY);
    expect(backup.data.basket).toEqual({ version: 1, entries: ENTRIES });
  });

  it('parses a backup it created', async () => {
    await saveLibrary(LIBRARY);
    await saveBasket(ENTRIES);
    const backup = await createBackup();

    const result = parseBackup(serializeBackup(backup));

    expect(result.valid).toBe(true);
    expect(result.backup.data.library.boards).toHaveLength(1);
    expect(result.backup.data.basket.entries).toHaveLength(1);
  });

  it('rejects files that are not 3D Picker backups', () => {
    const result = parseBackup(JSON.stringify({ hello: 'world' }));

    expect(result).toEqual({
      valid: false,
      error: 'The selected file is not a 3D Picker backup.',
    });
  });

  it('rejects a backup with an invalid board grid', () => {
    const backup = {
      format: '3d-picker-backup',
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: {
        library: {
          version: 1,
          activeBoardId: BOARD.id,
          boards: [{ ...BOARD, grid: [[10]] }],
        },
        basket: { version: 1, entries: [] },
      },
    };

    const result = parseBackup(JSON.stringify(backup));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid board');
  });

  it('rejects an active board that is not in the backup', () => {
    const backup = {
      format: '3d-picker-backup',
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: {
        library: { version: 1, activeBoardId: 'missing', boards: [BOARD] },
        basket: { version: 1, entries: [] },
      },
    };

    const result = parseBackup(JSON.stringify(backup));

    expect(result).toEqual({
      valid: false,
      error: 'The active board is not in the backup.',
    });
  });

  it('restores validated library and basket data', async () => {
    const parsed = parseBackup(
      serializeBackup({
        format: '3d-picker-backup',
        version: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        data: {
          library: { version: 1, activeBoardId: BOARD.id, boards: [BOARD] },
          basket: { version: 1, entries: ENTRIES },
        },
      })
    );

    expect(parsed.valid).toBe(true);
    await restoreBackup(parsed.backup);

    const backup = await createBackup();
    expect(backup.data.library).toEqual(LIBRARY);
    expect(backup.data.basket).toEqual({ version: 1, entries: ENTRIES });
  });
});
