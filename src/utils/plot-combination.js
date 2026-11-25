/**
 * Plot-a-saved-pick validation
 *
 * Plotting is a visual preview on the board that is active *now*. It never
 * writes a grid and never switches boards. The basket stores coordinates from
 * whichever board the pick came from, so before navigating we check those
 * coordinates against the active board's dimensions and report a clear reason
 * when they cannot be shown. Nothing here mutates the request or the grid.
 */

/** Query-param key used to hand the pick from Collection to the Picker. */
export const PLOT_PARAM = 'plot';

/**
 * Serialise the saved pick for the route param. Only the two fields needed to
 * highlight cells travel through the URL; `addedAt` and basket identity stay
 * in the basket store.
 *
 * @param {{ digits: string, path: Array<{ row: number, column: number }> }} entry
 * @returns {string}
 */
export function serializePlotRequest(entry) {
  return JSON.stringify({ digits: entry.digits, path: entry.path });
}

/**
 * Read a plot param without throwing on a stale or hand-edited URL.
 *
 * @param {unknown} raw
 * @returns {Object|null} the parsed request, or null when it is unusable
 */
export function parsePlotRequest(raw) {
  if (typeof raw !== 'string' || raw === '') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
}

/**
 * Validate a saved pick against a board grid and derive the cells to highlight.
 * The grid's *digits* are deliberately not compared to the saved combination:
 * the pick is a preview of remembered coordinates, not a board edit.
 *
 * @param {unknown} request - parsed `{ digits, path }` from the basket
 * @param {unknown} grid - the active board's grid
 * @returns {{ valid: true, digits: string, path: Array, cells: Set<string> } |
 *            { valid: false, error: string }}
 */
export function validatePlotRequest(request, grid) {
  if (!request || typeof request !== 'object') {
    return invalid('The saved pick could not be read.');
  }

  const { digits, path } = request;
  if (typeof digits !== 'string' || !/^\d+$/.test(digits)) {
    return invalid('The saved pick has no valid digits.');
  }
  if (!Array.isArray(path) || path.length === 0) {
    return invalid('The saved pick has no stored cells.');
  }
  if (digits.length !== path.length) {
    return invalid('The saved pick has a different number of digits and cells.');
  }

  if (!Array.isArray(grid) || grid.length === 0 || !Array.isArray(grid[0])) {
    return invalid('No active board is available.');
  }
  const columns = grid[0].length;
  if (columns === 0) {
    return invalid('The active board has no cells.');
  }
  for (let row = 0; row < grid.length; row += 1) {
    if (!Array.isArray(grid[row]) || grid[row].length !== columns) {
      return invalid('The active board grid is not rectangular.');
    }
  }

  const cells = new Set();
  for (const cell of path) {
    if (!cell || typeof cell !== 'object') {
      return invalid('The saved pick has an invalid cell.');
    }
    const row = cell.row;
    const column = cell.column ?? cell.col;
    if (!Number.isInteger(row) || !Number.isInteger(column)) {
      return invalid('The saved pick has an invalid cell coordinate.');
    }
    if (row < 0 || row >= grid.length || column < 0 || column >= columns) {
      return invalid('Some saved cells are outside the active board.');
    }
    if (!Number.isInteger(grid[row][column]) || grid[row][column] < 0 || grid[row][column] > 9) {
      return invalid('The active board has an invalid cell value.');
    }
    cells.add(`${row},${column}`);
  }

  return { valid: true, digits, path, cells };
}

function invalid(error) {
  return { valid: false, error };
}
