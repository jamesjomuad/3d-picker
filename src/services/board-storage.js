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
 * Creates the default library structure with one board from legacy data
 * @returns {BoardLibrary}
 */
function createDefaultLibrary() {
  const board = createBoard({ name: 'Angle Board 001' });
  return {
    version: 1,
    activeBoardId: board.id,
    boards: [board],
  };
}

/**
 * Attempts to load the legacy static board and migrate it
 * @returns {BoardLibrary | null}
 */
async function migrateLegacyBoard() {
  try {
    // Check if we've already migrated
    const alreadyMigrated = await AsyncStorage.getItem(LEGACY_BOARD_KEY);
    if (alreadyMigrated) return null;

    // Load the static board data
    const legacyData = require('@/data/angle-board.json');
    const validation = validateBoard(legacyData);

    if (!validation.valid) {
      console.warn('Legacy board validation failed:', validation.error);
      return null;
    }

    // Create a board from the legacy data
    const now = new Date().toISOString();
    const migratedBoard = {
      id: 'board-001',
      name: legacyData.name,
      isFavorite: false,
      grid: legacyData.grid.map((row) => [...row]),
      createdAt: now,
      updatedAt: now,
    };

    const library = {
      version: 1,
      activeBoardId: migratedBoard.id,
      boards: [migratedBoard],
    };

    // Mark as migrated so we don't run this again
    await AsyncStorage.setItem(LEGACY_BOARD_KEY, 'true');

    return library;
  } catch (error) {
    console.warn('Legacy migration failed:', error);
    return null;
  }
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
