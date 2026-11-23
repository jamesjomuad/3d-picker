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
   * Adds a generated combination to the basket.
   * @param {{ digits: string, path: Array }} combination
   */
  add: (combination) => {
    if (!combination || typeof combination.digits !== 'string') return;
    const { entries } = get();
    if (entries.some((entry) => entry.digits === combination.digits)) return;
    set({ entries: [...entries, { digits: combination.digits, path: combination.path }] });
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
