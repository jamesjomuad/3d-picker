/**
 * Board validation utilities
 * Validates Angle Board data before it reaches the grid or the store
 */

/**
 * Is this a single, storable board digit?
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidDigit(value) {
  return Number.isInteger(value) && value >= 0 && value <= 9;
}

/**
 * Parse one character of typed input into a board digit.
 * Used by the editable cell, where the value arrives as a string.
 *
 * @param {string} text
 * @returns {number|null} the digit, or null when the text is not one
 */
export function parseDigit(text) {
  if (typeof text !== 'string' || text.length !== 1) return null;

  const value = Number.parseInt(text, 10);
  return isValidDigit(value) ? value : null;
}

/**
 * Validates a bare grid: a non-empty array of equal-length rows of digits.
 * This is the rule `validateBoard` checks, and the one the board component
 * checks against its `grid` prop.
 *
 * @param {number[][]} grid
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
export function validateGrid(grid) {
  if (!Array.isArray(grid)) {
    return { valid: false, error: 'Board grid must be an array' };
  }

  if (grid.length === 0) {
    return { valid: false, error: 'Board grid cannot be empty' };
  }

  const expectedColumns = grid[0].length;

  for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
    const row = grid[rowIndex];

    if (!Array.isArray(row)) {
      return { valid: false, error: `Row ${rowIndex} must be an array` };
    }

    if (row.length !== expectedColumns) {
      return {
        valid: false,
        error: `Row ${rowIndex} has ${row.length} columns, expected ${expectedColumns}`,
      };
    }

    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const value = row[colIndex];

      if (!isValidDigit(value)) {
        return {
          valid: false,
          error: `Cell [${rowIndex}][${colIndex}] must be an integer 0-9, got ${value}`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Validates an Angle Board object
 * @param {Object} board - The board object to validate
 * @param {string} board.name - Board name
 * @param {number[][]} board.grid - 2D array of digits
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
export function validateBoard(board) {
  if (!board || typeof board !== 'object') {
    return { valid: false, error: 'Board must be an object' };
  }

  if (!board.name || typeof board.name !== 'string') {
    return { valid: false, error: 'Board must have a name string' };
  }

  return validateGrid(board.grid);
}
