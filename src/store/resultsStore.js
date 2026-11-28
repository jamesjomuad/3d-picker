import { create } from 'zustand';

import {
  getResultsPage,
  getResultsSnapshot,
} from '@/features/results/database/results-repository';
import { RESULTS_PAGE_SIZE } from '@/features/results/database/results-schema';
import {
  syncLoadOlder,
  syncRefresh,
} from '@/features/results/database/results-sync';

/**
 * Draw results store
 * SQLite is read immediately, refresh runs behind the screen, and a failed
 * network or database write never removes results already cached on device.
 */

const FILTER_ALL = 'all';

function messageForRefresh(result, hasCachedResults) {
  if (result?.reason === 'database') {
    return 'Could not save new results locally. Showing saved results.';
  }
  return hasCachedResults
    ? 'Could not refresh. Showing saved results.'
    : 'Could not reach draw results. Check your connection and try again.';
}

function messageForOlder(result) {
  if (result?.reason === 'database') {
    return 'Could not save older results locally. Saved results are unchanged.';
  }
  return 'Could not load older results. Saved results are unchanged.';
}

export const useResultsStore = create((set, get) => ({
  /** @type {Object[]} Draw records for the active date filter, newest first */
  records: [],

  /** @type {string[]} Every cached draw date, newest first */
  drawDates: [],

  /** @type {string} Active date filter or 'all' */
  dateFilter: FILTER_ALL,

  /** @type {boolean} Whether SQLite has been read */
  isLoaded: false,

  /** @type {boolean} Whether a first-page refresh is running */
  isRefreshing: false,

  /** @type {boolean} Whether an older page is loading */
  isLoadingMore: false,

  /** @type {boolean} Whether older history remains */
  hasMore: false,

  /** @type {string|null} First active cursor, kept for compatibility */
  nextCursor: null,

  /** @type {string[]} Discovered active 3D Lotto game codes */
  gameCodes: [],

  /** @type {Object<string,string>} Per-game cursors for the next history page */
  historyCursors: {},

  /** @type {string|null} ISO time of the last successful refresh */
  lastSyncAt: null,

  /** @type {number} Total cached rows, independent of the active page */
  totalCount: 0,

  /** @type {string|null} Subtle message shown over cached results on failure */
  error: null,

  /**
   * Reads the cached results from SQLite. Idempotent.
   * @returns {Promise<void>}
   */
  load: async () => {
    if (get().isLoaded) return;
    try {
      const snapshot = await getResultsSnapshot({ limit: RESULTS_PAGE_SIZE });
      set({
        ...snapshot,
        dateFilter: FILTER_ALL,
        isLoaded: true,
      });
    } catch (error) {
      console.warn('Failed to load draw results from SQLite:', error);
      set({ isLoaded: true });
    }
  },

  /**
   * Switches the date filter using a targeted SQLite query.
   * @param {string} nextFilter
   * @returns {Promise<void>}
   */
  setDateFilter: async (nextFilter) => {
    const dateFilter = typeof nextFilter === 'string' && nextFilter
      ? nextFilter
      : FILTER_ALL;
    set({ dateFilter, error: null });

    try {
      const records = await getResultsPage({
        date: dateFilter === FILTER_ALL ? null : dateFilter,
        limit: RESULTS_PAGE_SIZE,
      });
      set({ records });
    } catch (error) {
      console.warn('Failed to filter saved draw results:', error);
      set({ error: 'Could not filter saved results.' });
    }
  },

  /**
   * Reloads the active page from SQLite after a successful write.
   * @param {Object} updates
   * @returns {Promise<void>}
   */
  _reload: async (updates = {}) => {
    const { dateFilter } = get();
    const snapshot = await getResultsSnapshot({
      date: dateFilter === FILTER_ALL ? null : dateFilter,
      limit: RESULTS_PAGE_SIZE,
    });
    set({ ...snapshot, ...updates });
  },

  /**
   * Refreshes latest results plus the newest history page, persists them,
   * then reloads from SQLite. Overlapping refreshes are ignored.
   * @returns {Promise<{ success: boolean }>}
   */
  refresh: async () => {
    const { isRefreshing, isLoadingMore } = get();
    if (isRefreshing || isLoadingMore) return { success: false };

    set({ isRefreshing: true, error: null });

    let result;
    try {
      result = await syncRefresh({
        gameCodes: get().gameCodes,
        historyCursors: get().historyCursors,
        hasMore: get().hasMore,
      });
    } catch (error) {
      console.warn('Unexpected draw results refresh failure:', error);
      result = { success: false, reason: 'network' };
    }

    if (!result.success) {
      const hasCachedResults = get().records.length > 0 || get().drawDates.length > 0;
      set({
        isRefreshing: false,
        error: messageForRefresh(result, hasCachedResults),
      });
      return { success: false };
    }

    try {
      await get()._reload({
        isRefreshing: false,
        error: result.reason === 'partial'
          ? 'Some results could not be refreshed. Showing saved results.'
          : null,
      });
    } catch (error) {
      console.warn('Failed to reload draw results from SQLite:', error);
      set({
        isRefreshing: false,
        error: 'Saved results are ready, but the local database could not be read.',
      });
    }

    return { success: true };
  },

  /**
   * Loads the next older history page, persists it, then reloads from SQLite.
   * Existing records and cursors stay untouched on failure.
   * @returns {Promise<{ success: boolean }>}
   */
  loadOlder: async () => {
    const {
      isLoadingMore,
      isRefreshing,
      hasMore,
      historyCursors,
      gameCodes,
    } = get();
    if (isLoadingMore || isRefreshing || !hasMore) {
      return { success: false };
    }

    set({ isLoadingMore: true, error: null });

    let result;
    try {
      result = await syncLoadOlder({ gameCodes, historyCursors });
    } catch (error) {
      console.warn('Unexpected older results failure:', error);
      result = { success: false, reason: 'network' };
    }

    if (!result.success) {
      set({
        isLoadingMore: false,
        error: messageForOlder(result),
      });
      return { success: false };
    }

    try {
      await get()._reload({
        isLoadingMore: false,
        error: result.reason === 'partial'
          ? 'Some older results could not load. Saved results are unchanged.'
          : null,
      });
    } catch (error) {
      console.warn('Failed to reload older draw results from SQLite:', error);
      set({
        isLoadingMore: false,
        error: 'Saved results are ready, but the local database could not be read.',
      });
    }

    return { success: true };
  },
}));
