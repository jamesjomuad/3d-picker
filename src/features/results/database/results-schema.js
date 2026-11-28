/**
 * SQLite schema for 3D Lotto results.
 *
 * The database stays local to this device. Schema changes are additive and
 * driven by `PRAGMA user_version`; no old table is dropped during init.
 */

import { COLLECTION_MIGRATION_STATEMENTS } from '../../collection/database/collection-schema';

export const RESULTS_DATABASE_NAME = 'results.db';
export const RESULTS_SCHEMA_VERSION = 2;
export const RESULTS_PAGE_SIZE = 200;

export const RESULTS_METADATA_KEYS = Object.freeze({
  GAME_CODES: 'game_codes',
  HISTORY_CURSORS: 'history_cursors',
  HAS_MORE: 'has_more',
  LAST_SYNC_AT: 'last_sync_at',
  LATEST_SYNCED_AT: 'latest_synced_at',
  HISTORY_SYNCED_AT: 'history_synced_at',
  LEGACY_IMPORTED: 'legacy_imported',
  DISPLAY_LIMIT: 'display_limit',
  LAST_ERROR: 'last_error',
});

/** Number of newest local records currently shown by the Results screen. */
export const RESULTS_DISPLAY_LIMIT_STEP = RESULTS_PAGE_SIZE;

export function parseDisplayLimit(value, fallback = RESULTS_PAGE_SIZE) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(RESULTS_PAGE_SIZE, Math.floor(parsed / RESULTS_PAGE_SIZE) * RESULTS_PAGE_SIZE);
}

export const CREATE_RESULTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS lotto_results (
  id TEXT PRIMARY KEY NOT NULL,
  source_id TEXT,
  game_code TEXT,
  game_name TEXT,
  draw_date TEXT NOT NULL,
  slot TEXT,
  numbers TEXT NOT NULL,
  extra_numbers TEXT,
  prize_amount TEXT,
  currency TEXT,
  winners_count TEXT,
  winners_status TEXT,
  server_time TEXT,
  fetched_at TEXT,
  updated_at TEXT,
  record_json TEXT NOT NULL
);
`;

export const CREATE_RESULTS_INDEXES_SQL = Object.freeze([
  'CREATE INDEX IF NOT EXISTS idx_results_draw_date ON lotto_results(draw_date DESC, id DESC);',
  'CREATE INDEX IF NOT EXISTS idx_results_game_code ON lotto_results(game_code, draw_date DESC);',
  'CREATE INDEX IF NOT EXISTS idx_results_slot ON lotto_results(slot, draw_date DESC);',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_results_source_id ON lotto_results(source_id) WHERE source_id IS NOT NULL;',
]);

export const CREATE_METADATA_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS results_sync_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT,
  updated_at TEXT
);
`;

const MIGRATIONS = Object.freeze({
  1: [
    CREATE_RESULTS_TABLE_SQL,
    CREATE_METADATA_TABLE_SQL,
    ...CREATE_RESULTS_INDEXES_SQL,
  ],
  2: COLLECTION_MIGRATION_STATEMENTS,
});

/** Every migration for one schema version. Unknown versions are no-ops. */
export function statementsForSchemaVersion(version) {
  return MIGRATIONS[version] ?? [];
}
