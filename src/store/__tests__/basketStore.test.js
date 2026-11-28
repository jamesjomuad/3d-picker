/**
 * Tests for the Selection Basket store
 *
 * SQLite is the source of truth; the store keeps the active filtered view and
 * temporary UI state. Repository functions are mocked here so tests cover
 * store behavior without native SQLite.
 */

import {
  clearCollection,
  getAllCollectionEntries,
  getCollectionSnapshot,
  removeCollectionEntries,
  removeCollectionEntry,
  replaceCollectionEntries,
  saveCollectionEntries,
  saveCollectionEntry,
  setCollectionFavorite,
} from '@/features/collection/database/collection-repository';
import { useBasketStore } from '@/store/basketStore';

let mockStored = [];

jest.mock('@/features/collection/database/collection-repository', () => ({
  clearCollection: jest.fn(async () => {}),
  getAllCollectionEntries: jest.fn(async () => mockStored),
  getCollectionEntryByDigits: jest.fn(async (digits) =>
    mockStored.find((entry) => entry.digits === digits) ?? null
  ),
  getCollectionSnapshot: jest.fn(async () => ({
    entries: mockStored.map((entry) => ({ ...entry })),
    totalCount: mockStored.length,
    favoriteCount: mockStored.filter((entry) => entry.isFavorite).length,
  })),
  removeCollectionEntries: jest.fn(async () => 0),
  removeCollectionEntry: jest.fn(async () => 0),
  replaceCollectionEntries: jest.fn(async (entries) => entries),
  saveCollectionEntries: jest.fn(async () => mockStored),
  saveCollectionEntry: jest.fn(async () => mockStored[0]),
  setCollectionFavorite: jest.fn(async () => 1),
}));

const combination = (digits) => ({
  digits,
  path: [
    { row: 1, column: 1 },
    { row: 2, column: 3 },
  ],
});

function resetStore() {
  useBasketStore.setState({
    entries: [],
    isLoaded: false,
    filter: 'all',
    query: '',
    totalCount: 0,
    favoriteCount: 0,
  });
}

describe('basketStore', () => {
  beforeEach(() => {
    resetStore();
    mockStored = [];
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads the SQLite snapshot once and keeps counts', async () => {
    mockStored = [
      {
        id: 'entry-1',
        digits: '952',
        path: [{ row: 0, column: 0 }],
        addedAt: '2026-11-23T12:00:00.000Z',
        isFavorite: true,
      },
      { id: 'entry-2', digits: '111', path: [{ row: 3, column: 3 }], isFavorite: false },
    ];

    await useBasketStore.getState().load();
    expect(useBasketStore.getState().entries).toHaveLength(2);
    expect(useBasketStore.getState().favoriteCount).toBe(1);

    await useBasketStore.getState().load();
    expect(getCollectionSnapshot).toHaveBeenCalledTimes(1);
  });

  it('stamps addedAt and defaults favorites when adding', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 23, 20, 35));

    await useBasketStore.getState().add(combination('074'));

    expect(saveCollectionEntry).toHaveBeenCalledWith(
      expect.objectContaining({ digits: '074', addedAt: new Date(2026, 10, 23, 20, 35).toISOString() })
    );
  });

  it('refuses a duplicate without refreshing its timestamp', async () => {
    const existing = {
      id: 'entry-1',
      ...combination('074'),
      addedAt: '2026-01-01T00:00:00.000Z',
      isFavorite: false,
    };
    mockStored = [existing];

    await useBasketStore.getState().add({ digits: '074', path: [{ row: 9, column: 9 }] });

    expect(saveCollectionEntry).not.toHaveBeenCalled();
  });

  it('ignores malformed add input', async () => {
    await useBasketStore.getState().add(null);
    await useBasketStore.getState().add({ path: [] });
    expect(saveCollectionEntry).not.toHaveBeenCalled();
  });

  it('saves a batch in one repository call', async () => {
    await useBasketStore.getState().addMany([
      combination('074'),
      combination('638'),
      combination('638'),
      null,
    ]);
    expect(saveCollectionEntries).toHaveBeenCalledTimes(1);
  });

  it('removes entries by stable ID', async () => {
    await useBasketStore.getState().remove('entry-1');
    expect(removeCollectionEntry).toHaveBeenCalledWith('entry-1');

    await useBasketStore.getState().removeMany(['entry-1', 'entry-2']);
    expect(removeCollectionEntries).toHaveBeenCalledWith(['entry-1', 'entry-2']);
  });

  it('clears SQLite collection rows', async () => {
    await useBasketStore.getState().clear();
    expect(clearCollection).toHaveBeenCalledTimes(1);
    expect(useBasketStore.getState().entries).toEqual([]);
  });

  it('toggles one favorite without reloading the view', async () => {
    mockStored = [
      { id: 'entry-1', ...combination('074'), isFavorite: false },
      { id: 'entry-2', ...combination('638'), isFavorite: false },
    ];
    await useBasketStore.getState().load();
    jest.clearAllMocks();

    await useBasketStore.getState().toggleFavorite('entry-1', true);

    expect(setCollectionFavorite).toHaveBeenCalledWith('entry-1', true);
    expect(getCollectionSnapshot).not.toHaveBeenCalled();
    expect(useBasketStore.getState().entries[0].isFavorite).toBe(true);
    expect(useBasketStore.getState().favoriteCount).toBe(1);
  });

  it('reverts a favorite toggle when the row no longer exists', async () => {
    mockStored = [{ id: 'entry-1', ...combination('074'), isFavorite: false }];
    await useBasketStore.getState().load();
    setCollectionFavorite.mockResolvedValueOnce(0);

    await useBasketStore.getState().toggleFavorite('entry-1', true);

    expect(getCollectionSnapshot).toHaveBeenCalledTimes(2);
    expect(useBasketStore.getState().entries[0].isFavorite).toBe(false);
  });

  it('passes filter and query into targeted SQLite reads', async () => {
    await useBasketStore.getState().setFilter('favorites');
    await useBasketStore.getState().setQuery('a1');

    expect(getCollectionSnapshot).toHaveBeenLastCalledWith({
      favoritesOnly: true,
      query: 'a1',
    });
    expect(useBasketStore.getState().filter).toBe('favorites');
    expect(useBasketStore.getState().query).toBe('a1');
  });

  it('reads the full collection for sharing', async () => {
    mockStored = [{ id: 'entry-1', ...combination('074'), isFavorite: false }];
    const entries = await useBasketStore.getState().getAllEntries();
    expect(getAllCollectionEntries).toHaveBeenCalledTimes(1);
    expect(entries).toEqual(mockStored);
  });

  it('replaces collection rows on backup restore', async () => {
    await useBasketStore.getState().replaceAll(mockStored);
    expect(replaceCollectionEntries).toHaveBeenCalledWith(mockStored);
  });
});
