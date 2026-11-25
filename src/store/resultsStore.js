import { create } from 'zustand';

import { fetchHistoryPage, fetchLatestResults } from '@/services/lottery-api';
import { mergeRecords } from '@/services/lottery-merge';
import { loadDrawResults, saveDrawResults } from '@/services/lottery-storage';

/**
 * Draw results store
 * Cached results load first, refresh runs in the background, and a failed
 * network call never empties what is already on screen.
 */
export const useResultsStore = create((set, get) => ({
  /** @type {Object[]} Draw records, newest first */
  records: [],

  /** @type {boolean} Whether the cache has been read from storage */
  isLoaded: false,

  /** @type {boolean} Whether a first-page refresh is running */
  isRefreshing: false,

  /** @type {boolean} Whether an older page is loading */
  isLoadingMore: false,

  /** @type {boolean} Whether older history remains */
  hasMore: false,

  /** @type {string|null} Cursor for the next history page */
  nextCursor: null,

  /** @type {string|null} ISO time of the last successful refresh */
  lastSyncAt: null,

  /** @type {string|null} Subtle message shown over cached results on failure */
  error: null,

  /**
   * Loads the cached results from storage. Idempotent.
   * @returns {Promise<void>}
   */
  load: async () => {
    if (get().isLoaded) return;
    try {
      const cache = await loadDrawResults();
      set({
        records: cache.records,
        nextCursor: cache.nextCursor,
        hasMore: cache.hasMore,
        lastSyncAt: cache.lastSyncAt,
        isLoaded: true,
      });
    } catch (error) {
      console.warn('Failed to load draw results store:', error);
      set({ isLoaded: true });
    }
  },

  /**
   * Refreshes the first page: latest results plus the newest history page.
   * Both endpoints are attempted; at least one must succeed. Existing records
   * stay on screen either way.
   * @returns {Promise<{ success: boolean }>}
   */
  refresh: async () => {
    const { isRefreshing } = get();
    if (isRefreshing) return { success: false };

    set({ isRefreshing: true, error: null });

    const [latest, history] = await Promise.allSettled([
      fetchLatestResults(),
      fetchHistoryPage(),
    ]);

    const fetchedAt = Date.now();
    const batches = [latest, history]
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);

    if (batches.length === 0) {
      // Never surface the raw HTTP/status text: a short, actionable message
      // over whatever is already cached.
      set({
        isRefreshing: false,
        error: get().records.length
          ? 'Could not refresh. Showing saved results.'
          : 'Could not reach draw results. Check your connection and try again.',
      });
      return { success: false };
    }

    const failures = [latest, history].filter((result) => result.status === 'rejected');
    const incoming = batches.flatMap((batch) => batch.records);
    const merged = mergeRecords(get().records, incoming);
    const historyPage = history.status === 'fulfilled' ? history.value : null;

    // Pagination restarts from the fresh first page only when that page
    // arrived; a latest-only refresh keeps the cursor already in memory.
    const nextCursor = historyPage ? historyPage.pageInfo.nextCursor : get().nextCursor;
    const hasMore = historyPage ? historyPage.pageInfo.hasNextPage : get().hasMore;

    const lastSyncAt = new Date(fetchedAt).toISOString();
    const nextState = {
      records: merged.records,
      nextCursor,
      hasMore: Boolean(nextCursor) && hasMore,
      lastSyncAt,
      isRefreshing: false,
      error: failures.length
        ? 'Some results could not be refreshed. Showing saved results.'
        : null,
    };

    set(nextState);
    await get()._persist(nextState);
    return { success: true };
  },

  /**
   * Loads the next older history page. Keeps existing records visible and
   * never restarts from page one while a cursor is still valid.
   * @returns {Promise<{ success: boolean }>}
   */
  loadOlder: async () => {
    const { isLoadingMore, hasMore, nextCursor, records } = get();
    if (isLoadingMore || !hasMore || !nextCursor) return { success: false };

    set({ isLoadingMore: true, error: null });

    let page;
    try {
      page = await fetchHistoryPage({ cursor: nextCursor });
    } catch {
      set({
        isLoadingMore: false,
        error: 'Could not load older results. Saved results are unchanged.',
      });
      return { success: false };
    }

    const merged = mergeRecords(records, page.records);
    const nextState = {
      records: merged.records,
      nextCursor: page.pageInfo.nextCursor,
      hasMore: page.pageInfo.hasNextPage,
      isLoadingMore: false,
      error: null,
    };

    set(nextState);
    await get()._persist({ ...nextState, lastSyncAt: get().lastSyncAt });
    return { success: true };
  },

  /**
   * Persists the cache. A save failure only logs — memory stays usable.
   * @param {Object} state
   * @returns {Promise<void>}
   */
  _persist: async (state) => {
    try {
      await saveDrawResults({
        records: state.records,
        nextCursor: state.nextCursor,
        hasMore: state.hasMore,
        lastSyncAt: state.lastSyncAt ?? get().lastSyncAt,
      });
    } catch (error) {
      console.warn('Failed to save draw results:', error);
    }
  },
}));
