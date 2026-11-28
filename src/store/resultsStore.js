import { create } from 'zustand';

import {
  getResultsPage,
  getResultsSnapshot,
  setDisplayLimit,
} from '@/features/results/database/results-repository';
import {
  RESULTS_DISPLAY_LIMIT_STEP,
  RESULTS_PAGE_SIZE,
} from '@/features/results/database/results-schema';
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

let refreshController = null;
let olderController = null;
let refreshGeneration = 0;
let olderGeneration = 0;
const seenCursors = new Set();

function rememberCursors(cursors) {
  if (!cursors || typeof cursors !== 'object') return;
  for (const cursor of Object.values(cursors)) {
    if (typeof cursor === 'string' && cursor) seenCursors.add(cursor);
  }
}

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

/** Cancel in-flight Results requests. Safe to call on blur, background or unmount. */
export function cancelResultsRequests() {
  refreshGeneration += 1;
  olderGeneration += 1;
  refreshController?.abort();
  olderController?.abort();
  refreshController = null;
  olderController = null;
  useResultsStore.setState({ isRefreshing: false, isLoadingMore: false });
}

/** Test helper: clears request guards between independent cases. */
export function resetResultsRequestStateForTests() {
  cancelResultsRequests();
  seenCursors.clear();
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

  /** @type {number} Number of newest cached rows shown by the Results screen */
  displayLimit: RESULTS_PAGE_SIZE,

  /** @type {string|null} ISO time of the last successful refresh */
  lastSyncAt: null,

  /** @type {number} Total cached rows, independent of the active page */
  totalCount: 0,

  /** @type {string|null} Subtle message shown over cached results on refresh failure */
  error: null,

  /** @type {string|null} Message shown in the list footer on pagination failure */
  olderError: null,

  /** @type {boolean} Whether the last older page had no records but more pages remain */
  emptyOlderPage: false,

  /**
   * Reads the cached results from SQLite. Idempotent.
   * @returns {Promise<void>}
   */
  load: async () => {
    if (get().isLoaded) return;
    try {
      const snapshot = await getResultsSnapshot();
      seenCursors.clear();
      rememberCursors(snapshot.historyCursors);
      set({
        ...snapshot,
        displayLimit: snapshot.displayLimit ?? get().displayLimit,
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
    set({ dateFilter, error: null, olderError: null, emptyOlderPage: false });

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
    });
    set({
      ...snapshot,
      displayLimit: snapshot.displayLimit ?? get().displayLimit,
      ...updates,
    });
  },

  /**
   * Refreshes latest results plus the newest history page, persists them,
   * then reloads from SQLite. Overlapping refreshes are ignored.
   * @returns {Promise<{ success: boolean }>}
   */
  refresh: async () => {
    const { isRefreshing, isLoadingMore } = get();
    if (isRefreshing || isLoadingMore) return { success: false };

    const generation = refreshGeneration + 1;
    refreshGeneration = generation;
    const controller = new AbortController();
    refreshController = controller;
    const isCurrent = () => generation === refreshGeneration;

    set({ isRefreshing: true, error: null });

    let result;
    try {
      result = await syncRefresh({
        gameCodes: get().gameCodes,
        historyCursors: get().historyCursors,
        hasMore: get().hasMore,
        displayLimit: get().displayLimit,
        signal: controller.signal,
      });
    } catch (error) {
      if (!isCurrent()) return { success: false };
      console.warn('Unexpected draw results refresh failure:', error);
      result = { success: false, reason: 'network' };
    } finally {
      if (refreshController === controller) refreshController = null;
    }

    if (!isCurrent() || result?.reason === 'aborted') {
      if (isCurrent()) set({ isRefreshing: false });
      return { success: false };
    }

    if (!result.success) {
      const hasCachedResults = get().records.length > 0 || get().drawDates.length > 0;
      set({
        isRefreshing: false,
        error: messageForRefresh(result, hasCachedResults),
      });
      return { success: false };
    }

    rememberCursors(result.historyCursors);

    try {
      await get()._reload({
        isRefreshing: false,
        error: result.reason === 'partial'
          ? 'Some results could not be refreshed. Showing saved results.'
          : null,
      });
    } catch (error) {
      if (!isCurrent()) return { success: false };
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
      displayLimit,
    } = get();
    if (isLoadingMore || isRefreshing || !hasMore) {
      return { success: false };
    }

    const generation = olderGeneration + 1;
    olderGeneration = generation;
    const controller = new AbortController();
    olderController = controller;
    const isCurrent = () => generation === olderGeneration;

    set({ isLoadingMore: true, olderError: null, emptyOlderPage: false });

    let result;
    try {
      result = await syncLoadOlder({
        gameCodes,
        historyCursors,
        displayLimit,
        seenCursors,
        signal: controller.signal,
      });
    } catch (error) {
      if (!isCurrent()) return { success: false };
      console.warn('Unexpected older results failure:', error);
      result = { success: false, reason: 'network' };
    } finally {
      if (olderController === controller) olderController = null;
    }

    if (!isCurrent() || result?.reason === 'aborted') {
      if (isCurrent()) set({ isLoadingMore: false });
      return { success: false };
    }

    if (!result.success) {
      set({
        isLoadingMore: false,
        olderError: messageForOlder(result),
      });
      return { success: false };
    }

    rememberCursors(result.historyCursors);

    try {
      await get()._reload({
        isLoadingMore: false,
        olderError: result.reason === 'partial'
          ? 'Some older results could not load. Saved results are unchanged.'
          : null,
        emptyOlderPage: result.persistedCount === 0 && result.hasMore === true,
      });
    } catch (error) {
      if (!isCurrent()) return { success: false };
      console.warn('Failed to reload older draw results from SQLite:', error);
      set({
        isLoadingMore: false,
        olderError: 'Saved results are ready, but the local database could not be read.',
      });
    }

    return { success: true };
  },

  /**
   * Reveals the next 200 already-cached rows after API cursors run out.
   * Only the bounded SQLite snapshot is reloaded.
   * @returns {Promise<{ success: boolean }>}
   */
  showMoreLocal: async () => {
    const {
      isLoaded,
      isLoadingMore,
      isRefreshing,
      dateFilter,
      records,
      totalCount,
      displayLimit,
    } = get();
    if (
      !isLoaded
      || isLoadingMore
      || isRefreshing
      || dateFilter !== FILTER_ALL
      || records.length >= totalCount
    ) {
      return { success: false };
    }

    const generation = olderGeneration + 1;
    olderGeneration = generation;
    const isCurrent = () => generation === olderGeneration;

    set({ isLoadingMore: true, olderError: null, emptyOlderPage: false });

    try {
      const ceiling = Math.ceil(totalCount / RESULTS_DISPLAY_LIMIT_STEP)
        * RESULTS_DISPLAY_LIMIT_STEP;
      const nextLimit = Math.min(
        displayLimit + RESULTS_DISPLAY_LIMIT_STEP,
        ceiling
      );
      const savedLimit = await setDisplayLimit(nextLimit);
      if (!isCurrent()) return { success: false };

      const snapshot = await getResultsSnapshot();
      if (!isCurrent()) return { success: false };

      set({
        ...snapshot,
        displayLimit: snapshot.displayLimit ?? savedLimit,
        isLoadingMore: false,
        olderError: null,
        emptyOlderPage: false,
      });
      return { success: true };
    } catch (error) {
      if (!isCurrent()) return { success: false };
      console.warn('Failed to reveal more saved draw results:', error);
      set({
        isLoadingMore: false,
        olderError: 'Could not load more saved results.',
      });
      return { success: false };
    }
  },
}));
