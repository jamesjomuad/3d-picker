/**
 * Collection tables added to the shared `results.db` database.
 *
 * Schema changes are additive. Results tables and sync metadata stay untouched.
 */

export const COLLECTION_TABLE_NAME = 'collection_items';
export const COLLECTION_METADATA_TABLE_NAME = 'collection_metadata';

export const COLLECTION_METADATA_KEYS = Object.freeze({
  LEGACY_IMPORTED: 'collection_legacy_imported',
});

export const CREATE_COLLECTION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS collection_items (
  id TEXT PRIMARY KEY NOT NULL,
  combination TEXT NOT NULL UNIQUE,
  coordinates TEXT NOT NULL,
  search_text TEXT NOT NULL,
  added_at TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const CREATE_COLLECTION_METADATA_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS collection_metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT,
  updated_at TEXT
);
`;

export const CREATE_COLLECTION_INDEXES_SQL = Object.freeze([
  'CREATE INDEX IF NOT EXISTS idx_collection_added_at ON collection_items(added_at DESC, id DESC);',
  'CREATE INDEX IF NOT EXISTS idx_collection_favorite_added_at ON collection_items(is_favorite, added_at DESC, id DESC);',
]);

export const COLLECTION_MIGRATION_STATEMENTS = Object.freeze([
  CREATE_COLLECTION_TABLE_SQL,
  CREATE_COLLECTION_METADATA_TABLE_SQL,
  ...CREATE_COLLECTION_INDEXES_SQL,
]);
