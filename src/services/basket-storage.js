/**
 * Selection Basket persistence service
 *
 * Loads and saves the Fun Pick Selection Basket to AsyncStorage, following
 * the same local-first pattern as `@/services/board-storage`. The stored
 * document is `{ version: 1, entries }` where an entry is
 * `{ digits, path }` — plain JSON, so a basket survives navigation and app
 * restarts. Corrupted or unreadable storage resolves to an empty basket
 * rather than throwing: the basket is a convenience collection, and losing
 * it silently beats blocking the screen that reads it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'selection-basket-v1';

/**
 * Whether a parsed entry has the shape the basket relies on.
 * @param {unknown} entry
 * @returns {boolean}
 */
function isValidEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (typeof entry.digits !== 'string' || entry.digits.length === 0) return false;
  if (!Array.isArray(entry.path) || entry.path.length === 0) return false;
  return entry.path.every(
    (cell) => cell && Number.isInteger(cell.row) && Number.isInteger(cell.column)
  );
}

/**
 * Load the saved basket entries.
 * @returns {Promise<Array<{ digits: string, path: Array<{ row: number, column: number }> }>>}
 */
export async function loadBasket() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) return [];

    return parsed.entries.filter(isValidEntry);
  } catch (error) {
    console.error('Failed to load selection basket:', error);
    return [];
  }
}

/**
 * Persist the basket entries.
 * @param {Array<{ digits: string, path: Array }>} entries
 * @returns {Promise<void>}
 */
export async function saveBasket(entries) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries }));
}
