/**
 * Tests for the Selection Basket persistence service
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadBasket, saveBasket } from '../basket-storage';

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

const KEY = 'selection-basket-v1';

/** Write a raw document straight into storage. */
async function put(doc) {
  await AsyncStorage.setItem(KEY, JSON.stringify(doc));
}

const path = [
  { row: 1, column: 1 },
  { row: 2, column: 3 },
];

describe('basket storage', () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(KEY);
    jest.clearAllMocks();
  });

  it('returns an empty basket on a fresh install', async () => {
    await expect(loadBasket()).resolves.toEqual([]);
  });

  it('round-trips entries with their addedAt', async () => {
    const addedAt = new Date(2026, 10, 23, 20, 35).toISOString();
    await saveBasket([{ digits: '074', path, addedAt }]);

    await expect(loadBasket()).resolves.toEqual([{ digits: '074', path, addedAt }]);
  });

  it('keeps legacy entries that have no addedAt', async () => {
    await put({ version: 1, entries: [{ digits: '952', path }] });

    await expect(loadBasket()).resolves.toEqual([{ digits: '952', path }]);
  });

  it('drops unparseable addedAt values but keeps the entry', async () => {
    await put({
      version: 1,
      entries: [
        { digits: '111', path, addedAt: 'not a date' },
        { digits: '222', path, addedAt: { when: 'yesterday' } },
        { digits: '333', path, addedAt: 1763900000000 },
      ],
    });

    const entries = await loadBasket();
    expect(entries[0]).toEqual({ digits: '111', path });
    expect(entries[1]).toEqual({ digits: '222', path });
    expect(entries[2].addedAt).toBe(1763900000000);
  });

  it('filters malformed entries and refuses corrupt documents', async () => {
    await put({
      version: 1,
      entries: [
        { digits: '', path },
        { digits: '074', path: [] },
        { digits: '074', path: [{ row: 1.5, column: 1 }] },
        { digits: '074', path },
      ],
    });
    await expect(loadBasket()).resolves.toEqual([{ digits: '074', path }]);

    await AsyncStorage.setItem(KEY, 'not json at all');
    await expect(loadBasket()).resolves.toEqual([]);

    await put({ version: 2, entries: [{ digits: '074', path }] });
    await expect(loadBasket()).resolves.toEqual([]);
  });
});
