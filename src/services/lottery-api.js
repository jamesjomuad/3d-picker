import {
  GAMES_URL,
  HISTORY_PAGE_SIZE,
  HISTORY_RESULTS_URL,
  LATEST_RESULTS_URL,
} from '@/constants/lottery';
import {
  discoverThreeDGameCodes,
  normalizeV2HistoryPayload,
  normalizeV2LatestPayload,
} from './lottery-normalize';

/**
 * PCSO Lotto API v2 clients.
 * Requests stay minimal JSON; no cookies or browser-only headers.
 */

export class LotteryApiError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'LotteryApiError';
    this.status = status;
  }
}

export function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

async function fetchJson(url, { signal } = {}) {
  let response;
  try {
    const options = { headers: { Accept: 'application/json' } };
    if (signal) options.signal = signal;
    response = await fetch(url, options);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new LotteryApiError('Network request failed', 0);
  }
  if (!response.ok) {
    throw new LotteryApiError(`Request failed (${response.status})`, response.status);
  }
  return response.json();
}

/** Discover the real active 3D Lotto codes. Never substitute a guessed code. */
export async function fetchGameCodes({ signal } = {}) {
  const payload = await fetchJson(GAMES_URL, { signal });
  const codes = discoverThreeDGameCodes(payload);
  if (codes.length === 0) {
    throw new LotteryApiError('No active 3D Lotto game codes found', 0);
  }
  return codes;
}

export async function fetchLatestResults({ signal } = {}) {
  const payload = await fetchJson(LATEST_RESULTS_URL, { signal });
  return normalizeV2LatestPayload(payload, 'latest');
}

/** Fetch one cursor page for one discovered 3D Lotto game code. */
export async function fetchHistoryPage({
  gameCode,
  cursor,
  limit = HISTORY_PAGE_SIZE,
  signal,
} = {}) {
  if (typeof gameCode !== 'string' || gameCode.length === 0) {
    throw new LotteryApiError('Missing 3D Lotto game code', 0);
  }

  const pageSize = Math.min(
    Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : HISTORY_PAGE_SIZE,
    HISTORY_PAGE_SIZE
  );
  const params = new URLSearchParams({
    gameCode,
    limit: String(pageSize),
  });
  if (cursor !== null && cursor !== undefined && String(cursor).length > 0) {
    params.set('cursor', String(cursor));
  }

  const payload = await fetchJson(`${HISTORY_RESULTS_URL}?${params.toString()}`, { signal });
  return normalizeV2HistoryPayload(payload, 'history');
}

/**
 * Fetch one page per game code.
 * A failed code keeps cached records and drops only its own cursor.
 */
export async function fetchHistoryBundle({ gameCodes, cursors = {}, signal } = {}) {
  if (!Array.isArray(gameCodes) || gameCodes.length === 0) {
    throw new LotteryApiError('Missing 3D Lotto game codes', 0);
  }

  const results = await Promise.allSettled(
    gameCodes.map((gameCode) =>
      fetchHistoryPage({ gameCode, cursor: cursors?.[gameCode] ?? null, signal })
    )
  );

  const records = [];
  const nextCursors = {};
  const failedCodes = [];
  let dropped = 0;
  let total = 0;
  let succeeded = 0;
  let firstError = null;

  results.forEach((result, index) => {
    const gameCode = gameCodes[index];
    if (result.status === 'fulfilled') {
      succeeded += 1;
      records.push(...result.value.records);
      dropped += result.value.dropped ?? 0;
      total += result.value.total ?? 0;
      const info = result.value.pageInfo ?? {};
      if (info.nextCursor) {
        nextCursors[gameCode] = info.nextCursor;
      }
      return;
    }

    failedCodes.push(gameCode);
    if (!firstError) firstError = result.reason;
  });

  if (succeeded === 0) {
    throw firstError ?? new LotteryApiError('History request failed', 0);
  }

  return {
    records,
    cursors: nextCursors,
    hasMore: Object.keys(nextCursors).length > 0,
    failedCodes,
    dropped,
    total,
  };
}
