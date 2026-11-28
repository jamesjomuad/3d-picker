import { loadDrawResults } from '@/services/lottery-storage';
import { mergeRecords } from '@/services/lottery-merge';
import { formatCombination } from '@/services/lottery-normalize';
import {
  getDrawSession,
  getMonthBounds,
  getMonthOptions,
} from '@/utils/results-history';

import { getResultsDatabase } from './results-database';
import {
  RESULTS_METADATA_KEYS,
  RESULTS_PAGE_SIZE,
  parseDisplayLimit,
} from './results-schema';

/**
 * Results repository.
 *
 * SQLite is the local source of truth. Records keep their full normalized JSON
 * for the detail sheet, while indexed columns support date and session queries
 * without loading the whole table into Zustand.
 */

const RESULT_COLUMNS = Object.freeze([
  'id',
  'source_id',
  'game_code',
  'game_name',
  'draw_date',
  'slot',
  'numbers',
  'extra_numbers',
  'prize_amount',
  'currency',
  'winners_count',
  'winners_status',
  'server_time',
  'fetched_at',
  'updated_at',
  'record_json',
]);

const INSERT_RESULT_SQL = `
INSERT INTO lotto_results (${RESULT_COLUMNS.join(', ')})
VALUES (${RESULT_COLUMNS.map(() => '?').join(', ')})
`;

const UPDATE_RESULT_SQL = `
UPDATE lotto_results
SET ${RESULT_COLUMNS.filter((column) => column !== 'id')
  .map((column) => `${column} = ?`)
  .join(', ')}
WHERE id = ?
`;

const UPSERT_METADATA_SQL = `
INSERT INTO results_sync_metadata (key, value, updated_at)
VALUES (?, ?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`;

function textValue(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function nullableValue(value) {
  return textValue(value);
}

function timestampValue(value) {
  const text = textValue(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function newerTimestamp(previous, incoming) {
  const previousTime = Date.parse(previous ?? '') || 0;
  const incomingTime = Date.parse(incoming ?? '') || 0;
  return incomingTime > previousTime ? incoming : previous;
}

const WINNERS_STATUS_RANK = Object.freeze({ final: 3, pending: 2, unknown: 1 });

function preferredWinnersStatus(previous, incoming) {
  const previousRank = WINNERS_STATUS_RANK[previous] ?? 0;
  const incomingRank = WINNERS_STATUS_RANK[incoming] ?? 0;
  return incomingRank > previousRank ? incoming : previous ?? incoming ?? null;
}

/**
 * Stable database identity.
 *
 * API `sourceId` wins. Only records without one use a deterministic composite
 * that excludes winning digits, so a pending-to-final number change updates
 * the same row instead of creating a duplicate.
 */
export function getStorageIdentity(record) {
  if (!record || typeof record !== 'object') return null;

  const sourceId = textValue(record.sourceId);
  if (sourceId) return `v2-source-${sourceId}`;

  const composite = [
    textValue(record.gameCode),
    textValue(record.drawDate),
    getDrawSession(record),
    textValue(record.drawTime),
  ].filter(Boolean);

  if (composite.length >= 2) return `v2-composite-${composite.join('|')}`;

  const recordId = textValue(record.id);
  if (!recordId) return null;
  return recordId.startsWith('v2-') ? recordId : `v2-${recordId}`;
}

function parseStoredRecord(row) {
  if (!row?.record_json) return null;
  try {
    const parsed = JSON.parse(row.record_json);
    if (!parsed || typeof parsed !== 'object') return null;

    const digits = typeof row.numbers === 'string' && /^\d{3}$/.test(row.numbers)
      ? row.numbers.split('')
      : parsed.result;

    return {
      ...parsed,
      id: row.id ?? parsed.id,
      result: Array.isArray(digits) ? digits.map(String) : [],
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      conflictSnapshots: Array.isArray(parsed.conflictSnapshots)
        ? parsed.conflictSnapshots
        : [],
    };
  } catch {
    throw new Error('Corrupt saved draw result');
  }
}

function rowValues(record, identity) {
  const now = new Date().toISOString();
  const nextRecord = { ...record, id: identity };
  const valueByColumn = {
    id: identity,
    source_id: nullableValue(nextRecord.sourceId),
    game_code: nullableValue(nextRecord.gameCode),
    game_name: nullableValue(nextRecord.gameName),
    draw_date: nullableValue(nextRecord.drawDate) ?? '',
    slot: nullableValue(nextRecord.slot ?? nextRecord.drawNumber),
    numbers: formatCombination(nextRecord.result),
    extra_numbers: nullableValue(nextRecord.extraNumbers),
    prize_amount: nullableValue(nextRecord.jackpot),
    currency: nullableValue(nextRecord.currency),
    winners_count: nullableValue(nextRecord.totalWinners),
    winners_status: nullableValue(nextRecord.winnersStatus),
    server_time: nullableValue(nextRecord.serverTime),
    fetched_at: timestampValue(nextRecord.fetchedAt) ?? now,
    updated_at: now,
    record_json: JSON.stringify(nextRecord),
  };

  return RESULT_COLUMNS.map((column) => valueByColumn[column] ?? null);
}

const OVERLAY_FIELDS = Object.freeze([
  'lottery',
  'drawNumber',
  'drawTime',
  'gameCode',
  'gameName',
  'slot',
  'sourceId',
  'drawId',
  'serverTime',
  'timezone',
  'jackpot',
  'currency',
  'totalWinners',
  'collectedAt',
]);

function hasPublishedDigits(result) {
  return Array.isArray(result)
    && result.length === 3
    && result.every((digit) => /^\d$/.test(String(digit)));
}

function overlayMetadata(base, incoming) {
  const next = { ...base };
  for (const field of OVERLAY_FIELDS) {
    const value = incoming[field];
    if (value !== null && value !== undefined && value !== '') next[field] = value;
  }
  return next;
}

function mergeForStorage(existing, incoming) {
  const identity = incoming.id;
  const normalizedIncoming = {
    ...incoming,
    id: identity,
    result: Array.isArray(incoming.result) ? incoming.result.map(String) : [],
    sources: Array.isArray(incoming.sources) ? incoming.sources : [],
    conflictSnapshots: Array.isArray(incoming.conflictSnapshots)
      ? incoming.conflictSnapshots
      : [],
  };
  if (!existing) return normalizedIncoming;

  // A pending row can have no digits yet. Filling those digits is an update,
  // not a conflicting result, so it must not be frozen by mergeRecords.
  const shouldAdoptNumbers =
    !hasPublishedDigits(existing.result) && hasPublishedDigits(normalizedIncoming.result);
  const mergedBySource = mergeRecords([existing], [normalizedIncoming]).records[0] ?? existing;
  const merged = shouldAdoptNumbers
    ? {
        ...mergedBySource,
        result: [...normalizedIncoming.result],
        conflict: existing.conflict === true,
        conflictSnapshots: Array.isArray(existing.conflictSnapshots)
          ? existing.conflictSnapshots
          : [],
      }
    : mergedBySource;

  const winnersStatus = preferredWinnersStatus(
    existing.winnersStatus,
    normalizedIncoming.winnersStatus
  );
  const provisional = winnersStatus === 'final'
    ? false
    : winnersStatus
      ? true
      : existing.provisional ?? normalizedIncoming.provisional;

  return {
    ...overlayMetadata(merged, normalizedIncoming),
    id: identity,
    winnersStatus,
    provisional,
    fetchedAt: newerTimestamp(existing.fetchedAt, normalizedIncoming.fetchedAt),
    lastVerifiedAt: newerTimestamp(
      existing.lastVerifiedAt,
      normalizedIncoming.lastVerifiedAt
    ) ?? existing.lastVerifiedAt ?? normalizedIncoming.lastVerifiedAt ?? null,
    lastSuccessfulCaptureAt: newerTimestamp(
      existing.lastSuccessfulCaptureAt,
      normalizedIncoming.lastSuccessfulCaptureAt
    ),
  };
}

async function upsertRecordsInTransaction(db, records, stats) {
  for (const record of Array.isArray(records) ? records : []) {
    const identity = getStorageIdentity(record);
    if (!identity) {
      stats.skipped += 1;
      continue;
    }

    const previousRow = await db.getFirstAsync(
      'SELECT record_json FROM lotto_results WHERE id = ?',
      [identity]
    );
    const existing = previousRow ? parseStoredRecord(previousRow) : null;
    const nextRecord = mergeForStorage(existing, { ...record, id: identity });
    const values = rowValues(nextRecord, identity);

    if (existing) {
      await db.runAsync(UPDATE_RESULT_SQL, [...values.slice(1), identity]);
      stats.updated += 1;
    } else {
      await db.runAsync(INSERT_RESULT_SQL, values);
      stats.inserted += 1;
    }
  }

  return stats;
}

function metadataTextValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

async function writeMetadataInTransaction(db, metadata) {
  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (!key) continue;
    const text = metadataTextValue(value);
    if (text === null) continue;
    await db.runAsync(UPSERT_METADATA_SQL, [key, text, now]);
  }
}

/** Inserts or updates records atomically. Conflicting digits are never replaced. */
export async function upsertRecords(records) {
  const db = await getResultsDatabase();
  return db.withExclusiveTransactionAsync(async (txn) =>
    upsertRecordsInTransaction(txn, records, { inserted: 0, updated: 0, skipped: 0 })
  );
}

/** Persists normalized records and their sync metadata in one transaction. */
export async function persistSyncResult({ records, metadata } = {}) {
  const db = await getResultsDatabase();
  try {
    return await db.withExclusiveTransactionAsync(async (txn) => {
      const stats = await upsertRecordsInTransaction(txn, records, {
        inserted: 0,
        updated: 0,
        skipped: 0,
      });
      await writeMetadataInTransaction(txn, metadata);
      return stats;
    });
  } catch (error) {
    await saveSyncState({
      [RESULTS_METADATA_KEYS.LAST_ERROR]: 'Local results could not be saved',
    }).catch(() => {});
    throw error;
  }
}

export async function saveSyncState(metadata) {
  const db = await getResultsDatabase();
  return db.withExclusiveTransactionAsync(async (txn) => {
    await writeMetadataInTransaction(txn, metadata);
  });
}

/** Persists how many newest cached rows the Results screen may display. */
export async function setDisplayLimit(limit) {
  const displayLimit = parseDisplayLimit(limit);
  await saveSyncState({ [RESULTS_METADATA_KEYS.DISPLAY_LIMIT]: displayLimit });
  return displayLimit;
}

export async function getSyncMetadata() {
  const db = await getResultsDatabase();
  const rows = await db.getAllAsync(
    'SELECT key, value FROM results_sync_metadata'
  );
  const metadata = {};
  for (const row of rows ?? []) {
    if (!row?.key) continue;
    metadata[row.key] = row.value;
  }
  return metadata;
}

function parseJsonMetadata(value, fallback) {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function cleanGameCodes(value) {
  if (!Array.isArray(value)) return [];
  const codes = [];
  for (const code of value) {
    if (typeof code === 'string' && code && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

function cleanCursors(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const cursors = {};
  for (const [code, cursor] of Object.entries(value)) {
    if (code && typeof cursor === 'string' && cursor) cursors[code] = cursor;
  }
  return cursors;
}

function firstCursor(cursors) {
  return Object.values(cursors).find((cursor) => typeof cursor === 'string' && cursor) ?? null;
}

function buildResultFilters({ date = null, month = null, query = null } = {}) {
  const conditions = [];
  const params = [];

  if (typeof date === 'string' && date) {
    conditions.push('draw_date = ?');
    params.push(date);
  } else {
    const bounds = getMonthBounds(month);
    if (bounds) {
      conditions.push('draw_date >= ? AND draw_date < ?');
      params.push(bounds.start, bounds.end);
    }
  }

  const needle = typeof query === 'string' ? query.trim() : '';
  if (needle) {
    conditions.push('(numbers LIKE ? OR game_name LIKE ? OR game_code LIKE ?)');
    const pattern = `%${needle}%`;
    params.push(pattern, pattern, pattern);
  }

  return { conditions, params, where: conditions.join(' AND ') };
}

export async function getResultsPage({
  date = null,
  month = null,
  query = null,
  limit = RESULTS_PAGE_SIZE,
} = {}) {
  const db = await getResultsDatabase();
  const pageSize = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : RESULTS_PAGE_SIZE;
  const { where, params: filterParams } = buildResultFilters({ date, month, query });
  const whereSql = where ? `WHERE ${where} ` : '';
  const rows = await db.getAllAsync(
    `SELECT record_json FROM lotto_results ${whereSql}ORDER BY draw_date DESC, id DESC LIMIT ?`,
    [...filterParams, pageSize]
  );
  return (rows ?? []).map(parseStoredRecord).filter(Boolean);
}

export async function getDrawDates({
  date = null,
  month = null,
  query = null,
  limit = RESULTS_PAGE_SIZE,
} = {}) {
  const db = await getResultsDatabase();
  const pageSize = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : RESULTS_PAGE_SIZE;
  const {
    conditions: filterConditions,
    params: filterParams,
  } = buildResultFilters({ date, month, query });
  const conditions = ['draw_date IS NOT NULL', "draw_date <> ''", ...filterConditions];
  const rows = await db.getAllAsync(
    `SELECT DISTINCT draw_date FROM lotto_results
     WHERE ${conditions.join(' AND ')}
     ORDER BY draw_date DESC LIMIT ?`,
    [...filterParams, pageSize]
  );
  return (rows ?? [])
    .map((row) => row?.draw_date)
    .filter((item) => typeof item === 'string' && item.length > 0);
}

export async function getDrawMonths() {
  const dates = await getDrawDates({ limit: Number.MAX_SAFE_INTEGER });
  return getMonthOptions(dates);
}

export async function searchResults(query, { limit = RESULTS_PAGE_SIZE } = {}) {
  const needle = typeof query === 'string' ? query.trim() : '';
  if (!needle) return [];
  const db = await getResultsDatabase();
  const pageSize = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : RESULTS_PAGE_SIZE;
  const pattern = `%${needle}%`;
  const rows = await db.getAllAsync(
    `SELECT record_json FROM lotto_results
     WHERE numbers LIKE ? OR game_name LIKE ? OR game_code LIKE ?
     ORDER BY draw_date DESC, id DESC LIMIT ?`,
    [pattern, pattern, pattern, pageSize]
  );
  return (rows ?? []).map(parseStoredRecord).filter(Boolean);
}

export async function getRecordCount({ date = null, month = null, query = null } = {}) {
  const db = await getResultsDatabase();
  const { where, params } = buildResultFilters({ date, month, query });
  const whereSql = where ? ` WHERE ${where}` : '';
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS count FROM lotto_results${whereSql}`,
    params
  );
  return Number(row?.count ?? 0);
}

/**
 * Imports the previous AsyncStorage cache once. Existing SQLite data always
 * wins, and a failed import never blocks the screen.
 */
export async function importLegacyCacheIfEmpty() {
  let metadata;
  try {
    metadata = await getSyncMetadata();
  } catch {
    return false;
  }

  if (metadata[RESULTS_METADATA_KEYS.LEGACY_IMPORTED] === '1') return false;

  try {
    const count = await getRecordCount();
    if (count > 0) {
      await saveSyncState({ [RESULTS_METADATA_KEYS.LEGACY_IMPORTED]: '1' });
      return false;
    }

    const cache = await loadDrawResults();
    const records = Array.isArray(cache?.records) ? cache.records : [];
    if (records.length > 0) await upsertRecords(records);

    await saveSyncState({
      [RESULTS_METADATA_KEYS.LEGACY_IMPORTED]: '1',
      [RESULTS_METADATA_KEYS.GAME_CODES]: cache?.gameCodes ?? [],
      [RESULTS_METADATA_KEYS.HISTORY_CURSORS]: cache?.historyCursors ?? {},
      [RESULTS_METADATA_KEYS.HAS_MORE]: cache?.hasMore === true,
      [RESULTS_METADATA_KEYS.LAST_SYNC_AT]: cache?.lastSyncAt ?? null,
    });
    return records.length > 0;
  } catch (error) {
    console.warn('Failed to import cached draw results into SQLite:', error);
    return false;
  }
}

/** One bounded snapshot for the screen: page rows, all dates, and sync state. */
export async function getResultsSnapshot({
  date = null,
  month = null,
  query = null,
  limit = null,
} = {}) {
  await importLegacyCacheIfEmpty();

  const metadata = await getSyncMetadata();
  const displayLimit = parseDisplayLimit(
    metadata[RESULTS_METADATA_KEYS.DISPLAY_LIMIT]
  );
  const effectiveLimit = limit === null ? displayLimit : limit;

  const [records, drawDates, totalCount, drawMonths] = await Promise.all([
    getResultsPage({ date, month, query, limit: effectiveLimit }),
    getDrawDates({ date, month, query, limit: effectiveLimit }),
    getRecordCount({ date, month, query }),
    getDrawMonths(),
  ]);

  const gameCodes = cleanGameCodes(
    parseJsonMetadata(metadata[RESULTS_METADATA_KEYS.GAME_CODES], [])
  );
  const historyCursors = cleanCursors(
    parseJsonMetadata(metadata[RESULTS_METADATA_KEYS.HISTORY_CURSORS], {})
  );

  return {
    records,
    drawDates,
    drawMonths,
    totalCount,
    displayLimit,
    gameCodes,
    historyCursors,
    nextCursor: firstCursor(historyCursors),
    hasMore: metadata[RESULTS_METADATA_KEYS.HAS_MORE] === '1',
    lastSyncAt: metadata[RESULTS_METADATA_KEYS.LAST_SYNC_AT] ?? null,
  };
}
