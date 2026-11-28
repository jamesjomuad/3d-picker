/**
 * Collection persistence on the shared Results SQLite database.
 *
 * SQLite is the source of truth after the first successful load. Legacy
 * AsyncStorage basket data is imported once, in a transaction, and kept on
 * disk until the import is verified.
 */

import { getResultsDatabase } from '../../results/database/results-database';
import { loadBasket } from '../../../services/basket-storage';
import { getPathReference } from '../../../utils/cell-reference';
import {
  COLLECTION_METADATA_KEYS,
  COLLECTION_TABLE_NAME,
} from './collection-schema';

const SELECT_COLUMNS = 'id, combination, coordinates, added_at, is_favorite';
let legacyMigrationPromise = null;

export function resetCollectionMigrationForTests() {
  legacyMigrationPromise = null;
}

function hasValidTimestamp(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  if (value === '') return false;
  return !Number.isNaN(new Date(value).getTime());
}

function normalizePath(path) {
  if (!Array.isArray(path) || path.length === 0) return null;
  const cells = [];
  for (const cell of path) {
    if (!cell || !Number.isInteger(cell.row) || !Number.isInteger(cell.column)) return null;
    cells.push({ row: cell.row, column: cell.column });
  }
  return cells;
}

/** Tokens match `filterBasketEntries` so repository search preserves UI behavior. */
export function tokenizeCollectionQuery(query) {
  const text = typeof query === 'string' ? query.toLowerCase() : '';
  return text.match(/[a-z0-9]+/g) ?? [];
}

function buildSearchText(digits, path) {
  const coordinates = getPathReference(path).replace(/[^a-z0-9]/gi, '').toLowerCase();
  return `${digits.toLowerCase()}${coordinates}`;
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Stable local ID. Combination digits alone are never used as identity. */
export function createCollectionId(entry) {
  const path = normalizePath(entry?.path) ?? [];
  const addedAt = hasValidTimestamp(entry?.addedAt) ? String(entry.addedAt) : '';
  return `basket-${stableHash(`${entry?.digits ?? ''}|${JSON.stringify(path)}|${addedAt}`)}`;
}

export function normalizeCollectionEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (typeof entry.digits !== 'string' || entry.digits.length === 0) return null;
  const path = normalizePath(entry.path);
  if (!path) return null;

  const addedAt = hasValidTimestamp(entry.addedAt) ? String(entry.addedAt) : null;
  const id =
    typeof entry.id === 'string' && entry.id.length > 0
      ? entry.id
      : createCollectionId({ digits: entry.digits, path, addedAt });

  return {
    id,
    digits: entry.digits,
    path,
    addedAt,
    isFavorite: entry.isFavorite === true || entry.isFavorite === 1,
  };
}

function rowToEntry(row) {
  let path = [];
  try {
    path = JSON.parse(row.coordinates);
  } catch (_error) {
    path = [];
  }
  if (!normalizePath(path)) path = [];

  return {
    id: row.id,
    digits: row.combination,
    path,
    addedAt: typeof row.added_at === 'string' && row.added_at.length > 0
      ? row.added_at
      : undefined,
    isFavorite: Number(row.is_favorite) === 1,
  };
}

async function getMetadata(db, key) {
  const row = await db.getFirstAsync(
    `SELECT value FROM collection_metadata WHERE key = ?`,
    [key]
  );
  return typeof row?.value === 'string' ? row.value : null;
}

async function setMetadata(db, key, value) {
  await db.runAsync(
    `INSERT INTO collection_metadata (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, new Date().toISOString()]
  );
}

async function insertEntry(db, entry, now = new Date().toISOString()) {
  await db.runAsync(
    `INSERT INTO ${COLLECTION_TABLE_NAME}
      (id, combination, coordinates, search_text, added_at, is_favorite, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(combination) DO NOTHING`,
    [
      entry.id,
      entry.digits,
      JSON.stringify(entry.path),
      buildSearchText(entry.digits, entry.path),
      entry.addedAt,
      entry.isFavorite ? 1 : 0,
      now,
      now,
    ]
  );

  const row = await db.getFirstAsync(
    `SELECT ${SELECT_COLUMNS} FROM ${COLLECTION_TABLE_NAME} WHERE combination = ?`,
    [entry.digits]
  );
  return rowToEntry(row);
}

async function markLegacyImported(db) {
  await setMetadata(db, COLLECTION_METADATA_KEYS.LEGACY_IMPORTED, '1');
}

async function runLegacyBasketMigration(db) {
  if (await getMetadata(db, COLLECTION_METADATA_KEYS.LEGACY_IMPORTED)) return;

  const countRow = await db.getFirstAsync(
    `SELECT COUNT(*) AS count FROM ${COLLECTION_TABLE_NAME}`
  );
  const existingCount = Number(countRow?.count ?? 0);
  if (Number.isFinite(existingCount) && existingCount > 0) {
    await markLegacyImported(db);
    return;
  }

  const legacy = await loadBasket();
  const prepared = [];
  const seen = new Set();
  for (const raw of legacy) {
    const entry = normalizeCollectionEntry(raw);
    if (!entry || seen.has(entry.digits)) continue;
    seen.add(entry.digits);
    prepared.push(entry);
  }

  if (prepared.length === 0) {
    await markLegacyImported(db);
    return;
  }

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const entry of prepared) {
      await insertEntry(txn, entry);
    }

    const verifyRow = await txn.getFirstAsync(
      `SELECT COUNT(*) AS count FROM ${COLLECTION_TABLE_NAME}`
    );
    if (Number(verifyRow?.count ?? 0) !== prepared.length) {
      throw new Error('Collection migration verification failed');
    }
    await markLegacyImported(txn);
  });
}

/** One migration at a time on the shared connection, even under concurrent loads. */
async function migrateLegacyBasketIfNeeded(db) {
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = runLegacyBasketMigration(db).catch((error) => {
      legacyMigrationPromise = null;
      throw error;
    });
  }
  return legacyMigrationPromise;
}

async function readyDatabase() {
  const db = await getResultsDatabase();
  await migrateLegacyBasketIfNeeded(db);
  return db;
}

function appendTokenClause(sql, params, token) {
  if (/^\d+$/.test(token)) {
    return {
      sql: `${sql} AND combination LIKE ?`,
      params: [...params, `%${token}%`],
    };
  }
  return {
    sql: `${sql} AND search_text LIKE ?`,
    params: [...params, `%${token}%`],
  };
}

async function queryEntries(db, { favoritesOnly = false, query = '' } = {}) {
  let sql = `SELECT ${SELECT_COLUMNS} FROM ${COLLECTION_TABLE_NAME} WHERE 1 = 1`;
  let params = [];

  if (favoritesOnly) {
    sql = `${sql} AND is_favorite = 1`;
  }

  for (const token of tokenizeCollectionQuery(query)) {
    const next = appendTokenClause(sql, params, token);
    sql = next.sql;
    params = next.params;
  }

  sql = `${sql} ORDER BY added_at DESC, id DESC`;
  const rows = await db.getAllAsync(sql, params);
  return rows.map(rowToEntry);
}

async function getCounts(db) {
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END), 0) AS favorites
     FROM ${COLLECTION_TABLE_NAME}`
  );
  return {
    totalCount: Number(row?.total ?? 0),
    favoriteCount: Number(row?.favorites ?? 0),
  };
}

/** Load entries matching the active temporary filter and search query. */
export async function getCollectionSnapshot(options = {}) {
  const db = await readyDatabase();
  const [entries, counts] = await Promise.all([
    queryEntries(db, options),
    getCounts(db),
  ]);
  return { entries, ...counts };
}

/** Load every saved entry, independent of the active UI filter or search. */
export async function getAllCollectionEntries() {
  const db = await readyDatabase();
  return queryEntries(db);
}

/** Find an entry by combination. Used for duplicate checks outside the active filter. */
export async function getCollectionEntryByDigits(digits) {
  if (typeof digits !== 'string' || digits.length === 0) return null;
  const db = await readyDatabase();
  const row = await db.getFirstAsync(
    `SELECT ${SELECT_COLUMNS} FROM ${COLLECTION_TABLE_NAME} WHERE combination = ?`,
    [digits]
  );
  return row ? rowToEntry(row) : null;
}

/** Save one entry. Duplicate combinations keep their original row and timestamp. */
export async function saveCollectionEntry(entry) {
  const normalized = normalizeCollectionEntry({
    ...entry,
    addedAt: hasValidTimestamp(entry?.addedAt)
      ? entry.addedAt
      : new Date().toISOString(),
  });
  if (!normalized) return null;

  const db = await readyDatabase();
  return insertEntry(db, normalized);
}

/** Save many entries atomically. */
export async function saveCollectionEntries(entries) {
  const normalized = [];
  const seen = new Set();
  for (const raw of entries ?? []) {
    const entry = normalizeCollectionEntry({
      ...raw,
      addedAt: hasValidTimestamp(raw?.addedAt)
        ? raw.addedAt
        : new Date().toISOString(),
    });
    if (!entry || seen.has(entry.digits)) continue;
    seen.add(entry.digits);
    normalized.push(entry);
  }
  if (normalized.length === 0) return [];

  const db = await readyDatabase();
  return db.withExclusiveTransactionAsync(async (txn) => {
    const saved = [];
    for (const entry of normalized) {
      saved.push(await insertEntry(txn, entry));
    }
    return saved;
  });
}

/** Update only the favorite flag for one stable entry ID. */
export async function setCollectionFavorite(id, isFavorite) {
  if (typeof id !== 'string' || id.length === 0) return 0;
  const db = await readyDatabase();
  const result = await db.runAsync(
    `UPDATE ${COLLECTION_TABLE_NAME} SET is_favorite = ?, updated_at = ? WHERE id = ?`,
    [isFavorite ? 1 : 0, new Date().toISOString(), id]
  );
  return Number(result?.rowsAffected ?? 0);
}

export async function removeCollectionEntry(id) {
  if (typeof id !== 'string' || id.length === 0) return 0;
  const db = await readyDatabase();
  const result = await db.runAsync(
    `DELETE FROM ${COLLECTION_TABLE_NAME} WHERE id = ?`,
    [id]
  );
  return Number(result?.rowsAffected ?? 0);
}

export async function removeCollectionEntries(ids) {
  const cleanIds = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && id) : [];
  if (cleanIds.length === 0) return 0;

  const db = await readyDatabase();
  return db.withExclusiveTransactionAsync(async (txn) => {
    let removed = 0;
    for (const id of cleanIds) {
      const result = await txn.runAsync(
        `DELETE FROM ${COLLECTION_TABLE_NAME} WHERE id = ?`,
        [id]
      );
      removed += Number(result?.rowsAffected ?? 0);
    }
    return removed;
  });
}

/** Empty Collection. The migration flag stays set so legacy data never returns. */
export async function clearCollection() {
  const db = await readyDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(`DELETE FROM ${COLLECTION_TABLE_NAME}`);
    await markLegacyImported(txn);
  });
}

/** Replace all Collection rows in one transaction. Used by backup restore. */
export async function replaceCollectionEntries(entries) {
  const normalized = [];
  const seen = new Set();
  for (const raw of entries ?? []) {
    const entry = normalizeCollectionEntry(raw);
    if (!entry || seen.has(entry.digits)) continue;
    seen.add(entry.digits);
    normalized.push(entry);
  }

  const db = await readyDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(`DELETE FROM ${COLLECTION_TABLE_NAME}`);
    for (const entry of normalized) {
      await insertEntry(txn, entry);
    }

    const verifyRow = await txn.getFirstAsync(
      `SELECT COUNT(*) AS count FROM ${COLLECTION_TABLE_NAME}`
    );
    if (Number(verifyRow?.count ?? 0) !== normalized.length) {
      throw new Error('Collection restore verification failed');
    }
    await markLegacyImported(txn);
  });
  return getCollectionSnapshot();
}
