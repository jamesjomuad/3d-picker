/**
 * Draw results persistence
 * Local AsyncStorage only — results stay on the device and survive restarts.
 * Same never-throw contract as the other storage services: a failed read
 * resolves to an empty cache instead of breaking the screen.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'draw-results-v1';

function emptyCache() {
  return {
    records: [],
    nextCursor: null,
    hasMore: false,
    lastSyncAt: null,
    gameCodes: [],
    historyCursors: {},
  };
}

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

function sanitizeGameCodes(value) {
  if (!Array.isArray(value)) return [];
  const codes = [];
  for (const code of value) {
    if (typeof code === 'string' && code && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

function sanitizeHistoryCursors(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const cursors = {};
  for (const [code, cursor] of Object.entries(value)) {
    if (code && typeof cursor === 'string' && cursor) cursors[code] = cursor;
  }
  return cursors;
}

/**
 * Reads the cached draw results.
 *
 * @returns {Promise<{
 *   records: Object[],
 *   nextCursor: string|null,
 *   hasMore: boolean,
 *   lastSyncAt: string|null,
 *   gameCodes: string[],
 *   historyCursors: Object<string,string>
 * }>}
 */
export async function loadDrawResults() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCache();

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.records)) {
      return emptyCache();
    }

    return {
      records: parsed.records.filter(isValidRecord),
      nextCursor: typeof parsed.nextCursor === 'string' ? parsed.nextCursor : null,
      hasMore: parsed.hasMore === true,
      lastSyncAt: typeof parsed.lastSyncAt === 'string' ? parsed.lastSyncAt : null,
      gameCodes: sanitizeGameCodes(parsed.gameCodes),
      historyCursors: sanitizeHistoryCursors(parsed.historyCursors),
    };
  } catch (error) {
    console.warn('Failed to load draw results:', error);
    return emptyCache();
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
 * @param {string[]} state.gameCodes
 * @param {Object<string,string>} state.historyCursors
 * @returns {Promise<void>}
 */
export async function saveDrawResults({
  records,
  nextCursor,
  hasMore,
  lastSyncAt,
  gameCodes = [],
  historyCursors = {},
}) {
  const payload = {
    version: 1,
    records,
    nextCursor,
    hasMore,
    lastSyncAt,
    gameCodes,
    historyCursors,
    savedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
