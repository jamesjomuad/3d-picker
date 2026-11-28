import {
  fetchGameCodes,
  fetchHistoryBundle,
  fetchLatestResults,
} from '@/services/lottery-api';

import { persistSyncResult, saveSyncState } from './results-repository';
import { RESULTS_METADATA_KEYS } from './results-schema';

/**
 * Results sync orchestration.
 *
 * Network results are normalized by the existing API service, then persisted
 * atomically. Cursors are saved only after the SQLite write succeeds, so a
 * failed page is requested again instead of being skipped.
 */

function cleanCursors(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const cursors = {};
  for (const [code, cursor] of Object.entries(value)) {
    if (code && typeof cursor === 'string' && cursor) cursors[code] = cursor;
  }
  return cursors;
}

function cleanCodes(value) {
  if (!Array.isArray(value)) return [];
  const codes = [];
  for (const code of value) {
    if (typeof code === 'string' && code && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

function firstCursor(cursors) {
  return Object.values(cursors).find((cursor) => typeof cursor === 'string' && cursor) ?? null;
}

function errorText(error) {
  const message = typeof error?.message === 'string' ? error.message : 'Unknown error';
  return message.length > 120 ? message.slice(0, 120) : message;
}

async function markAttempt(phase) {
  const now = new Date().toISOString();
  try {
    await saveSyncState({
      [`${phase}_attempt_at`]: now,
      [`${phase}_last_error`]: null,
    });
  } catch {
    // Sync metadata is diagnostic only; never block a network request for it.
  }
}

async function markFailure(phase, error) {
  try {
    await saveSyncState({
      [`${phase}_last_error`]: errorText(error),
      [RESULTS_METADATA_KEYS.LAST_ERROR]: errorText(error),
    });
  } catch {
    // Ignore diagnostic write failures.
  }
}

/** Refresh latest results plus one newest history page per active game code. */
export async function syncRefresh({
  gameCodes: cachedCodes = [],
  historyCursors: cachedCursors = {},
  hasMore: cachedHasMore = false,
} = {}) {
  const startedAt = new Date().toISOString();
  await markAttempt('refresh');

  const [latest, codes] = await Promise.allSettled([
    fetchLatestResults(),
    fetchGameCodes(),
  ]);

  const discoveredCodes = codes.status === 'fulfilled' ? codes.value : [];
  const gameCodes = cleanCodes(
    discoveredCodes.length > 0 ? discoveredCodes : cachedCodes
  );

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
          cursors: cleanCursors(cachedCursors),
        }),
      };
    } catch (error) {
      history = { status: 'rejected', reason: error };
    }
  }

  const batches = [latest, history]
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
  const failures = [latest, codes, history].filter(
    (result) => result.status === 'rejected'
  );

  if (batches.length === 0) {
    await markFailure('refresh', failures[0]?.reason);
    return { success: false, reason: 'network', failures, gameCodes };
  }

  const historyPage = history.status === 'fulfilled' ? history.value : null;
  const historyCursors = historyPage
    ? cleanCursors(historyPage.cursors)
    : cleanCursors(cachedCursors);
  const hasMore = historyPage
    ? historyPage.hasMore === true
    : cachedHasMore === true;
  const records = batches.flatMap((batch) => batch?.records ?? []);

  try {
    await persistSyncResult({
      records,
      metadata: {
        [RESULTS_METADATA_KEYS.GAME_CODES]: gameCodes,
        [RESULTS_METADATA_KEYS.HISTORY_CURSORS]: historyCursors,
        [RESULTS_METADATA_KEYS.HAS_MORE]: hasMore,
        [RESULTS_METADATA_KEYS.LAST_SYNC_AT]: startedAt,
        [RESULTS_METADATA_KEYS.LATEST_SYNCED_AT]:
          latest.status === 'fulfilled' ? startedAt : null,
        [RESULTS_METADATA_KEYS.HISTORY_SYNCED_AT]: historyPage ? startedAt : null,
        [RESULTS_METADATA_KEYS.LAST_ERROR]: failures.length
          ? 'Some results could not be refreshed'
          : null,
      },
    });
  } catch (error) {
    await markFailure('refresh', error);
    return { success: false, reason: 'database', failures, gameCodes };
  }

  return {
    success: true,
    reason: failures.length > 0 ? 'partial' : null,
    failures,
    gameCodes,
    historyCursors,
    nextCursor: firstCursor(historyCursors),
    hasMore,
    lastSyncAt: startedAt,
    persistedCount: records.length,
  };
}

/** Fetch and persist the next history page for codes with an active cursor. */
export async function syncLoadOlder({ gameCodes = [], historyCursors = {} } = {}) {
  const cursors = cleanCursors(historyCursors);
  const activeCodes = cleanCodes(gameCodes).filter((code) => cursors[code]);
  if (activeCodes.length === 0) {
    return { success: false, reason: 'no-cursors' };
  }

  await markAttempt('older');

  let page;
  try {
    page = await fetchHistoryBundle({ gameCodes: activeCodes, cursors });
  } catch (error) {
    await markFailure('older', error);
    return { success: false, reason: 'network' };
  }

  const nextCursors = cleanCursors(page.cursors);
  const hasMore = page.hasMore === true;
  const partial = Array.isArray(page.failedCodes) && page.failedCodes.length > 0;

  try {
    await persistSyncResult({
      records: page.records,
      metadata: {
        [RESULTS_METADATA_KEYS.HISTORY_CURSORS]: nextCursors,
        [RESULTS_METADATA_KEYS.HAS_MORE]: hasMore,
        [RESULTS_METADATA_KEYS.HISTORY_SYNCED_AT]: new Date().toISOString(),
        [RESULTS_METADATA_KEYS.LAST_ERROR]: partial
          ? 'Some older results could not load'
          : null,
      },
    });
  } catch (error) {
    await markFailure('older', error);
    return { success: false, reason: 'database' };
  }

  return {
    success: true,
    reason: partial ? 'partial' : null,
    page,
    gameCodes: activeCodes,
    historyCursors: nextCursors,
    nextCursor: firstCursor(nextCursors),
    hasMore,
    persistedCount: page.records?.length ?? 0,
  };
}
