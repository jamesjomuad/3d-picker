import { create } from 'zustand';

import { loadBasket, saveBasket } from '@/services/basket-storage';

/**
 * Selection Basket store
 *
 * Holds the combinations the user collected from Fun Pick results. The
 * basket is deliberately its own domain: generation, search and filter
 * state stay ephemeral inside the Fun Pick card, while these entries live
 * here and persist through AsyncStorage (see `@/services/basket-storage`),
 * so navigating between screens or generating new batches never touches
 * them. An entry is identified by its digits — the same digit sequence is
 * the same pick — so duplicates are refused on add.
 */
export const useBasketStore = create((set, get) => ({
  /** @type {Array<{ digits: string, path: Array<{ row: number, column: number }> }>} */
  entries: [],

  /** @type {boolean} Whether the basket has been loaded from storage */
  isLoaded: false,

  /**
   * Loads the saved basket from storage. Idempotent: the Fun Pick card
   * calls it on mount, and a second call never clobbers in-memory state.
   * @returns {Promise<void>}
   */
  load: async () => {
    if (get().isLoaded) return;
    try {
      const entries = await loadBasket();
      set({ entries, isLoaded: true });
    } catch (error) {
      console.error('Failed to load selection basket:', error);
      set({ isLoaded: true });
    }
  },

  /**
   * Adds a generated combination to the basket, stamped with the local
   * time of the press. A digit sequence already in the basket keeps its
   * original entry untouched — re-adding never refreshes the timestamp.
   * @param {{ digits: string, path: Array }} combination
   */
  add: (combination) => {
    if (!combination || typeof combination.digits !== 'string') return;
    const { entries } = get();
    if (entries.some((entry) => entry.digits === combination.digits)) return;
    set({
      entries: [
        ...entries,
        { digits: combination.digits, path: combination.path, addedAt: new Date().toISOString() },
      ],
    });
    get()._persist();
  },

  /**
   * Adds every combination of a batch (e.g. the visible Fun Pick results)
   * in one update: sequences already in the basket — or repeated within
   * the batch — are skipped, kept entries keep their original timestamps,
   * and storage is written once instead of once per addition.
   * @param {Array<{ digits: string, path: Array }>} combinations
   */
  addMany: (combinations) => {
    if (!Array.isArray(combinations) || combinations.length === 0) return;
    const { entries } = get();
    const known = new Set(entries.map((entry) => entry.digits));
    const addedAt = new Date().toISOString();
    const fresh = [];
    for (const combination of combinations) {
      if (!combination || typeof combination.digits !== 'string') continue;
      if (known.has(combination.digits)) continue;
      known.add(combination.digits);
      fresh.push({ digits: combination.digits, path: combination.path, addedAt });
    }
    if (fresh.length === 0) return;
    set({ entries: [...entries, ...fresh] });
    get()._persist();
  },

  /**
   * Removes the entry with these digits (digits identify entries).
   * @param {string} digits
   */
  remove: (digits) => {
    set({ entries: get().entries.filter((entry) => entry.digits !== digits) });
    get()._persist();
  },

  /** Empties the basket. */
  clear: () => {
    set({ entries: [] });
    get()._persist();
  },

  /**
   * Persists the current entries; failures are logged, not surfaced — the
   * in-memory basket stays usable for the session either way.
   * @returns {Promise<void>}
   */
  _persist: async () => {
    try {
      await saveBasket(get().entries);
    } catch (error) {
      console.error('Failed to save selection basket:', error);
    }
  },
}));
