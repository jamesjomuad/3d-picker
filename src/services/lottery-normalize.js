/**
 * Draw result normalization and validation
 *
 * The API sends winning combinations as digit strings (`["0","3","7"]`).
 * They are NEVER converted to integers: `037` must survive as `037`.
 * Every raw record passes through here before it reaches state or storage.
 */

/**
 * @typedef {Object} DrawRecord
 * @property {string} id - API record id, the unique key for a draw
 * @property {string} lottery - lottery id, e.g. "3DL"
 * @property {string} drawNumber - provider draw number, may be empty
 * @property {string[]} result - winning digits as strings, leading zeros kept
 * @property {string} drawDate - original date string, e.g. "2026-11-24"
 * @property {string} drawTime - original time string, e.g. "21:00:00+08"
 * @property {string|null} jackpot - raw jackpot string, never parsed to a number
 * @property {string|null} totalWinners - raw winner count string
 * @property {boolean|null} provisional - provider provisional flag
 * @property {string|null} lastVerifiedAt - verification timestamp when present
 * @property {string|null} lastSuccessfulCaptureAt - capture timestamp when present
 * @property {string|null} collectedAt - collection timestamp when present
 * @property {string[]} sources - endpoints that reported this record
 * @property {boolean} conflict - true when sources disagree on the result
 * @property {Array<Object>} conflictSnapshots - losing snapshots kept for review
 */

function asDigitString(value) {
  if (typeof value === 'string' && /^[0-9]$/.test(value)) return value;
  if (Number.isInteger(value) && value >= 0 && value <= 9) return String(value);
  return null;
}

function optionalString(value) {
  return typeof value === 'string' && value ? value : null;
}

/**
 * Normalize one raw API item. Returns null when the item is malformed —
 * malformed records are dropped and counted, never repaired silently.
 *
 * @param {Object} raw
 * @param {string} source - 'latest' or 'history'
 * @param {number} [collectedAt] - epoch ms of this fetch
 * @returns {DrawRecord|null}
 */
export function normalizeDrawRecord(raw, source, collectedAt = Date.now()) {
  if (!raw || typeof raw !== 'object') return null;

  const { id, lottery, result } = raw;
  if (typeof id !== 'string' || !id) return null;
  if (typeof lottery !== 'string' || !lottery) return null;
  if (!Array.isArray(result) || result.length === 0) return null;

  const digits = result.map(asDigitString);
  if (digits.some((digit) => digit === null)) return null;

  const drawDate = optionalString(raw.drawDate);
  if (!drawDate) return null;

  return {
    id,
    lottery,
    drawNumber: optionalString(raw.drawNumber) ?? '',
    result: digits,
    drawDate,
    drawTime: optionalString(raw.drawTime) ?? '',
    jackpot: optionalString(raw.jackpot),
    totalWinners: optionalString(raw.totalWinners),
    provisional: typeof raw.provisional === 'boolean' ? raw.provisional : null,
    lastVerifiedAt: optionalString(raw.lastVerifiedAt),
    lastSuccessfulCaptureAt: optionalString(raw.lastSuccessfulCaptureAt),
    collectedAt: optionalString(raw.collectedAt),
    sources: [source],
    conflict: false,
    conflictSnapshots: [],
    fetchedAt: new Date(collectedAt).toISOString(),
  };
}

/**
 * Normalize a `latest` response: an array of items, all lottery types.
 *
 * @param {unknown} payload
 * @param {string[]} supported - lottery ids to keep
 * @returns {{ records: DrawRecord[], dropped: number, total: number }}
 */
export function normalizeLatestPayload(payload, supported) {
  const items = Array.isArray(payload) ? payload : [];
  return normalizeItems(items, supported, 'latest');
}

/**
 * Normalize a history page response `{ items, pageInfo }`.
 *
 * @param {unknown} payload
 * @param {string[]} supported
 * @returns {{ records: DrawRecord[], dropped: number, total: number, pageInfo: Object }}
 */
export function normalizeHistoryPayload(payload, supported) {
  const items = payload && !Array.isArray(payload) && Array.isArray(payload.items)
    ? payload.items
    : [];
  const page = normalizeItems(items, supported, 'history');
  const rawInfo = payload && !Array.isArray(payload) ? payload.pageInfo : null;

  return {
    ...page,
    pageInfo: normalizePageInfo(rawInfo),
  };
}

function normalizeItems(items, supported, source) {
  const records = [];
  let dropped = 0;

  for (const item of items) {
    const record = normalizeDrawRecord(item, source);
    if (!record) {
      dropped += 1;
      continue;
    }
    if (!supported.includes(record.lottery)) continue;
    records.push(record);
  }

  return { records, dropped, total: items.length };
}

/**
 * Page info as the provider's own site treats it: `hasNextPage` only counts
 * when a non-null `nextCursor` exists, because a cursor is the only way to
 * ask for the next page.
 *
 * @param {unknown} rawInfo
 * @returns {{ hasNextPage: boolean, nextCursor: string|null }}
 */
export function normalizePageInfo(rawInfo) {
  const info = rawInfo && typeof rawInfo === 'object' ? rawInfo : {};
  const nextCursor = typeof info.nextCursor === 'string' && info.nextCursor
    ? info.nextCursor
    : null;

  return {
    hasNextPage: info.hasNextPage === true && nextCursor !== null,
    nextCursor,
  };
}

/**
 * Sort newest first by the provider's own ordering: drawDate + drawTime
 * string comparison, which keeps the supplied timezone offsets untouched.
 *
 * @param {DrawRecord[]} records
 * @returns {DrawRecord[]}
 */
export function sortRecordsNewestFirst(records) {
  return [...records].sort((a, b) =>
    `${b.drawDate} ${b.drawTime}`.localeCompare(`${a.drawDate} ${a.drawTime}`)
  );
}

/**
 * Display string for a winning combination. Digits stay strings, so a
 * leading zero is never lost.
 *
 * @param {string[]} result
 * @returns {string}
 */
export function formatCombination(result) {
  return Array.isArray(result) ? result.join('') : '';
}

/**
 * Human status for a record. Follows the actual metadata: provisional
 * stays provisional, `provisional: false` alone never becomes "Verified".
 *
 * @param {DrawRecord} record
 * @returns {'Conflicting'|'Provisional'|'Verified'|'Pending verification'}
 */
export function getRecordStatus(record) {
  if (record.conflict) return 'Conflicting';
  if (record.provisional === true) return 'Provisional';
  if (record.lastVerifiedAt) return 'Verified';
  return 'Pending verification';
}
