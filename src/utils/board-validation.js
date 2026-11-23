/**
 * Board validation utilities
 * Validates Angle Board data structure before use
 */

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

  if (!Array.isArray(board.grid)) {
    return { valid: false, error: 'Board grid must be an array' };
  }

  if (board.grid.length === 0) {
    return { valid: false, error: 'Board grid cannot be empty' };
  }

  const expectedColumns = board.grid[0].length;

  for (let rowIndex = 0; rowIndex < board.grid.length; rowIndex++) {
    const row = board.grid[rowIndex];

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

      if (!Number.isInteger(value) || value < 0 || value > 9) {
        return {
          valid: false,
          error: `Cell [${rowIndex}][${colIndex}] must be an integer 0-9, got ${value}`,
        };
      }
    }
  }

  return { valid: true };
}
