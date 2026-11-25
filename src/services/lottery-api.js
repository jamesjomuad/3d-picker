/**
 * LottoMatik HTTP clients
 * Minimal JSON fetch: Accept header only, `response.ok` check, no cookies,
 * no analytics/session headers, no invented Referer/Origin.
 */

import {
  HISTORY_RESULTS_URL,
  HISTORY_PAGE_SIZE,
  LATEST_RESULTS_URL,
  SUPPORTED_LOTTERIES,
} from '@/constants/lottery';
import {
  normalizeHistoryPayload,
  normalizeLatestPayload,
} from '@/services/lottery-normalize';

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
}

/**
 * Fetch the latest results for every supported lottery.
 * The endpoint returns several lottery types; only `supported` survive.
 *
 * @returns {Promise<{ records: import('@/services/lottery-normalize').DrawRecord[], dropped: number }>}
 */
export async function fetchLatestResults() {
  const payload = await fetchJson(LATEST_RESULTS_URL);
  return normalizeLatestPayload(payload, SUPPORTED_LOTTERIES);
}

/**
 * Fetch one history page.
 * First page omits `cursor`; later pages pass the previous `pageInfo.nextCursor`
 * verbatim as the `cursor` query parameter.
 *
 * @param {Object} [options]
 * @param {string|null} [options.cursor]
 * @returns {Promise<{ records: ..., dropped: number, pageInfo: { hasNextPage: boolean, nextCursor: string|null } }>}
 */
export async function fetchHistoryPage({ cursor } = {}) {
  const params = new URLSearchParams({
    lottery: SUPPORTED_LOTTERIES[0],
    limit: String(HISTORY_PAGE_SIZE),
  });
  if (cursor) params.set('cursor', cursor);

  const payload = await fetchJson(`${HISTORY_RESULTS_URL}?${params.toString()}`);
  return normalizeHistoryPayload(payload, SUPPORTED_LOTTERIES);
}
