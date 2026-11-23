/**
 * Selection calculation utilities
 * Pure functions for computing rectangular and header-based selections
 */

/**
 * Clamp a value between min and max (inclusive)
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate the set of cell keys for a rectangular selection
 * @param {number} startRow
 * @param {number} startCol
 * @param {number} endRow
 * @param {number} endCol
 * @param {number} totalRows
 * @param {number} totalCols
 * @returns {Set<string>} Set of "row,col" keys
 */
export function calculateRectSelection(
  startRow,
  startCol,
  endRow,
  endCol,
  totalRows,
  totalCols
) {
  const minRow = clamp(Math.min(startRow, endRow), 0, totalRows - 1);
  const maxRow = clamp(Math.max(startRow, endRow), 0, totalRows - 1);
  const minCol = clamp(Math.min(startCol, endCol), 0, totalCols - 1);
  const maxCol = clamp(Math.max(startCol, endCol), 0, totalCols - 1);

  const cells = new Set();
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      cells.add(`${r},${c}`);
    }
  }
  return cells;
}

/**
 * Calculate cell keys for selecting specific rows (all columns)
 * @param {number} startRow
 * @param {number} endRow
 * @param {number} totalRows
 * @param {number} totalCols
 * @returns {Set<string>}
 */
export function calculateRowSelection(startRow, endRow, totalRows, totalCols) {
  return calculateRectSelection(startRow, 0, endRow, totalCols - 1, totalRows, totalCols);
}

/**
 * Calculate cell keys for selecting specific columns (all rows)
 * @param {number} startCol
 * @param {number} endCol
 * @param {number} totalRows
 * @param {number} totalCols
 * @returns {Set<string>}
 */
export function calculateColSelection(startCol, endCol, totalRows, totalCols) {
  return calculateRectSelection(0, startCol, totalRows - 1, endCol, totalRows, totalCols);
}

/**
 * Convert touch coordinates to grid cell indices
 * @param {number} x - Touch X relative to grid container
 * @param {number} y - Touch Y relative to grid container
 * @param {number} headerWidth - Width of row header column
 * @param {number} headerHeight - Height of column header row
 * @param {number} cellSize - Size of each cell
 * @param {number} totalRows
 * @param {number} totalCols
 * @returns {{ row: number, col: number } | null}
 */
export function touchToCell(x, y, headerWidth, headerHeight, cellSize, totalRows, totalCols) {
  const gridX = x - headerWidth;
  const gridY = y - headerHeight;

  if (gridX < 0 || gridY < 0) return null;

  const col = clamp(Math.floor(gridX / cellSize), 0, totalCols - 1);
  const row = clamp(Math.floor(gridY / cellSize), 0, totalRows - 1);

  return { row, col };
}

/**
 * Determine the interaction zone from touch coordinates
 * @param {number} x - Touch X relative to grid container
 * @param {number} y - Touch Y relative to grid container
 * @param {number} headerWidth - Width of row header column
 * @param {number} headerHeight - Height of column header row
 * @returns {'cell' | 'row' | 'col' | 'corner'}
 */
export function getTouchZone(x, y, headerWidth, headerHeight) {
  const isRowHeader = x < headerWidth;
  const isColHeader = y < headerHeight;

  if (isRowHeader && isColHeader) return 'corner';
  if (isColHeader) return 'col';
  if (isRowHeader) return 'row';
  return 'cell';
}

/**
 * Build the initial drag state for a container-relative touch point.
 * Resolves all four zones, so a gesture started on a header selects the full
 * row/column instead of being rejected for landing outside the grid.
 * @param {number} x - Touch X relative to the grid container
 * @param {number} y - Touch Y relative to the grid container
 * @param {number} headerWidth - Width of row header column
 * @param {number} headerHeight - Height of column header row
 * @param {number} cellSize - Size of each cell
 * @param {number} totalRows
 * @param {number} totalCols
 * @returns {{ startRow: number, startCol: number, endRow: number, endCol: number, mode: 'cell' | 'row' | 'col' } | null}
 */
export function touchToDragState(x, y, headerWidth, headerHeight, cellSize, totalRows, totalCols) {
  const zone = getTouchZone(x, y, headerWidth, headerHeight);

  if (zone === 'corner') return null;

  if (zone === 'row') {
    const row = clamp(Math.floor((y - headerHeight) / cellSize), 0, totalRows - 1);
    return { startRow: row, startCol: 0, endRow: row, endCol: totalCols - 1, mode: 'row' };
  }

  if (zone === 'col') {
    const col = clamp(Math.floor((x - headerWidth) / cellSize), 0, totalCols - 1);
    return { startRow: 0, startCol: col, endRow: totalRows - 1, endCol: col, mode: 'col' };
  }

  const cell = touchToCell(x, y, headerWidth, headerHeight, cellSize, totalRows, totalCols);
  if (!cell) return null;

  return {
    startRow: cell.row,
    startCol: cell.col,
    endRow: cell.row,
    endCol: cell.col,
    mode: 'cell',
  };
}

/**
 * Calculate which rows and columns are highlighted by a drag state
 * @param {Object} dragState - { startRow, startCol, endRow, endCol, mode }
 * @param {number} totalRows
 * @param {number} totalCols
 * @returns {{ rows: Set<number>, cols: Set<number> }}
 */
export function getDragHighlights(dragState, totalRows, totalCols) {
  if (!dragState) return { rows: new Set(), cols: new Set() };

  const { startRow, startCol, endRow, endCol, mode } = dragState;
  const rows = new Set();
  const cols = new Set();

  if (mode === 'row') {
    const min = Math.min(startRow, endRow);
    const max = Math.max(startRow, endRow);
    for (let i = min; i <= max; i++) rows.add(i);
    for (let c = 0; c < totalCols; c++) cols.add(c);
  } else if (mode === 'col') {
    const min = Math.min(startCol, endCol);
    const max = Math.max(startCol, endCol);
    for (let i = min; i <= max; i++) cols.add(i);
    for (let r = 0; r < totalRows; r++) rows.add(r);
  } else {
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    for (let r = minRow; r <= maxRow; r++) rows.add(r);
    for (let c = minCol; c <= maxCol; c++) cols.add(c);
  }

  return { rows, cols };
}

/**
 * Extract which rows and columns are touched by a selection set
 * @param {Set<string>} selectedCells
 * @returns {{ rows: Set<number>, cols: Set<number> }}
 */
export function getSelectedRowsAndCols(selectedCells) {
  const rows = new Set();
  const cols = new Set();

  for (const key of selectedCells) {
    const [r, c] = key.split(',').map(Number);
    rows.add(r);
    cols.add(c);
  }

  return { rows, cols };
}
