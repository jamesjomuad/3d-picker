import { loadBasket } from '@/services/basket-storage';

import {
  CREATE_COLLECTION_TABLE_SQL,
  COLLECTION_MIGRATION_STATEMENTS,
} from '@/features/collection/database/collection-schema';
import { resetResultsDatabaseForTests } from '@/features/results/database/results-database';
import {
  clearCollection,
  createCollectionId,
  getCollectionSnapshot,
  removeCollectionEntries,
  removeCollectionEntry,
  saveCollectionEntries,
  saveCollectionEntry,
  setCollectionFavorite,
} from '@/features/collection/database/collection-repository';
import { __dbState, __resetSqliteMock } from '../../../../../test/expo-sqlite-mock';

const path = [{ row: 4, column: 3 }];
let mockLegacyEntries = [];

jest.mock('@/services/basket-storage', () => ({
  loadBasket: jest.fn(async () => mockLegacyEntries),
  saveBasket: jest.fn(async () => {}),
}));

beforeEach(() => {
  __resetSqliteMock();
  resetResultsDatabaseForTests();
  mockLegacyEntries = [];
  loadBasket.mockImplementation(async () => mockLegacyEntries);
});

describe('collection repository', () => {
  it('creates the shared schema at version 2 with Collection tables and indexes', async () => {
    await getCollectionSnapshot();

    expect(__dbState.userVersion).toBe(2);
    expect(CREATE_COLLECTION_TABLE_SQL).toContain('CREATE TABLE IF NOT EXISTS collection_items');
    expect(COLLECTION_MIGRATION_STATEMENTS.join('\n')).toContain(
      'idx_collection_favorite_added_at'
    );
  });

  it('preserves leading zeros, coordinates, timestamps, and stable IDs', async () => {
    await saveCollectionEntry({
      digits: '005',
      path,
      addedAt: '2026-01-02T00:00:00.000Z',
    });

    const { entries } = await getCollectionSnapshot();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: expect.stringMatching(/^basket-/),
      digits: '005',
      path,
      addedAt: '2026-01-02T00:00:00.000Z',
      isFavorite: false,
    });
    expect(entries[0].id).not.toBe('005');
  });

  it('rejects duplicate digits without changing the original timestamp', async () => {
    await saveCollectionEntry({ digits: '047', path, addedAt: '2026-01-01T00:00:00.000Z' });
    await saveCollectionEntry({ digits: '047', path, addedAt: '2026-02-01T00:00:00.000Z' });

    const { entries } = await getCollectionSnapshot();
    expect(entries).toHaveLength(1);
    expect(entries[0].addedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('batch save dedupes and stays in one transaction', async () => {
    const result = await saveCollectionEntries([
      { digits: '047', path },
      { digits: '047', path },
      { digits: '089', path },
    ]);

    expect(result).toHaveLength(2);
    expect((await getCollectionSnapshot()).entries).toHaveLength(2);
  });

  it('toggles one favorite and filters favorites and coordinate search', async () => {
    await saveCollectionEntries([
      { id: 'item-a', digits: '047', path: [{ row: 0, column: 0 }], addedAt: '2026-01-02T00:00:00.000Z' },
      { id: 'item-b', digits: '089', path: [{ row: 1, column: 2 }], addedAt: '2026-01-01T00:00:00.000Z' },
    ]);

    const changed = await setCollectionFavorite('item-b', true);
    expect(changed).toBe(1);

    const favorites = await getCollectionSnapshot({ favoritesOnly: true });
    expect(favorites.entries.map((entry) => entry.digits)).toEqual(['089']);
    expect(favorites.favoriteCount).toBe(1);

    const searched = await getCollectionSnapshot({ favoritesOnly: true, query: 'c2' });
    expect(searched.entries.map((entry) => entry.digits)).toEqual(['089']);

    const afterUnfavorite = await getCollectionSnapshot({ favoritesOnly: true });
    await setCollectionFavorite('item-b', false);
    expect(afterUnfavorite.entries).toHaveLength(1);
    expect((await getCollectionSnapshot({ favoritesOnly: true })).entries).toHaveLength(0);
  });

  it('does not change addedAt when favorite changes', async () => {
    await saveCollectionEntry({ id: 'item-a', digits: '047', path, addedAt: '2026-01-02T00:00:00.000Z' });
    await setCollectionFavorite('item-a', true);

    const { entries } = await getCollectionSnapshot();
    expect(entries[0].addedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(entries[0].isFavorite).toBe(true);
  });

  it('removes individual, bulk, and all entries', async () => {
    await saveCollectionEntries([
      { id: 'item-a', digits: '047', path },
      { id: 'item-b', digits: '089', path },
      { id: 'item-c', digits: '123', path },
    ]);

    await removeCollectionEntry('item-a');
    await removeCollectionEntries(['item-b']);
    expect((await getCollectionSnapshot()).entries.map((entry) => entry.digits)).toEqual(['123']);

    await clearCollection();
    expect((await getCollectionSnapshot()).entries).toEqual([]);
  });

  it('imports legacy basket entries once with default favorites', async () => {
    mockLegacyEntries = [
      { digits: '037', path, addedAt: '2026-01-01T00:00:00.000Z' },
      { digits: '005', path },
    ];

    const first = await getCollectionSnapshot();
    expect(first.entries).toHaveLength(2);
    expect(first.entries.every((entry) => entry.isFavorite === false)).toBe(true);
    expect(first.entries.every((entry) => entry.id.startsWith('basket-'))).toBe(true);

    mockLegacyEntries = [{ digits: '999', path }];
    const second = await getCollectionSnapshot();
    expect(loadBasket).toHaveBeenCalledTimes(1);
    expect(second.entries.map((entry) => entry.digits).sort()).toEqual(['005', '037']);
  });

  it('creates deterministic IDs independent of digits alone', () => {
    const entry = { digits: '005', path, addedAt: '2026-01-01T00:00:00.000Z' };
    expect(createCollectionId(entry)).toBe(createCollectionId({ ...entry }));
    expect(createCollectionId(entry)).not.toBe('005');
  });
});
