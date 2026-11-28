import {
  fetchGameCodes,
  fetchHistoryBundle,
  fetchLatestResults,
  isAbortError,
} from '@/services/lottery-api';

import {
  getStorageIdentity,
  persistSyncResult,
  saveSyncState,
} from './results-repository';
import {
  RESULTS_DISPLAY_LIMIT_STEP,
  RESULTS_METADATA_KEYS,
  RESULTS_PAGE_SIZE,
} from './results-schema';

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

function dedupeRecords(records) {
  const seen = new Set();
  const unique = [];
  for (const record of Array.isArray(records) ? records : []) {
    const identity = getStorageIdentity(record);
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    unique.push(record);
  }
  return unique;
}

function mergeCursors(
  previous,
  next,
  failedCodes = [],
  successfulCodes = [],
  seenCursors = null
) {
  const merged = { ...previous };
  for (const [code, cursor] of Object.entries(next)) {
    if (!cursor || cursor === previous[code] || seenCursors?.has?.(cursor)) {
      delete merged[code];
      continue;
    }
    merged[code] = cursor;
  }
  for (const code of successfulCodes) {
    if (!next[code]) delete merged[code];
  }
  for (const code of failedCodes) {
    if (previous[code]) merged[code] = previous[code];
  }
  return merged;
}

function cursorProgress(previous, next, failedCodes = []) {
  if (failedCodes.some((code) => Boolean(previous[code]))) return true;
  return Object.entries(next).some(
    ([code, cursor]) => previous[code] !== cursor && Boolean(cursor)
  );
}

function increasedDisplayLimit(current, addedCount) {
  const numeric = Number(current);
  const base = Number.isFinite(numeric) && numeric > 0
    ? Math.floor(numeric)
    : RESULTS_PAGE_SIZE;
  const bumped = Number.isFinite(addedCount) && addedCount > 0
    ? Math.floor(addedCount)
    : 0;
  return base + Math.max(RESULTS_DISPLAY_LIMIT_STEP, bumped);
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
  displayLimit = null,
  signal,
} = {}) {
  if (signal?.aborted) {
    return { success: false, reason: 'aborted', gameCodes: cleanCodes(cachedCodes) };
  }

  const startedAt = new Date().toISOString();
  await markAttempt('refresh');

  const [latest, codes] = await Promise.allSettled([
    fetchLatestResults({ signal }),
    fetchGameCodes({ signal }),
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
          signal,
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

  if (failures.some((failure) => isAbortError(failure.reason))) {
    return { success: false, reason: 'aborted', failures, gameCodes };
  }

  if (batches.length === 0) {
    await markFailure('refresh', failures[0]?.reason);
    return { success: false, reason: 'network', failures, gameCodes };
  }

  const previousCursors = cleanCursors(cachedCursors);
  const historyPage = history.status === 'fulfilled' ? history.value : null;
  const failedCodes = cleanCodes(historyPage?.failedCodes);
  const successfulCodes = gameCodes.filter((code) => !failedCodes.includes(code));
  const historyCursors = historyPage
    ? cleanCursors(
        mergeCursors(
          previousCursors,
          historyPage.cursors ?? {},
          failedCodes,
          successfulCodes
        )
      )
    : previousCursors;
  const hasMore = historyPage
    ? cursorProgress(previousCursors, historyCursors, failedCodes)
    : cachedHasMore === true;
  const records = dedupeRecords(batches.flatMap((batch) => batch?.records ?? []));
  const displayLimitValue = Number(displayLimit);

  try {
    await persistSyncResult({
      records,
      metadata: {
        [RESULTS_METADATA_KEYS.GAME_CODES]: gameCodes,
        [RESULTS_METADATA_KEYS.HISTORY_CURSORS]: historyCursors,
        [RESULTS_METADATA_KEYS.HAS_MORE]: hasMore,
        [RESULTS_METADATA_KEYS.DISPLAY_LIMIT]:
          Number.isFinite(displayLimitValue) && displayLimitValue > 0
            ? Math.floor(displayLimitValue)
            : null,
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
export async function syncLoadOlder({
  gameCodes = [],
  historyCursors = {},
  displayLimit = null,
  seenCursors = null,
  signal,
} = {}) {
  if (signal?.aborted) {
    return { success: false, reason: 'aborted' };
  }

  const cursors = cleanCursors(historyCursors);
  const activeCodes = cleanCodes(gameCodes).filter((code) => cursors[code]);
  if (activeCodes.length === 0) {
    return { success: false, reason: 'no-cursors' };
  }

  await markAttempt('older');

  let page;
  try {
    page = await fetchHistoryBundle({ gameCodes: activeCodes, cursors, signal });
  } catch (error) {
    if (isAbortError(error)) {
      return { success: false, reason: 'aborted' };
    }
    await markFailure('older', error);
    return { success: false, reason: 'network' };
  }

  const failedCodes = cleanCodes(page.failedCodes);
  const successfulCodes = activeCodes.filter((code) => !failedCodes.includes(code));
  const nextCursors = cleanCursors(
    mergeCursors(
      cursors,
      page.cursors ?? {},
      failedCodes,
      successfulCodes,
      seenCursors
    )
  );
  const hasMore = cursorProgress(cursors, nextCursors, failedCodes);
  const records = dedupeRecords(page.records);
  const nextDisplayLimit = increasedDisplayLimit(displayLimit, records.length);
  const partial = failedCodes.length > 0;

  try {
    await persistSyncResult({
      records,
      metadata: {
        [RESULTS_METADATA_KEYS.HISTORY_CURSORS]: nextCursors,
        [RESULTS_METADATA_KEYS.HAS_MORE]: hasMore,
        [RESULTS_METADATA_KEYS.DISPLAY_LIMIT]: nextDisplayLimit,
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
    page: { ...page, records },
    gameCodes: activeCodes,
    historyCursors: nextCursors,
    nextCursor: firstCursor(nextCursors),
    hasMore,
    persistedCount: records.length,
    displayLimit: nextDisplayLimit,
    failedCodes,
  };
}
