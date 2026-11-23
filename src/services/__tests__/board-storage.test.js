import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadLibrary, saveLibrary, clearLibrary } from '../board-storage';

// Small in-memory stand-in: the service only needs get/set/remove.
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
    },
  };
});

const LEGACY_KEY = 'board…egacy-migrated';
const SEED_NAME = 'Angle Board 001';
const ZERO_GRID = Array.from({ length: 10 }, () => Array(10).fill(0));

describe('board storage', () => {
  beforeEach(async () => {
    await clearLibrary();
    jest.clearAllMocks();
  });

  it('seeds the library from the static JSON on a fresh install', async () => {
    const library = await loadLibrary();

    expect(library.boards).toHaveLength(1);
    expect(library.boards[0].name).toBe(SEED_NAME);
    expect(library.boards[0].id).toBe('board-001');
    // The shipped seed contains real digits, not an all-zero grid.
    expect(library.boards[0].grid[0].slice(0, 4)).toEqual([6, 0, 3, 8]);
  });

  it('restores the seed when a past run persisted the all-zero fallback', async () => {
    // Recreate the broken state: legacy flag already written, storage holds
    // the zero-filled fallback under the seed name with a generated id.
    await AsyncStorage.setItem(LEGACY_KEY, 'true');
    await saveLibrary({
      version: 1,
      activeBoardId: 'board-lzx-0001',
      boards: [
        {
          id: 'board-lzx-0001',
          name: SEED_NAME,
          isFavorite: false,
          grid: ZERO_GRID.map((row) => [...row]),
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const library = await loadLibrary();

    expect(library.boards[0].grid).not.toEqual(ZERO_GRID);
    expect(library.boards[0].grid[0].slice(0, 4)).toEqual([6, 0, 3, 8]);

    // The fix is durable: the next launch loads the restored library.
    const reloaded = await loadLibrary();
    expect(reloaded.boards[0].id).toBe('board-001');
    expect(reloaded.boards[0].grid[0].slice(0, 4)).toEqual([6, 0, 3, 8]);
  });

  it('does not touch a stored library that has real content', async () => {
    const userBoard = {
      id: 'board-user-1',
      name: 'My Board',
      isFavorite: true,
      grid: ZERO_GRID.map((row, r) => row.map((_, c) => (r + c) % 10)),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    await saveLibrary({ version: 1, activeBoardId: userBoard.id, boards: [userBoard] });

    const library = await loadLibrary();

    expect(library.boards).toEqual([userBoard]);
  });

  it('leaves an all-zero board alone when it is not the seed fallback', async () => {
    // An intentionally blank board (or the deleteBoard replacement) keeps its
    // zeros as soon as it carries a different name.
    const blank = {
      id: 'board-user-2',
      name: 'Blank Workspace',
      isFavorite: false,
      grid: ZERO_GRID.map((row) => [...row]),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    await saveLibrary({ version: 1, activeBoardId: blank.id, boards: [blank] });

    const library = await loadLibrary();

    expect(library.boards).toEqual([blank]);
  });
});
