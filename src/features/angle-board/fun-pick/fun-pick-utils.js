/**
 * Fun Pick generation utilities
 *
 * Pure functions that walk the currently selected Angle Board cells and
 * return every valid neighbour-to-neighbour digit combination. Nothing here
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
 * - The type rule picks how many digits a combination holds: 2D, 3D or 4D.
 * - A cell is never reused within one combination, and cells outside the
 *   selection are never used.
 * - A batch holds every distinct path the rules allow: candidates are
 *   enumerated exhaustively in walk order, with no maximum result count, so
 *   repeated Generate presses over the same selection return the same set.
 * - Combinations are filtered for display by an active filter: All shows
 *   the whole batch; With 0 / With 1 / With 2 show the combinations
 *   containing that digit; Г / ㄱ / ┘ / L show the L-shaped ones in each
 *   of their four orientations, classified from cell coordinates. Filters
 *   overlap and never change the batch.
 * - A sequence search narrows any view further: comma-separated digit
 *   sequences ("12,4") every kept combination must contain, each sequence
 *   as a consecutive run in the given order, at any position. Search is a
 *   pure view too — it never regenerates or mutates the batch, and it
 *   composes with the active filter.
 */

/** The direction rules, keyed by the value stored in the hook. */
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

/** The combination types, keyed by their display label. */
export const FUN_PICK_TYPES = {
  two: '2D',
  three: '3D',
  four: '4D',
};

/** Type options for the rules selector, in display order. */
export const FUN_PICK_TYPE_OPTIONS = [
  { value: FUN_PICK_TYPES.two, label: '2D', length: 2 },
  { value: FUN_PICK_TYPES.three, label: '3D', length: 3 },
  { value: FUN_PICK_TYPES.four, label: '4D', length: 4 },
];

/** Default combination type. */
export const FUN_PICK_DEFAULT_TYPE = FUN_PICK_TYPES.three;

/**
 * Digits per combination for a type; unknown values fall back to the default.
 *
 * @param {'2D'|'3D'|'4D'} type
 * @returns {number}
 */
export function getTypeLength(type) {
  return FUN_PICK_TYPE_OPTIONS.find((option) => option.value === type)?.length ?? FUN_PICK_LENGTH;
}

/** Default combination length in digits. */
export const FUN_PICK_LENGTH = 3;

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
 * Enumerate every length-cell angle path through the selection.
 *
 * Depth-first walk from each selected cell. The first step may take any
 * neighbour the direction rule allows; every later step must bend exactly
 * 90 degrees from the step just taken (a perpendicular turn left or right).
 * With the default length of 3 each start has at most 8 first steps then 2
 * turns, so the whole candidate list stays small enough to materialise.
 *
 * Exported for the selection insights, which count the same candidate list
 * without formatting it.
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
 * Generate every valid unique combination from the selected cells.
 *
 * Exhaustive: there is no maximum result count. The walk order is
 * deterministic, so the same grid, selection and rules always produce the
 * same batch, and filtering a batch never depends on a re-roll.
 *
 * @param {number[][]} grid - the board's digits, read row-major
 * @param {Set<string>} selection - selected "row,col" keys
 * @param {Object} [options]
 * @param {'all'|'orthogonal'|'diagonal'} [options.direction='all'] - step family rule
 * @param {number} [options.length] - digits per combination
 * @returns {Array<{ digits: string, path: Array<{row:number,column:number}>, start: Object, end: Object }>}
 *   every distinct path the rules allow; empty when the selection cannot
 *   form any combination under the direction rule
 */
export function generateCombinations(grid, selection, options = {}) {
  const { direction = FUN_PICK_DIRECTIONS.all, length = FUN_PICK_LENGTH } = options;

  if (!Array.isArray(grid) || grid.length === 0) return [];
  if (!selection || selection.size < length) return [];

  const totalRows = grid.length;
  const totalCols = grid[0].length;
  const offsets = getDirectionOffsets(direction);

  return collectPaths(selection, totalRows, totalCols, offsets, length).map((path) => ({
    digits: path.map((cell) => grid[cell.row][cell.column]).join(''),
    path,
    start: path[0],
    end: path[path.length - 1],
  }));
}

/**
 * The L-shaped orientation of a combination's path, or null when its shape
 * is no L.
 *
 * Matched from cell coordinates and the movement sequence, never from the
 * digits. Only a 3-cell path can be an L under the angle rules: it holds
 * exactly one 90-degree bend, and the bend cell is the L's corner. Which
 * orientation that is follows from where the corner sits in the shape:
 * top-left Г, top-right ㄱ, bottom-right ┘, bottom-left L. The corner
 * leaves a plain bounding-box test — its row is the shape's top or bottom
 * extreme and its column the left or right extreme — and a shape's
 * orientation does not depend on which end the walk started from, nor on
 * which arm was walked first. 2-cell paths are straight lines, 4-cell
 * paths zigzag or close a 2x2 square, and diagonal bends leave the corner
 * mid-edge in one axis, so none of those is an L.
 *
 * @param {Array<{ row: number, column: number }>} path - the cells of one combination
 * @returns {'Г'|'ㄱ'|'┘'|'L'|null} the orientation, or null when not an L
 */
export function getLPattern(path) {
  if (!Array.isArray(path) || path.length !== 3) return null;

  const corner = path[1];
  const minRow = Math.min(path[0].row, corner.row, path[2].row);
  const maxRow = Math.max(path[0].row, corner.row, path[2].row);
  const minCol = Math.min(path[0].column, corner.column, path[2].column);
  const maxCol = Math.max(path[0].column, corner.column, path[2].column);

  const rowTop = corner.row === minRow && corner.row !== maxRow;
  const rowBottom = corner.row === maxRow && corner.row !== minRow;
  const colLeft = corner.column === minCol && corner.column !== maxCol;
  const colRight = corner.column === maxCol && corner.column !== minCol;

  if (rowTop) return colLeft ? 'Г' : colRight ? 'ㄱ' : null;
  if (rowBottom) return colRight ? '┘' : colLeft ? 'L' : null;
  return null;
}

/**
 * Filters for the results list, in display order. A filter with a `digit`
 * matches every combination whose digits contain it; a filter with a
 * `pattern` matches the combinations whose path is that L orientation;
 * "All" matches the whole batch. Filters overlap on purpose ("102" shows
 * under All, With 0, With 1, With 2, and its shape filter alike) — exactly
 * one is active at a time.
 */
export const FUN_PICK_FILTERS = [
  { value: 'all', label: 'All', digit: null, pattern: null, hint: 'exist' },
  { value: 'with-0', label: 'With 0', digit: '0', pattern: null, hint: 'with 0' },
  { value: 'with-1', label: 'With 1', digit: '1', pattern: null, hint: 'with 1' },
  { value: 'with-2', label: 'With 2', digit: '2', pattern: null, hint: 'with 2' },
  { value: 'l-gamma', label: 'Г', digit: null, pattern: 'Г', hint: 'shaped Г' },
  { value: 'l-kiyeok', label: 'ㄱ', digit: null, pattern: 'ㄱ', hint: 'shaped ㄱ' },
  { value: 'l-corner', label: '┘', digit: null, pattern: '┘', hint: 'shaped ┘' },
  { value: 'l-el', label: 'L', digit: null, pattern: 'L', hint: 'shaped L' },
];

/**
 * Whether a combination is shown by a filter.
 *
 * @param {{ digits: string, path: Array<{ row: number, column: number }> }} combination
 * @param {{ digit: string|null, pattern: string|null }} filter - one of `FUN_PICK_FILTERS`
 * @returns {boolean}
 */
export function matchesFilter(combination, filter) {
  if (filter.digit !== null) {
    return typeof combination.digits === 'string' && combination.digits.includes(filter.digit);
  }
  if (filter.pattern !== null) return getLPattern(combination.path) === filter.pattern;
  return true;
}

/**
 * Apply a filter to a generated batch.
 *
 * Pure view over the batch: the combinations keep their generated order and
 * nothing is mutated, so switching filters never regenerates anything. An
 * unknown filter value falls back to "All".
 *
 * @param {Array<{ digits: string, path: Array }>} combinations - a generated batch
 * @param {string} filterValue - the active filter's `value`
 * @returns {Array<{ digits: string, path: Array }>} the matching combinations
 */
export function applyFilter(combinations, filterValue) {
  const filter = FUN_PICK_FILTERS.find((option) => option.value === filterValue) ?? FUN_PICK_FILTERS[0];
  if (!Array.isArray(combinations)) return [];
  return combinations.filter((combination) => matchesFilter(combination, filter));
}

/**
 * Per-filter match counts for the filter bar badges.
 *
 * @param {Array<{ digits: string, path: Array }>} combinations - a generated batch
 * @returns {Array<{ value: string, label: string, count: number }>}
 */
export function getFilterCounts(combinations) {
  const batch = Array.isArray(combinations) ? combinations : [];
  return FUN_PICK_FILTERS.map((filter) => ({
    value: filter.value,
    label: filter.label,
    count: batch.filter((combination) => matchesFilter(combination, filter)).length,
  }));
}

/**
 * Parse a typed sequence search into the sequences it asks for.
 *
 * Commas separate sequences; digits within one sequence must appear in a
 * combination consecutively and in order. Whitespace around commas and
 * empty segments are ignored (a trailing comma mid-typing is harmless),
 * and duplicate sequences collapse to one. Only digits 0-9 and commas are
 * accepted: anything else makes the whole query invalid, so the caller can
 * say so instead of searching a corrupted field.
 *
 * @param {string} query - the raw text of the search field
 * @returns {{ valid: boolean, sequences: string[] }} the sequences to
 *   require, in typed order; empty (and valid) for a blank field, which
 *   means "no search active"
 */
export function parseSequenceQuery(query) {
  if (typeof query !== 'string' || query.trim().length === 0) {
    return { valid: true, sequences: [] };
  }

  const parts = query
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.some((part) => !/^[0-9]+$/.test(part))) {
    return { valid: false, sequences: [] };
  }

  return { valid: true, sequences: [...new Set(parts)] };
}

/**
 * Whether a combination's digits contain every required sequence.
 *
 * Each sequence must appear as a consecutive run in the exact order typed;
 * the runs themselves may sit anywhere in the combination, overlap is not
 * required, and the sequences have no order between them. An empty
 * sequence list matches everything, so a cleared field restores the view.
 *
 * @param {string} digits - the combination's digit string
 * @param {string[]} sequences - parsed sequences from `parseSequenceQuery`
 * @returns {boolean}
 */
export function matchesSequences(digits, sequences) {
  if (!Array.isArray(sequences) || sequences.length === 0) return true;
  if (typeof digits !== 'string') return false;
  return sequences.every((sequence) => digits.includes(sequence));
}

/**
 * Apply a sequence search to a batch (or to an already filtered view).
 *
 * Pure view like `applyFilter`: order and combinations are untouched, so
 * typing never regenerates anything and clearing restores what was there.
 *
 * @param {Array<{ digits: string, path: Array }>} combinations
 * @param {string[]} sequences - parsed sequences; empty means no search
 * @returns {Array<{ digits: string, path: Array }>} the matching combinations
 */
export function applySearch(combinations, sequences) {
  const batch = Array.isArray(combinations) ? combinations : [];
  if (!Array.isArray(sequences) || sequences.length === 0) return batch;
  return batch.filter((combination) => matchesSequences(combination.digits, sequences));
}

