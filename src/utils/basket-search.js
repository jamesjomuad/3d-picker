/**
 * Collection search
 *
 * Filters saved basket entries in memory, immediately, from two kinds of
 * text: a partial digit sequence (leading zeros included) and spreadsheet
 * cell coordinates. It never edits or reorders the persisted entries; the
 * returned array holds the same entry objects in their original order.
 */

import { getPathReference } from '@/utils/cell-reference';

/**
 * Lowercase, strip punctuation, keep alphanumeric runs.
 *
 * `A1 → B4`, `a1,b4` and `A1-B4` all become coordinate tokens; `A1B4` stays a
 * single token so the compact path can match it as one run.
 *
 * @param {string} query
 * @returns {string[]}
 */
function getQueryTokens(query) {
  return String(query ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Compact coordinate string, e.g. "A1 → B4" -> "a1b4".
 *
 * @param {Array<{row: number, column?: number, col?: number}>} path
 * @returns {string}
 */
function getCompactPath(path) {
  if (!Array.isArray(path)) return '';
  return getPathReference(path).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * One token must match either the digits or the saved cell path.
 *
 * Digits are matched as a string, so `074` keeps its leading zero and `74`
 * remains a valid partial match. Coordinate tokens work against the compact
 * path, so users can type `A1`, `A1 → B4`, `a1,b4` or `A1B4`.
 *
 * @param {Object} entry
 * @param {string} token
 * @returns {boolean}
 */
function matchesToken(entry, token) {
  if (/^\d+$/.test(token)) {
    return String(entry?.digits ?? '').includes(token);
  }
  return getCompactPath(entry?.path).includes(token);
}

/**
 * Filter saved picks by digit sequence and/or cell coordinates.
 *
 * Every token must match something, so `074 A1` narrows to picks that satisfy
 * both. An empty query returns all entries, never a copied or reordered list.
 *
 * @param {Array<Object>} entries
 * @param {string} query
 * @returns {Array<Object>}
 */
export function filterBasketEntries(entries, query) {
  if (!Array.isArray(entries)) return [];
  const tokens = getQueryTokens(query);
  if (tokens.length === 0) return entries;

  return entries.filter((entry) => tokens.every((token) => matchesToken(entry, token)));
}
