import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  replaceCollectionEntries,
} from '@/features/collection/database/collection-repository';

import {
  createBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
} from '../backup';
import { saveLibrary } from '../board-storage';

jest.mock('@/features/collection/database/collection-repository', () => ({
  getAllCollectionEntries: jest.fn(async () => mockCollectionEntries),
  replaceCollectionEntries: jest.fn(async (entries) => {
    mockCollectionEntries = entries;
    return entries;
  }),
}));

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

let mockCollectionEntries = [];

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
    id: 'entry-037',
    digits: '037',
    path: [{ row: 0, column: 0 }],
    addedAt: '2026-01-03T00:00:00.000Z',
    isFavorite: true,
  },
];

describe('backup service', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockCollectionEntries = [];
    jest.clearAllMocks();
  });

  it('creates a versioned backup from local library and basket data', async () => {
    await saveLibrary(LIBRARY);
    mockCollectionEntries = ENTRIES;

    const backup = await createBackup();

    expect(backup.format).toBe('3d-picker-backup');
    expect(backup.version).toBe(1);
    expect(backup.data.library).toEqual(LIBRARY);
    expect(backup.data.basket).toEqual({ version: 1, entries: ENTRIES });
  });

  it('parses a backup it created', async () => {
    await saveLibrary(LIBRARY);
    mockCollectionEntries = ENTRIES;
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

    expect(replaceCollectionEntries).toHaveBeenCalledWith(ENTRIES);
    const backup = await createBackup();
    expect(backup.data.library).toEqual(LIBRARY);
    expect(backup.data.basket).toEqual({ version: 1, entries: ENTRIES });
  });
});
