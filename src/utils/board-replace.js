/**
 * Replace-all-digits operation for an editable Angle Board.
 *
 * Scans the entire grid for cells matching a `findDigit` and produces a
 * changes map that swaps each match for `replaceDigit`. Pure: it never
 * mutates the grid and returns the same `{ "row,col": digit }` shape
 * that `applyCells` accepts.
 */

import { isValidDigit } from './board-validation';

/**
 * Count how many cells hold `findDigit` across the whole grid.
 *
 * @param {number[][]} grid
 * @param {number} findDigit - integer 0–9
 * @returns {number} match count
 */
export function countMatches(grid, findDigit) {
  if (!grid || !grid.length) return 0;
  if (!isValidDigit(findDigit)) return 0;

  let count = 0;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === findDigit) count++;
    }
  }
  return count;
}

/**
 * Compute the changes map for replacing every occurrence of `findDigit`
 * with `replaceDigit` across the whole grid.
 *
 * @param {number[][]} grid - current board grid (not mutated)
 * @param {number} findDigit - digit to search for (0–9)
 * @param {number} replaceDigit - digit to write in its place (0–9)
 * @returns {{ count: number, changes: Object<string, number> }}
 *   `count` is the number of matching cells, `changes` is a map the
 *   store's `applyCells` can consume directly. Empty when there is
 *   nothing to replace.
 */
export function computeReplace(grid, findDigit, replaceDigit) {
  if (!grid || !grid.length) return { count: 0, changes: {} };
  if (!isValidDigit(findDigit) || !isValidDigit(replaceDigit)) {
    return { count: 0, changes: {} };
  }
  if (findDigit === replaceDigit) return { count: 0, changes: {} };

  const changes = {};
  let count = 0;

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === findDigit) {
        changes[`${r},${c}`] = replaceDigit;
        count++;
      }
    }
  }

  return { count, changes };
}
