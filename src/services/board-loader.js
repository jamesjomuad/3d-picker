/**
 * Board data loading service
 * Loads and validates Angle Board data from JSON
 */

import { validateBoard } from '@/utils/board-validation';

let cachedBoard = null;

/**
 * Loads the Angle Board data
 * @returns {Object} Validated board object with name and grid
 */
export function loadBoard() {
  if (cachedBoard) {
    return cachedBoard;
  }

  try {
    const boardData = require('@/data/angle-board.json');
    const validation = validateBoard(boardData);

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    cachedBoard = boardData;
    return cachedBoard;
  } catch (error) {
    console.error('Failed to load board:', error);
    throw error;
  }
}

/**
 * Clears the cached board (useful for testing)
 */
export function clearBoardCache() {
  cachedBoard = null;
}

/**
 * Gets board dimensions
 * @param {Object} board - The board object
 * @returns {{ rows: number, columns: number }}
 */
export function getBoardDimensions(board) {
  return {
    rows: board.grid.length,
    columns: board.grid[0].length,
  };
}
