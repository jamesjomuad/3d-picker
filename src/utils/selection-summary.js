/**
 * Selection summary utilities
 *
 * Turns the existing selection state (a Set of "row,col" keys in the board
 * store) plus the Angle Board grid into display-ready data for the selected
 * cells card. These are pure functions: the store stays the single source of
 * truth and nothing here mutates or duplicates selection state.
 *
 * Cell numbering is not decided here — `@/utils/cell-reference` owns the
 * Excel-style display form (lettered columns, 1-based rows).
 */

import { getCellReference, getRangeReference } from '@/utils/cell-reference';

/** Above this many cells the coordinate list collapses to start → end. */
export const COORDINATE_LIST_LIMIT = 16;

/**
 * Build the store key for a cell
 * @param {number} row
 * @param {number} col
 * @returns {string}
 */
export function getCellKey(row, col) {
  return `${row},${col}`;
}

/**
 * Collect the selected cells in row-major order (top to bottom, left to
 * right) by walking the grid itself. Iterating the grid — rather than the
 * Set — keeps ordering stable regardless of the order a drag added cells.
 * @param {number[][]} grid
 * @param {Set<string>} selectedCells
 * @returns {Array<{ key: string, row: number, col: number, value: number, label: string }>}
 */
export function getSelectedCellEntries(grid, selectedCells) {
  if (!Array.isArray(grid) || !selectedCells) return [];

  const entries = [];

  for (let row = 0; row < grid.length; row += 1) {
    const rowValues = grid[row];
    if (!Array.isArray(rowValues)) continue;

    for (let col = 0; col < rowValues.length; col += 1) {
      const key = getCellKey(row, col);
      if (!selectedCells.has(key)) continue;

      entries.push({
        key,
        row,
        col,
        value: rowValues[col],
        label: getCellReference(row, col),
      });
    }
  }

  return entries;
}

/**
 * Bounding box of the selected cells
 * @param {Array<{ row: number, col: number }>} entries
 * @returns {{ minRow: number, maxRow: number, minCol: number, maxCol: number } | null}
 */
export function getSelectionBounds(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;

  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  for (const { row, col } of entries) {
    if (row < minRow) minRow = row;
    if (row > maxRow) maxRow = row;
    if (col < minCol) minCol = col;
    if (col > maxCol) maxCol = col;
  }

  return { minRow, maxRow, minCol, maxCol };
}

/**
 * Classify a selection from the cells it contains.
 * - "single": one cell
 * - "row": whole rows (every column of the affected rows)
 * - "col": whole columns (every row of the affected columns)
 * - "rect": a filled rectangle that is neither full-width nor full-height
 * - "custom": a non-rectangular set (not produced by the current gesture code)
 * @param {number[][]} grid
 * @param {Array<{ row: number, col: number }>} entries
 * @returns {'none' | 'single' | 'row' | 'col' | 'rect' | 'custom'}
 */
export function getSelectionType(grid, entries) {
  if (!Array.isArray(entries) || entries.length === 0) return 'none';
  if (entries.length === 1) return 'single';

  const bounds = getSelectionBounds(entries);
  const height = bounds.maxRow - bounds.minRow + 1;
  const width = bounds.maxCol - bounds.minCol + 1;

  // A selection is rectangular only when every cell inside its bounds is
  // selected; this also rejects nothing produced by the current engine.
  if (entries.length !== height * width) return 'custom';

  const totalRows = Array.isArray(grid) ? grid.length : 0;
  const totalCols = Array.isArray(grid) && Array.isArray(grid[0]) ? grid[0].length : 0;

  if (totalCols > 0 && width === totalCols && height < totalRows) return 'row';
  if (totalRows > 0 && height === totalRows && width < totalCols) return 'col';

  return 'rect';
}

function getTypeLabel(type, bounds) {
  switch (type) {
    case 'single':
      return 'Single cell';
    case 'rect':
      return 'Rectangular range';
    case 'row':
      return bounds.minRow === bounds.maxRow ? 'Entire row' : 'Entire rows';
    case 'col':
      return bounds.minCol === bounds.maxCol ? 'Entire column' : 'Entire columns';
    case 'custom':
      return 'Selection';
    case 'none':
    default:
      return 'No selection';
  }
}

/**
 * Build everything the selected cells card renders.
 * @param {number[][]} grid - Angle Board grid
 * @param {Set<string>} selectedCells - Store selection set
 * @param {{ coordinateListLimit?: number }} [options]
 * @returns {{
 *   entries: Array<Object>,
 *   count: number,
 *   type: string,
 *   typeLabel: string,
 *   digits: number[],
 *   digitsText: string,
 *   coordinatesText: string,
 *   rangeLabel: string | null,
 *   hasSelection: boolean,
 * }}
 */
export function getSelectionSummary(grid, selectedCells, options = {}) {
  const entries = getSelectedCellEntries(grid, selectedCells);
  const count = entries.length;

  if (count === 0) {
    return {
      entries,
      count: 0,
      type: 'none',
      typeLabel: getTypeLabel('none', null),
      digits: [],
      digitsText: '',
      coordinatesText: '',
      rangeLabel: null,
      hasSelection: false,
    };
  }

  const type = getSelectionType(grid, entries);
  const bounds = getSelectionBounds(entries);
  const digits = entries.map((entry) => entry.value);

  const rangeLabel = getRangeReference(
    bounds.minRow,
    bounds.minCol,
    bounds.maxRow,
    bounds.maxCol
  );

  const limit = options.coordinateListLimit ?? COORDINATE_LIST_LIMIT;
  const coordinatesText =
    count <= limit
      ? entries.map((entry) => entry.label).join('  ')
      : `${getCellReference(bounds.minRow, bounds.minCol)} → ${getCellReference(
          bounds.maxRow,
          bounds.maxCol
        )}`;

  return {
    entries,
    count,
    type,
    typeLabel: getTypeLabel(type, bounds),
    digits,
    digitsText: digits.join(','),
    coordinatesText,
    rangeLabel,
    hasSelection: true,
  };
}
