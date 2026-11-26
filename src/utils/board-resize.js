/**
 * Board resize utilities
 * Changes grid dimensions without storing redundant row or column counts.
 */

import { createEmptyGrid } from '@/utils/board-factory';
import { validateGrid } from '@/utils/board-validation';

/** Smallest grid accepted on either axis. */
export const MIN_BOARD_DIMENSION = 2;

/** Most rows that stay usable with vertical scrolling. */
export const MAX_BOARD_ROWS = 20;

/** Most columns that fit a phone at the minimum readable cell size. */
export const MAX_BOARD_COLUMNS = 12;

/**
 * Is a value a usable grid size on the given axis?
 *
 * @param {unknown} value
 * @param {'rows'|'columns'} axis
 * @returns {boolean}
 */
export function isValidBoardDimension(value, axis) {
  const max = axis === 'rows' ? MAX_BOARD_ROWS : MAX_BOARD_COLUMNS;
  return Number.isInteger(value) && value >= MIN_BOARD_DIMENSION && value <= max;
}

/**
 * Resizes a grid to new dimensions, preserving every overlapping digit.
 *
 * Added cells start at 0. Removed cells are dropped. Dimensions are never
 * written to the board: the returned grid is the whole size definition.
 *
 * @param {number[][]} grid
 * @param {number} rows
 * @param {number} columns
 * @returns {{ success: boolean, grid?: number[][], shrunk?: boolean, error?: string }}
 */
export function resizeGrid(grid, rows, columns) {
  const validation = validateGrid(grid);
  if (!validation.valid) return { success: false, error: validation.error };

  if (!isValidBoardDimension(rows, 'rows')) {
    return {
      success: false,
      error: `Rows must be an integer from ${MIN_BOARD_DIMENSION} to ${MAX_BOARD_ROWS}`,
    };
  }

  if (!isValidBoardDimension(columns, 'columns')) {
    return {
      success: false,
      error: `Columns must be an integer from ${MIN_BOARD_DIMENSION} to ${MAX_BOARD_COLUMNS}`,
    };
  }

  const nextGrid = createEmptyGrid(rows, columns);
  for (let row = 0; row < Math.min(rows, grid.length); row++) {
    for (let col = 0; col < Math.min(columns, grid[row].length); col++) {
      nextGrid[row][col] = grid[row][col];
    }
  }

  return {
    success: true,
    grid: nextGrid,
    shrunk: rows < grid.length || columns < grid[0].length,
  };
}
