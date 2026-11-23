/**
 * Fun Pick generation utilities
 *
 * Pure functions that walk the currently selected Angle Board cells and
 * return random neighbour-to-neighbour digit combinations. Nothing here
 * touches React, Zustand or display formatting: the caller passes the same
 * `grid` + `selection` pair the board takes (selection as "row,col" keys)
 * and gets back result objects shaped like the combination-search engine's —
 * `{ digits, path, start, end }` with zero-based `{ row, column }` cells —
 * so `getPathReference` can render them unchanged.
 *
 * Rules encoded here — the Angle Board's angle geometry:
 * - Every step goes to a neighbouring selected cell, but from the second
 *   step on the path must bend exactly 90 degrees: the new step is
 *   perpendicular to the step just taken. Straight runs and 45/135-degree
 *   turns (a diagonal mixed with an orthogonal step) are not valid angles,
 *   so a neighbour only counts when it sits on the turning axis.
 * - The direction rule picks which step families are allowed: the four
 *   orthogonal ones (L-shaped angles), the four diagonal ones (V-shaped
 *   angles between diagonals), or all eight. A 90-degree rotation keeps a
 *   step in its own family, so one path never mixes the two.
 * - A cell is never reused within one combination, and cells outside the
 *   selection are never used.
 * - A batch holds distinct paths: candidate paths are enumerated once, then
 *   shuffled, so repeated Generate presses favour novelty over order.
 */

/** The three generation rules, keyed by the value stored in the hook. */
export const FUN_PICK_DIRECTIONS = {
  all: 'all',
  orthogonal: 'orthogonal',
  diagonal: 'diagonal',
};

/** Direction options for the rules selector, in display order. */
export const FUN_PICK_DIRECTION_OPTIONS = [
  { value: FUN_PICK_DIRECTIONS.all, label: 'All directions' },
  { value: FUN_PICK_DIRECTIONS.orthogonal, label: 'Horizontal & Vertical' },
  { value: FUN_PICK_DIRECTIONS.diagonal, label: 'Diagonal only' },
];

/** Default combination length in digits. */
export const FUN_PICK_LENGTH = 3;

/** Default combinations returned per generation request. */
export const FUN_PICK_COUNT = 10;

/** Orthogonal neighbours: N W E S. */
const ORTHOGONAL_OFFSETS = [
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, 0],
];

/** Diagonal neighbours: NW NE SW SE. */
const DIAGONAL_OFFSETS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/**
 * Neighbour offsets allowed by a direction rule.
 *
 * @param {'all'|'orthogonal'|'diagonal'} direction
 * @returns {Array<[number, number]>}
 */
export function getDirectionOffsets(direction) {
  if (direction === FUN_PICK_DIRECTIONS.orthogonal) return ORTHOGONAL_OFFSETS;
  if (direction === FUN_PICK_DIRECTIONS.diagonal) return DIAGONAL_OFFSETS;
  return [...ORTHOGONAL_OFFSETS, ...DIAGONAL_OFFSETS];
}

/**
 * The two steps perpendicular to a given step: a 90-degree turn either way.
 * Rotating an orthogonal step yields orthogonal steps, and a diagonal step
 * yields diagonal steps, so the direction family never mixes within a path.
 *
 * @param {[number, number]} step
 * @returns {Array<[number, number]>}
 */
function perpendicularSteps(step) {
  const [dr, dc] = step;
  return [
    [-dc, dr],
    [dc, -dr],
  ];
}

/**
 * Fisher-Yates shuffle (in place) over an array of plain values.
 * @param {Array} items
 * @returns {Array} the same array, shuffled
 */
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Enumerate every length-cell angle path through the selection.
 *
 * Depth-first walk from each selected cell. The first step may take any
 * neighbour the direction rule allows; every later step must bend exactly
 * 90 degrees from the step just taken (a perpendicular turn left or right).
 * With the default length of 3 each start has at most 8 first steps then 2
 * turns, so the whole candidate list stays small and can be materialised
 * and shuffled.
 *
 * Exported for the selection insights, which count the same candidate list
 * without sampling or formatting it.
 */
export function collectPaths(selectedKeys, totalRows, totalCols, offsets, length) {
  const paths = [];
  const path = [];
  const usedKeys = new Set();
  const lastDepth = length - 1;

  const walk = (row, col, depth, step) => {
    path.push({ row, column: col });
    usedKeys.add(`${row},${col}`);

    if (depth === lastDepth) {
      paths.push([...path]);
    } else {
      const steps = depth === 0 ? offsets : perpendicularSteps(step);
      for (const [dr, dc] of steps) {
        const nearRow = row + dr;
        const nearCol = col + dc;
        if (nearRow < 0 || nearCol < 0 || nearRow >= totalRows || nearCol >= totalCols) continue;
        const key = `${nearRow},${nearCol}`;
        if (!selectedKeys.has(key) || usedKeys.has(key)) continue;
        walk(nearRow, nearCol, depth + 1, [dr, dc]);
      }
    }

    path.pop();
    usedKeys.delete(`${row},${col}`);
  };

  for (const key of selectedKeys) {
    const [row, col] = key.split(',').map(Number);
    walk(row, col, 0, null);
  }

  return paths;
}

/**
 * Generate random combinations from the selected cells.
 *
 * @param {number[][]} grid - the board's digits, read row-major
 * @param {Set<string>} selection - selected "row,col" keys
 * @param {Object} [options]
 * @param {'all'|'orthogonal'|'diagonal'} [options.direction='all'] - step family rule
 * @param {number} [options.length] - digits per combination
 * @param {number} [options.count] - combinations per batch
 * @returns {Array<{ digits: string, path: Array<{row:number,column:number}>, start: Object, end: Object }>}
 *   distinct paths, up to `count` of them; empty when the selection cannot
 *   form any combination under the direction rule
 */
export function generateCombinations(grid, selection, options = {}) {
  const { direction = FUN_PICK_DIRECTIONS.all, length = FUN_PICK_LENGTH, count = FUN_PICK_COUNT } =
    options;

  if (!Array.isArray(grid) || grid.length === 0) return [];
  if (!selection || selection.size < length) return [];

  const totalRows = grid.length;
  const totalCols = grid[0].length;
  const offsets = getDirectionOffsets(direction);

  const candidates = collectPaths(selection, totalRows, totalCols, offsets, length);
  if (candidates.length === 0) return [];

  return shuffle(candidates)
    .slice(0, count)
    .map((path) => ({
      digits: path.map((cell) => grid[cell.row][cell.column]).join(''),
      path,
      start: path[0],
      end: path[path.length - 1],
    }));
}
