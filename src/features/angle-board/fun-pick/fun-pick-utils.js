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
 * Rules encoded here — the Angle Board's board geometry:
 * - Every step goes to a neighbouring selected cell. From the second step
 *   on, a path may continue in the same direction or turn exactly 90
 *   degrees. Straight runs are valid walks; 45/135-degree turns (a diagonal
 *   mixed with an orthogonal step) and immediate reversals are not.
 * - Generation walks all eight step families: four orthogonal ones
 *   (straight rows/columns and L-shaped angles) and four diagonal ones
 *   (straight diagonals and V-shaped angles). Continuing straight or turning
 *   90 degrees keeps a step in its own family, so one path never mixes the
 *   two.
 * - Every combination holds exactly three digits.
 * - A cell is never reused within one combination, and cells outside the
 *   selection are never used.
 * - A batch holds every distinct path the rules allow: candidates are
 *   enumerated exhaustively in walk order, with no maximum result count, so
 *   repeated Generate presses over the same selection return the same set.
 * - Combinations are filtered for display by checkbox-style groups: digit
 *   chips (With 0 / With 1 / With 2), direction chips (Horizontal, Vertical,
 *   Diagonal, or Horizontal & Vertical), and L-shape chips (Г / ㄱ / ┘ / L).
 *   Several chips in one group may be active and combine with OR; active
 *   groups combine with AND. An optional Distinct chip keeps one
 *   representative per sorted-digit group. Filters overlap and never change
 *   the batch.
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

/** Digits per combination. Fun Pick is 3D only. */
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
 * Continue straight or turn exactly 90 degrees from a given step.
 * Keeping the original step plus its two perpendicular rotations preserves
 * the direction family, so one path never mixes orthogonal and diagonal
 * steps. The reverse step is excluded; cell reuse already blocks it.
 *
 * @param {[number, number]} step
 * @returns {Array<[number, number]>}
 */
function continuationSteps(step) {
  const [dr, dc] = step;
  return [
    step,
    [-dc, dr],
    [dc, -dr],
  ];
}

/**
 * Enumerate every length-cell walk through the selection.
 *
 * Depth-first walk from each selected cell. The first step may take any
 * neighbour the direction rule allows; every later step may continue in the
 * same direction or turn exactly 90 degrees left or right. With the default
 * length of 3 each start has at most 8 first steps then 3 follow-ups, so the
 * whole candidate list stays small enough to materialise.
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
      const steps = depth === 0 ? offsets : continuationSteps(step);
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
 * Digit and L-shape filters for the results list, in display order. A filter
 * with a `digit` matches every combination whose digits contain it; a filter
 * with a `pattern` matches the combinations whose path is that L
 * orientation; "All" clears the filter groups. Filters overlap on purpose
 * ("102" shows under All, With 0, With 1, With 2, and its shape filter
 * alike); several may be active at once.
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
 * Direction filters for the results list. They classify the path already
 * generated; generation always walks all directions. Horizontal, Vertical,
 * Diagonal, and the combined Horizontal & Vertical option share this group,
 * so selecting several keeps their union like the other filter groups.
 */
export const FUN_PICK_DIRECTION_FILTERS = [
  {
    value: 'direction-horizontal',
    label: 'Horizontal',
    movement: 'horizontal',
    hint: 'horizontal',
  },
  {
    value: 'direction-vertical',
    label: 'Vertical',
    movement: 'vertical',
    hint: 'vertical',
  },
  {
    value: 'direction-diagonal',
    label: 'Diagonal',
    direction: FUN_PICK_DIRECTIONS.diagonal,
    hint: 'diagonal',
  },
  {
    value: 'direction-orthogonal',
    label: 'Horizontal & Vertical',
    direction: FUN_PICK_DIRECTIONS.orthogonal,
    hint: 'horizontal or vertical',
  },
];

/** Optional filter that keeps one representative per sorted-digit group. */
export const FUN_PICK_DISTINCT_FILTER = {
  value: 'distinct',
  label: 'Distinct',
  hint: 'distinct',
};

/** Every chip in the results filter bar, in display order. */
export const FUN_PICK_RESULT_FILTER_OPTIONS = [
  ...FUN_PICK_FILTERS,
  ...FUN_PICK_DIRECTION_FILTERS,
  FUN_PICK_DISTINCT_FILTER,
];

/** Selectable options; "All" is the reset control, not a checkbox. */
export const FUN_PICK_SELECTABLE_FILTERS = FUN_PICK_RESULT_FILTER_OPTIONS.filter(
  (option) => option.value !== 'all'
);

/**
 * Movement of a path's first step, or null for an invalid path.
 *
 * Generation allows straight runs and 90-degree turns, so a 3-digit path
 * may stay straight or form an L. The result filters split paths by the
 * movement that starts them; the existing "Horizontal & Vertical" filter
 * still matches the whole orthogonal family.
 *
 * @param {Array<{ row: number, column: number }>} path
 * @returns {'horizontal'|'vertical'|'diagonal'|null}
 */
export function getPathMovement(path) {
  if (!Array.isArray(path) || path.length < 2) return null;

  const first = path[0];
  const second = path[1];
  if (!first || !second) return null;

  const rowDistance = Math.abs(second.row - first.row);
  const columnDistance = Math.abs(second.column - first.column);
  if (rowDistance === 0 && columnDistance > 0) return 'horizontal';
  if (columnDistance === 0 && rowDistance > 0) return 'vertical';
  if (rowDistance > 0 && columnDistance > 0) return 'diagonal';
  return null;
}

/**
 * The generation family used by a path: orthogonal turns include both
 * horizontal and vertical movements, so this keeps the original
 * "Horizontal & Vertical" filter working for L-shaped paths.
 *
 * @param {Array<{ row: number, column: number }>} path
 * @returns {'orthogonal'|'diagonal'|null}
 */
export function getPathDirection(path) {
  if (!Array.isArray(path) || path.length < 2) return null;

  const families = new Set();
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    if (!previous || !current) return null;

    const rowDistance = Math.abs(current.row - previous.row);
    const columnDistance = Math.abs(current.column - previous.column);
    if (rowDistance === 0 && columnDistance > 0) {
      families.add(FUN_PICK_DIRECTIONS.orthogonal);
    } else if (columnDistance === 0 && rowDistance > 0) {
      families.add(FUN_PICK_DIRECTIONS.orthogonal);
    } else if (rowDistance > 0 && columnDistance > 0) {
      families.add(FUN_PICK_DIRECTIONS.diagonal);
    } else {
      return null;
    }
  }

  return families.size === 1 ? [...families][0] : null;
}

/**
 * Whether a combination is shown by one filter option.
 *
 * @param {{ digits: string, path: Array<{ row: number, column: number }> }} combination
 * @param {{ digit?: string|null, direction?: string|null, movement?: string|null, pattern?: string|null }} filter
 * @returns {boolean}
 */
export function matchesFilter(combination, filter) {
  if (filter.digit != null) {
    return typeof combination.digits === 'string' && combination.digits.includes(filter.digit);
  }
  if (filter.movement != null) return getPathMovement(combination.path) === filter.movement;
  if (filter.direction != null) return getPathDirection(combination.path) === filter.direction;
  if (filter.pattern != null) return getLPattern(combination.path) === filter.pattern;
  return true;
}

/**
 * Apply one filter to a generated batch. Kept for callers that need a single
 * option; the card uses `applyFilters`, which combines whole groups. Pure
 * view over the batch: order and objects are untouched. An unknown value
 * falls back to "All".
 *
 * @param {Array<{ digits: string, path: Array }>} combinations - a generated batch
 * @param {string} filterValue - the filter's `value`
 * @returns {Array<{ digits: string, path: Array }>} the matching combinations
 */
export function applyFilter(combinations, filterValue) {
  const batch = Array.isArray(combinations) ? combinations : [];
  const filter =
    FUN_PICK_RESULT_FILTER_OPTIONS.find((option) => option.value === filterValue) ??
    FUN_PICK_FILTERS[0];
  if (filter.value === FUN_PICK_DISTINCT_FILTER.value) return applyDistinct(batch);
  return batch.filter((combination) => matchesFilter(combination, filter));
}

/**
 * Keep one representative per permutation-equivalent digit group.
 *
 * The group key is the sorted digit string, so multiplicity and leading
 * zeros survive ("077" and "707" share a group; "07" and "70" do not lose
 * their zero). The canonical sorted combination wins when it was generated;
 * otherwise the first generated member of the group wins. Nothing is
 * invented and nothing in the input is mutated.
 *
 * @param {Array<{ digits: string, path: Array }>} combinations
 * @returns {Array<{ digits: string, path: Array }>} representatives in group-discovery order
 */
export function applyDistinct(combinations) {
  const batch = Array.isArray(combinations) ? combinations : [];
  const representatives = new Map();

  for (const combination of batch) {
    if (!combination || typeof combination.digits !== 'string') continue;
    const key = [...combination.digits].sort().join('');
    const current = representatives.get(key);
    if (!current) {
      representatives.set(key, combination);
    } else if (current.digits !== key && combination.digits === key) {
      representatives.set(key, combination);
    }
  }

  return [...representatives.values()];
}

/**
 * Empty selection state: every selectable filter option starts inactive.
 *
 * @returns {Record<string, boolean>}
 */
export function createFilterSelection() {
  return Object.fromEntries(
    FUN_PICK_SELECTABLE_FILTERS.map((option) => [option.value, false])
  );
}

/** Reset all filter selections without touching generated results. */
export function clearFilterSelection() {
  return createFilterSelection();
}

/**
 * Toggle one option without disturbing any other selection. Unknown values
 * are ignored, so a stale caller cannot invent filter state.
 *
 * @param {Record<string, boolean>} selection
 * @param {string} value - one of `FUN_PICK_SELECTABLE_FILTERS`
 * @returns {Record<string, boolean>}
 */
export function toggleFilterSelection(selection, value) {
  if (!FUN_PICK_SELECTABLE_FILTERS.some((option) => option.value === value)) return selection;
  return { ...selection, [value]: !selection[value] };
}

/**
 * Whether any result filter is active. Used by the "All" reset control.
 *
 * @param {Record<string, boolean>} selection
 * @returns {boolean}
 */
export function hasActiveFilters(selection) {
  return FUN_PICK_SELECTABLE_FILTERS.some((option) => selection?.[option.value]);
}

/**
 * Apply every active filter group to a batch: OR inside a group, AND across
 * groups. An empty group leaves the batch alone. Search is applied by the
 * caller before this function or by `applyFunPickView`.
 *
 * @param {Array<{ digits: string, path: Array }>} combinations
 * @param {Record<string, boolean>} selection - state from `toggleFilterSelection`
 * @returns {Array<{ digits: string, path: Array }>} a new array of the same combination objects
 */
export function applyFilters(combinations, selection) {
  let result = Array.isArray(combinations) ? combinations : [];
  const active = selection ?? {};

  const digits = FUN_PICK_FILTERS.filter((filter) => filter.digit !== null && active[filter.value]).map(
    (filter) => filter.digit
  );
  if (digits.length > 0) {
    result = result.filter(
      (combination) =>
        typeof combination.digits === 'string' && digits.some((digit) => combination.digits.includes(digit))
    );
  }

  const activeDirectionFilters = FUN_PICK_DIRECTION_FILTERS.filter((filter) => active[filter.value]);
  if (activeDirectionFilters.length > 0) {
    result = result.filter((combination) =>
      activeDirectionFilters.some((filter) => matchesFilter(combination, filter))
    );
  }

  const patterns = FUN_PICK_FILTERS.filter(
    (filter) => filter.pattern !== null && active[filter.value]
  ).map((filter) => filter.pattern);
  if (patterns.length > 0) {
    result = result.filter((combination) => patterns.includes(getLPattern(combination.path)));
  }

  if (active[FUN_PICK_DISTINCT_FILTER.value]) result = applyDistinct(result);
  return result;
}

/**
 * Per-filter match counts for the filter bar badges. Distinct counts the
 * representative groups in the batch; every other chip counts its own
 * matches, regardless of what else is active.
 *
 * @param {Array<{ digits: string, path: Array }>} combinations - a generated batch
 * @returns {Array<{ value: string, label: string, count: number }>}
 */
export function getFilterCounts(combinations) {
  const batch = Array.isArray(combinations) ? combinations : [];
  const distinctCount = applyDistinct(batch).length;
  return FUN_PICK_RESULT_FILTER_OPTIONS.map((filter) => ({
    value: filter.value,
    label: filter.label,
    count:
      filter.value === FUN_PICK_DISTINCT_FILTER.value
        ? distinctCount
        : batch.filter((combination) => matchesFilter(combination, filter)).length,
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

/**
 * Derive the visible results from one generated batch: search AND every
 * active filter group. Kept here so search order cannot drift between the
 * card and its tests; neither step mutates or regenerates the batch.
 *
 * @param {Array<{ digits: string, path: Array }>} combinations
 * @param {Record<string, boolean>} selection - state from `toggleFilterSelection`
 * @param {string[]} sequences - parsed sequences; empty means no search
 * @returns {Array<{ digits: string, path: Array }>}
 */
export function applyFunPickView(combinations, selection, sequences) {
  return applyFilters(applySearch(combinations, sequences), selection);
}

