/**
 * Replace-all-digits operation for an editable Angle Board.
 *
 * Everything here is pure and takes the grid it searches as an argument, so
 * the caller decides what the "board" is. The Replace tool passes the snapshot
 * captured when the editing session began, not the working grid: a cell a
 * previous replacement wrote must not become a source for the next one.
 */

import { isValidDigit } from './board-validation';

/**
 * Collect the "row,col" keys of every cell holding `findDigit`.
 *
 * @param {number[][]} grid
 * @param {number} findDigit - integer 0–9
 * @returns {string[]} matching cell keys, in row-major order
 */
export function getMatchingCells(grid, findDigit) {
  if (!grid || !grid.length) return [];
  if (!isValidDigit(findDigit)) return [];

  const cells = [];
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === findDigit) cells.push(`${r},${c}`);
    }
  }
  return cells;
}

/**
 * Count how many cells hold `findDigit` across the whole grid.
 *
 * @param {number[][]} grid
 * @param {number} findDigit - integer 0–9
 * @returns {number} match count
 */
export function countMatches(grid, findDigit) {
  return getMatchingCells(grid, findDigit).length;
}

/**
 * Compute the changes map for replacing every occurrence of `findDigit`
 * with `replaceDigit` across the whole grid.
 *
 * @param {number[][]} grid - grid to search (not mutated)
 * @param {number} findDigit - digit to search for (0–9)
 * @param {number} replaceDigit - digit to write in its place (0–9)
 * @returns {{ count: number, changes: Object<string, number> }}
 *   `count` is the number of matching cells, `changes` is a map the
 *   store's `applyCells` can consume directly. Empty when there is
 *   nothing to replace.
 */
export function computeReplace(grid, findDigit, replaceDigit) {
  if (!isValidDigit(findDigit) || !isValidDigit(replaceDigit)) {
    return { count: 0, changes: {} };
  }
  if (findDigit === replaceDigit) return { count: 0, changes: {} };

  const cells = getMatchingCells(grid, findDigit);
  const changes = {};
  for (const key of cells) changes[key] = replaceDigit;

  return { count: cells.length, changes };
}
