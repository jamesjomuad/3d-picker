/**
 * Draw results persistence
 * Local AsyncStorage only — results stay on the device and survive restarts.
 * Same never-throw contract as the other storage services: a failed read
 * resolves to an empty cache instead of breaking the screen.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'draw-results-v1';

function isValidRecord(record) {
  return (
    record &&
    typeof record === 'object' &&
    typeof record.id === 'string' &&
    record.id &&
    typeof record.lottery === 'string' &&
    Array.isArray(record.result) &&
    record.result.every((digit) => typeof digit === 'string') &&
    typeof record.drawDate === 'string'
  );
}

/**
 * Reads the cached draw results.
 *
 * @returns {Promise<{ records: Object[], nextCursor: string|null, hasMore: boolean, lastSyncAt: string|null }>}
 */
export async function loadDrawResults() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { records: [], nextCursor: null, hasMore: false, lastSyncAt: null };

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.records)) {
      return { records: [], nextCursor: null, hasMore: false, lastSyncAt: null };
    }

    return {
      records: parsed.records.filter(isValidRecord),
      nextCursor: typeof parsed.nextCursor === 'string' ? parsed.nextCursor : null,
      hasMore: parsed.hasMore === true,
      lastSyncAt: typeof parsed.lastSyncAt === 'string' ? parsed.lastSyncAt : null,
    };
  } catch (error) {
    console.warn('Failed to load draw results:', error);
    return { records: [], nextCursor: null, hasMore: false, lastSyncAt: null };
  }
}

/**
 * Saves the draw results cache. Replaces the stored set — records are merged
 * by id before this is called, so nothing is duplicated here.
 *
 * @param {Object} state
 * @param {Object[]} state.records
 * @param {string|null} state.nextCursor
 * @param {boolean} state.hasMore
 * @param {string|null} state.lastSyncAt
 * @returns {Promise<void>}
 */
export async function saveDrawResults({ records, nextCursor, hasMore, lastSyncAt }) {
  const payload = {
    version: 1,
    records,
    nextCursor,
    hasMore,
    lastSyncAt,
    savedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
