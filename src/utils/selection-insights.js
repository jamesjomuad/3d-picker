/**
 * Selection insights utilities
 *
 * Compact statistics for the selected cells card, computed from the current
 * Angle Board selection with the real Fun Pick rules: combinations are the
 * straight and 90-degree walks of the default generation length (3 digits)
 * under the all-directions rule, enumerated by the same `collectPaths`
 * walker the generator uses — not simple neighbour adjacency.
 *
 * Pure module: like `selection-summary`, it reads the grid plus the store's
 * "row,col" selection Set and never touches React, Zustand or the board.
 */

import {
  FUN_PICK_DIRECTIONS,
  FUN_PICK_LENGTH,
  collectPaths,
  getDirectionOffsets,
} from '@/features/angle-board/fun-pick/fun-pick-utils';

import { getSelectedCellEntries } from '@/utils/selection-summary';

/**
 * Compute the insights for a selection.
 *
 * - `cellCount`: selected cells.
 * - `uniqueDigitCount`: distinct digit values among them.
 * - `repeatedDigitCount`: digit values that appear more than once.
 * - `combinationCount`: valid combinations the selection can form, counted
 *   once per distinct digit string: two paths spelling the same digits are
 *   the same combination, mirroring what a generated batch should show.
 * - `startCellCount`: selected cells that can start at least one valid
 *   combination.
 *
 * A selection smaller than the combination length — or one whose cells
 * cannot form a straight or 90-degree walk — yields zero combinations and
 * zero start cells rather than an error.
 *
 * @param {number[][]} grid - the board's digits, read row-major
 * @param {Set<string>} selection - selected "row,col" keys
 * @param {Object} [options]
 * @param {number} [options.length] - digits per combination (Fun Pick default)
 * @param {'all'|'orthogonal'|'diagonal'} [options.direction] - step family rule
 * @returns {{
 *   hasSelection: boolean,
 *   cellCount: number,
 *   uniqueDigitCount: number,
 *   repeatedDigitCount: number,
 *   combinationCount: number,
 *   startCellCount: number,
 * }}
 */
export function getSelectionInsights(grid, selection, options = {}) {
  const length = options.length ?? FUN_PICK_LENGTH;
  const direction = options.direction ?? FUN_PICK_DIRECTIONS.all;

  const entries = getSelectedCellEntries(grid, selection);
  const cellCount = entries.length;

  const digitCounts = new Map();
  for (const entry of entries) {
    digitCounts.set(entry.value, (digitCounts.get(entry.value) ?? 0) + 1);
  }

  const base = {
    hasSelection: cellCount > 0,
    cellCount,
    uniqueDigitCount: digitCounts.size,
    repeatedDigitCount: [...digitCounts.values()].filter((n) => n > 1).length,
    combinationCount: 0,
    startCellCount: 0,
  };

  if (cellCount < length) return base;

  const totalRows = grid.length;
  const totalCols = grid[0].length;
  const offsets = getDirectionOffsets(direction);
  const paths = collectPaths(selection, totalRows, totalCols, offsets, length);

  const combinations = new Set();
  const starts = new Set();
  for (const path of paths) {
    let digits = '';
    for (const cell of path) digits += grid[cell.row][cell.column];
    combinations.add(digits);
    starts.add(`${path[0].row},${path[0].column}`);
  }

  return {
    ...base,
    combinationCount: combinations.size,
    startCellCount: starts.size,
  };
}
