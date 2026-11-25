/**
 * Combination search over an Angle Board grid
 *
 * Finds every sequence of board cells that spells a digit combination by
 * walking to an adjacent cell (all eight directions) for each next digit.
 * A cell may appear at most once in a path, so paths can bend but not loop.
 *
 * Pure module: it takes the grid and the combination as arguments, knows
 * nothing about React, Zustand or display formatting. Results come back in a
 * deterministic order (start cells row-major, then directions in a fixed
 * order), which is what lets later features assign colours by result index.
 */

/** The eight neighbours, in a fixed order: NW N NE W E SW S SE. */
const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/** Safety valve for pathological queries (e.g. "5555555555" on an all-5 board). */
export const MAX_RESULTS = 500;

/**
 * Parse a typed combination into digits.
 *
 * Accepts a string of digit characters ("123") or an array of numbers
 * ([1, 2, 3]). Anything else — letters, spaces inside the string, a
 * non-integer in the array — is invalid and yields null, so the caller can
 * simply show no results rather than search a corrupted query.
 *
 * @param {string|number[]} combination
 * @returns {number[]|null} the digits to match, or null if invalid
 */
export function parseCombination(combination) {
  if (typeof combination === 'string') {
    if (combination.length === 0) return null;
    if (!/^[0-9]+$/.test(combination)) return null;
    return [...combination].map(Number);
  }

  if (Array.isArray(combination)) {
    if (combination.length === 0) return null;
    if (!combination.every((d) => Number.isInteger(d) && d >= 0 && d <= 9)) return null;
    return [...combination];
  }

  return null;
}

/**
 * Parse a comma- or whitespace-separated search field into combinations.
 *
 * "123, 456 , 789" and "123 456 789" both → ["123", "456", "789"]. Repeating
 * separators make empty entries, which are ignored, so a trailing comma
 * mid-typing is harmless. Returns null when the field holds no entry or any
 * entry fails `parseCombination`, so the caller rejects the whole query the
 * same way a corrupted single combination is rejected.
 *
 * @param {string} query
 * @returns {string[]|null} the valid combination strings, in typed order
 */
export function parseCombinationList(query) {
  if (typeof query !== 'string') return null;

  const parts = query
    .split(/[,\s]+/)
    .filter((part) => part.length > 0);

  if (parts.length === 0) return null;
  return parts.every((part) => parseCombination(part) !== null) ? parts : null;
}

/**
 * Keys for the cells of a path, in the "row,col" form the selection engine
 * and the board's highlight Sets use.
 *
 * @param {Array<{ row: number, column: number }>} path
 * @returns {string[]}
 */
export function getPathCellKeys(path) {
  return path.map((cell) => `${cell.row},${cell.column}`);
}

/**
 * Find every matching path for a digit combination.
 *
 * Each result: `{ digits, path, start, end }` where `path` is the ordered
 * cells (`{ row, column }`, zero-based) and `digits` is the matched sequence
 * as it was asked for. A single-digit combination matches each cell holding
 * that digit as a one-cell path.
 *
 * The walk is a depth-first search from every cell matching the first digit:
 * extend into an unused neighbour holding the next digit, record the path
 * when the last digit is reached, and back off to keep searching. `limit`
 * caps the work; when the cap is hit the search stops, so `results.length`
 * equal to `limit` means "at least this many".
 *
 * @param {number[][]} grid
 * @param {string|number[]} combination
 * @param {Object} [options]
 * @param {number} [options.limit]
 * @returns {Array<{ digits: string, path: Array<{row:number,column:number}>, start: Object, end: Object }>}
 */
export function searchCombinations(grid, combination, { limit = MAX_RESULTS } = {}) {
  const digits = parseCombination(combination);
  if (!digits || !Array.isArray(grid) || grid.length === 0) return [];

  const totalRows = grid.length;
  const totalCols = grid[0].length;
  const lastDigitIndex = digits.length - 1;

  const results = [];
  const path = [];
  const usedKeys = new Set();
  let truncated = false;

  const walk = (depth, row, col) => {
    if (truncated) return;

    path.push({ row, column: col });
    usedKeys.add(`${row},${col}`);

    if (depth === lastDigitIndex) {
      results.push({
        digits: digits.join(''),
        path: [...path],
        start: path[0],
        end: path[path.length - 1],
      });
      if (results.length >= limit) truncated = true;
    } else {
      const wanted = digits[depth + 1];
      for (const [dr, dc] of DIRECTIONS) {
        const nearRow = row + dr;
        const nearCol = col + dc;
        if (nearRow < 0 || nearCol < 0 || nearRow >= totalRows || nearCol >= totalCols) continue;
        if (grid[nearRow][nearCol] !== wanted) continue;
        if (usedKeys.has(`${nearRow},${nearCol}`)) continue;
        walk(depth + 1, nearRow, nearCol);
        if (truncated) break;
      }
    }

    path.pop();
    usedKeys.delete(`${row},${col}`);
  };

  for (let row = 0; row < totalRows && !truncated; row++) {
    for (let col = 0; col < totalCols && !truncated; col++) {
      if (grid[row][col] === digits[0]) walk(0, row, col);
    }
  }

  return results;
}
