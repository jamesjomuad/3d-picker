/**
 * Board library persistence service
 * Loads and saves the board library to AsyncStorage
 * Handles migration from the legacy static JSON format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { validateBoard } from '@/utils/board-validation';
import { createBoard } from '@/utils/board-factory';

const STORAGE_KEY = 'board-library-v1';
const LEGACY_BOARD_KEY = 'board-library-legacy-migrated';
const SEED_BOARD_NAME = 'Angle Board 001';
/** ID the migration gives the board taken from the static seed file. */
const SEED_BOARD_ID = 'board-001';

/**
 * @typedef {Object} Board
 * @property {string} id
 * @property {string} name
 * @property {boolean} isFavorite
 * @property {number[][]} grid
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} BoardLibrary
 * @property {number} version
 * @property {string} activeBoardId
 * @property {Board[]} boards
 */

/**
 * Reads the seed board from the bundled static JSON
 * @returns {Board|null} a library board built from the seed file, or null
 *   when the file is missing or fails validation
 */
function readSeedBoard() {
  try {
    const seedData = require('@/data/angle-board.json');
    const validation = validateBoard(seedData);

    if (!validation.valid) {
      console.warn('Seed board validation failed:', validation.error);
      return null;
    }

    const now = new Date().toISOString();
    return {
      id: SEED_BOARD_ID,
      name: seedData.name,
      isFavorite: false,
      grid: seedData.grid.map((row) => [...row]),
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    console.warn('Seed board load failed:', error);
    return null;
  }
}

/**
 * True when a library is exactly one all-zero board carrying the seed name —
 * the shape left behind when the first run saved the zero-filled fallback in
 * place of the migrated seed. A real user board may legitimately contain
 * zeros, but a board that is only zeros under this exact name is the
 * fallback, and the bundled seed file should win.
 * @param {BoardLibrary} library
 * @returns {boolean}
 */
function isZeroSeedFallback(library) {
  if (!library || library.version !== 1 || !Array.isArray(library.boards)) return false;
  if (library.boards.length !== 1) return false;

  const board = library.boards[0];
  if (!board || board.name !== SEED_BOARD_NAME || !Array.isArray(board.grid)) return false;

  return board.grid.every((row) => Array.isArray(row) && row.every((value) => value === 0));
}

/**
 * Creates the default library structure: the seed board when the static
 * file is readable, an empty board only as a last resort
 * @returns {BoardLibrary}
 */
function createDefaultLibrary() {
  const board = readSeedBoard() ?? createBoard({ name: SEED_BOARD_NAME });
  return {
    version: 1,
    activeBoardId: board.id,
    boards: [board],
  };
}

/**
 * Builds a library from the legacy static board
 *
 * There is deliberately no "already migrated" short-circuit here: this only
 * runs when storage holds no usable library, and re-reading the seed file is
 * the correct recovery whenever that happens (for example after a first run
 * that set the flag but never persisted the board).
 * @returns {Promise<BoardLibrary | null>}
 */
async function migrateLegacyBoard() {
  const seed = readSeedBoard();
  if (!seed) return null;

  // Keep the marker for storage inspectors; loading no longer depends on it.
  try {
    await AsyncStorage.setItem(LEGACY_BOARD_KEY, 'true');
  } catch {
    // Marker is best-effort — the library contents are the real record.
  }

  return {
    version: 1,
    activeBoardId: seed.id,
    boards: [seed],
  };
}

/**
 * Loads the board library from storage
 * Falls back to legacy migration, then to a default library
 * @returns {Promise<BoardLibrary>}
 */
export async function loadLibrary() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);

    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.version === 1 && Array.isArray(parsed.boards)) {
        if (isZeroSeedFallback(parsed)) {
          // A past first run persisted the all-zero fallback in place of the
          // seed board (the old migration flag could short-circuit between the
          // flag write and the save). Restore the seed digits once; after
          // this the board carries real content and is never touched again.
          const restored = await migrateLegacyBoard();
          if (restored) {
            await saveLibrary(restored);
            return restored;
          }
        }
        return parsed;
      }
    }

    // Try migrating from legacy static board
    const migrated = await migrateLegacyBoard();
    if (migrated) {
      await saveLibrary(migrated);
      return migrated;
    }

    // Fall back to default
    const defaultLibrary = createDefaultLibrary();
    await saveLibrary(defaultLibrary);
    return defaultLibrary;
  } catch (error) {
    console.error('Failed to load board library:', error);
    const fallback = createDefaultLibrary();
    await saveLibrary(fallback);
    return fallback;
  }
}

/**
 * Saves the board library to storage
 * @param {BoardLibrary} library
 * @returns {Promise<void>}
 */
export async function saveLibrary(library) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch (error) {
    console.error('Failed to save board library:', error);
    throw error;
  }
}

/**
 * Clears the board library from storage (for testing)
 * @returns {Promise<void>}
 */
export async function clearLibrary() {
  await AsyncStorage.removeItem(STORAGE_KEY);
  await AsyncStorage.removeItem(LEGACY_BOARD_KEY);
}
