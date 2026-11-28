import * as SQLite from 'expo-sqlite';

import {
  RESULTS_DATABASE_NAME,
  RESULTS_SCHEMA_VERSION,
  statementsForSchemaVersion,
} from './results-schema';

/**
 * Shared SQLite connection for Results.
 *
 * One open promise prevents concurrent screen calls from opening or migrating
 * the same database twice. A failed open clears the promise so a later call
 * can retry instead of reusing a broken connection.
 */

let databasePromise = null;

async function applyMigrations(db) {
  await db.execAsync('PRAGMA journal_mode = WAL;');

  const currentRow = await db.getFirstAsync('PRAGMA user_version');
  const parsedVersion = Number(currentRow?.user_version ?? 0);
  const currentVersion = Number.isFinite(parsedVersion) && parsedVersion > 0
    ? Math.floor(parsedVersion)
    : 0;

  if (currentVersion >= RESULTS_SCHEMA_VERSION) return;

  for (let version = currentVersion + 1; version <= RESULTS_SCHEMA_VERSION; version += 1) {
    await db.withTransactionAsync(async () => {
      for (const statement of statementsForSchemaVersion(version)) {
        await db.execAsync(statement);
      }
      await db.execAsync(`PRAGMA user_version = ${version};`);
    });
  }
}

/** Opens, migrates and returns the Results database. */
export function getResultsDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync(RESULTS_DATABASE_NAME);
      await applyMigrations(db);
      return db;
    })().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

/** Test-only reset for the connection singleton. */
export function resetResultsDatabaseForTests() {
  databasePromise = null;
}
