import { create } from 'zustand';

import {
  fetchGameCodes,
  fetchHistoryBundle,
  fetchLatestResults,
} from '@/services/lottery-api';
import { mergeRecords } from '@/services/lottery-merge';
import { loadDrawResults, saveDrawResults } from '@/services/lottery-storage';

/**
 * Draw results store
 * Cached results load first, refresh runs in the background, and a failed
 * network call never empties what is already on screen.
 */

function firstCursor(cursors) {
  const values = Object.values(cursors ?? {});
  return values.find((cursor) => typeof cursor === 'string' && cursor) ?? null;
}

function cleanCursors(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const cursors = {};
  for (const [code, cursor] of Object.entries(value)) {
    if (code && typeof cursor === 'string' && cursor) cursors[code] = cursor;
  }
  return cursors;
}

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

  /** @type {string|null} First active cursor, kept for cache compatibility */
  nextCursor: null,

  /** @type {string[]} Discovered active 3D Lotto game codes */
  gameCodes: [],

  /** @type {Object<string,string>} Per-game cursors for the next history page */
  historyCursors: {},

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
        gameCodes: cache.gameCodes ?? [],
        historyCursors: cleanCursors(cache.historyCursors),
        lastSyncAt: cache.lastSyncAt,
        isLoaded: true,
      });
    } catch (error) {
      console.warn('Failed to load draw results store:', error);
      set({ isLoaded: true });
    }
  },

  /**
   * Refreshes the latest snapshot plus the newest history page per game code.
   * Every endpoint is attempted; at least one must succeed. Existing records
   * stay on screen either way.
   * @returns {Promise<{ success: boolean }>}
   */
  refresh: async () => {
    const { isRefreshing, isLoadingMore } = get();
    if (isRefreshing || isLoadingMore) return { success: false };

    set({ isRefreshing: true, error: null });

    const [latest, codes] = await Promise.allSettled([
      fetchLatestResults(),
      fetchGameCodes(),
    ]);

    const cachedCodes = get().gameCodes ?? [];
    const discoveredCodes = codes.status === 'fulfilled' ? codes.value : [];
    const gameCodes =
      discoveredCodes.length > 0 ? discoveredCodes : cachedCodes;

    let history = {
      status: 'rejected',
      reason: new Error('No 3D Lotto game codes available'),
    };
    if (gameCodes.length > 0) {
      try {
        history = {
          status: 'fulfilled',
          value: await fetchHistoryBundle({
            gameCodes,
            cursors: get().historyCursors ?? {},
          }),
        };
      } catch (error) {
        history = { status: 'rejected', reason: error };
      }
    }

    const batches = [latest, history]
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);

    if (batches.length === 0) {
      // Never surface raw HTTP/status text: a short, actionable message over
      // whatever is already cached.
      set({
        isRefreshing: false,
        error: get().records.length
          ? 'Could not refresh. Showing saved results.'
          : 'Could not reach draw results. Check your connection and try again.',
      });
      return { success: false };
    }

    const failures = [latest, codes, history].filter(
      (result) => result.status === 'rejected'
    );
    const incoming = batches.flatMap((batch) => batch.records ?? []);
    const merged = mergeRecords(get().records, incoming);
    const historyPage = history.status === 'fulfilled' ? history.value : null;

    // Keep the old cursors when history failed. Otherwise use one cursor per
    // discovered code, so a stale cursor only affects its own game.
    const historyCursors = historyPage
      ? cleanCursors(historyPage.cursors)
      : get().historyCursors ?? {};
    const nextCursor = firstCursor(historyCursors);
    const hasMore = historyPage
      ? Object.keys(historyCursors).length > 0
      : get().hasMore;

    const lastSyncAt = new Date().toISOString();
    const nextState = {
      records: merged.records,
      nextCursor,
      gameCodes,
      historyCursors,
      hasMore,
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
   * Loads the next older page for every active game code. Existing records
   * stay visible, and overlapping pagination requests are ignored.
   * @returns {Promise<{ success: boolean }>}
   */
  loadOlder: async () => {
    const {
      isLoadingMore,
      isRefreshing,
      hasMore,
      historyCursors,
      gameCodes,
      records,
    } = get();
    const cursors = cleanCursors(historyCursors);
    const activeGameCodes = (gameCodes ?? []).filter((code) => cursors[code]);
    if (
      isLoadingMore ||
      isRefreshing ||
      !hasMore ||
      activeGameCodes.length === 0
    ) {
      return { success: false };
    }

    set({ isLoadingMore: true, error: null });

    let page;
    try {
      page = await fetchHistoryBundle({ gameCodes: activeGameCodes, cursors });
    } catch {
      set({
        isLoadingMore: false,
        error: 'Could not load older results. Saved results are unchanged.',
      });
      return { success: false };
    }

    const merged = mergeRecords(records, page.records);
    const nextHistoryCursors = cleanCursors(page.cursors);
    const nextState = {
      records: merged.records,
      nextCursor: firstCursor(nextHistoryCursors),
      historyCursors: nextHistoryCursors,
      hasMore: page.hasMore === true,
      isLoadingMore: false,
      error: page.failedCodes?.length
        ? 'Some older results could not load. Saved results are unchanged.'
        : null,
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
        gameCodes: state.gameCodes ?? get().gameCodes ?? [],
        historyCursors: state.historyCursors ?? get().historyCursors ?? {},
      });
    } catch (error) {
      console.warn('Failed to save draw results:', error);
    }
  },
}));
