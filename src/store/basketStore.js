import { create } from 'zustand';

import {
  clearCollection,
  getAllCollectionEntries,
  getCollectionEntryByDigits,
  getCollectionSnapshot,
  removeCollectionEntries,
  removeCollectionEntry,
  replaceCollectionEntries,
  saveCollectionEntries,
  saveCollectionEntry,
  setCollectionFavorite,
} from '@/features/collection/database/collection-repository';

/**
 * Selection Basket store.
 *
 * SQLite is the persistent source of truth. This store keeps only the active
 * view: the loaded page, the All/Favorites filter, the search query and
 * counts. Entries have stable local IDs; digit sequences still define
 * duplicates. Generation, selection mode and removal dialogs stay ephemeral.
 */
export const useBasketStore = create((set, get) => {
  async function reload() {
    const { filter, query } = get();
    try {
      const snapshot = await getCollectionSnapshot({ favoritesOnly: filter === 'favorites', query });
      set({
        entries: snapshot.entries,
        totalCount: snapshot.totalCount,
        favoriteCount: snapshot.favoriteCount,
        isLoaded: true,
      });
    } catch (error) {
      console.error('Failed to load selection basket:', error);
      set({ isLoaded: true });
    }
  }

  return {
    /** @type {Array<{ id: string, digits: string, path: Array, addedAt?: string, isFavorite: boolean }>} */
    entries: [],

    /** @type {boolean} Whether the active SQLite view has loaded */
    isLoaded: false,

    /** @type {'all' | 'favorites'} Temporary Collection filter */
    filter: 'all',

    /** @type {string} Temporary Collection search query */
    query: '',

    totalCount: 0,
    favoriteCount: 0,

    /** Loads the active view once. Fun Pick and Collection both call it. */
    load: async () => {
      if (get().isLoaded) return;
      await reload();
    },

    /** Force a reload after a backup restore or external SQLite change. */
    reload,

    /** Read the full saved set for sharing without changing the active view. */
    getAllEntries: async () => {
      try {
        return await getAllCollectionEntries();
      } catch (error) {
        console.error('Failed to read selection basket for sharing:', error);
        return [];
      }
    },

    setFilter: async (filter) => {
      const nextFilter = filter === 'favorites' ? 'favorites' : 'all';
      if (get().filter === nextFilter) return;
      set({ filter: nextFilter });
      await reload();
    },

    setQuery: async (query) => {
      const nextQuery = typeof query === 'string' ? query : '';
      if (get().query === nextQuery) return;
      set({ query: nextQuery });
      await reload();
    },

    /** Add one generated combination. Existing digits keep their original row. */
    add: async (combination) => {
      if (!combination || typeof combination.digits !== 'string') return;
      try {
        const existing = await getCollectionEntryByDigits(combination.digits);
        if (existing) return;
        await saveCollectionEntry({
          ...combination,
          addedAt: combination.addedAt ?? new Date().toISOString(),
        });
        await reload();
      } catch (error) {
        console.error('Failed to add selection basket entry:', error);
      }
    },

    /** Add a batch of generated combinations in one SQLite transaction. */
    addMany: async (combinations) => {
      if (!Array.isArray(combinations) || combinations.length === 0) return;
      try {
        await saveCollectionEntries(combinations);
        await reload();
      } catch (error) {
        console.error('Failed to add selection basket entries:', error);
      }
    },

    /** Remove one entry by stable ID. */
    remove: async (id) => {
      if (typeof id !== 'string') return;
      try {
        await removeCollectionEntry(id);
        await reload();
      } catch (error) {
        console.error('Failed to remove selection basket entry:', error);
      }
    },

    /** Remove several entries by stable ID in one SQLite transaction. */
    removeMany: async (ids) => {
      if (!Array.isArray(ids) || ids.length === 0) return;
      try {
        await removeCollectionEntries(ids);
        await reload();
      } catch (error) {
        console.error('Failed to remove selection basket entries:', error);
      }
    },

    /** Toggle one entry's favorite flag without reloading the whole view. */
    toggleFavorite: async (id, isFavorite) => {
      const state = get();
      const current = state.entries.find((entry) => entry.id === id);
      if (!current || current.isFavorite === isFavorite) return;

      set({
        entries: state.entries
          .filter((entry) => !(state.filter === 'favorites' && !isFavorite && entry.id === id))
          .map((entry) => (entry.id === id ? { ...entry, isFavorite } : entry)),
      });

      try {
        const changed = await setCollectionFavorite(id, isFavorite);
        if (changed > 0) {
          set({ favoriteCount: Math.max(0, get().favoriteCount + (isFavorite ? 1 : -1)) });
        } else {
          await reload();
        }
      } catch (error) {
        console.error('Failed to update favorite status:', error);
        await reload();
      }
    },

    /** Empty Collection. Migration flag stays set so legacy data never returns. */
    clear: async () => {
      try {
        await clearCollection();
        set({ entries: [], totalCount: 0, favoriteCount: 0, isLoaded: true });
      } catch (error) {
        console.error('Failed to clear selection basket:', error);
      }
    },

    /** Replace Collection rows after a verified backup restore. */
    replaceAll: async (entries) => {
      try {
        await replaceCollectionEntries(entries);
        await reload();
      } catch (error) {
        console.error('Failed to restore selection basket:', error);
        throw error;
      }
    },
  };
});
