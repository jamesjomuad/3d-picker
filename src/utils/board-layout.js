/**
 * Board layout geometry
 *
 * All pixel maths for the Angle Board lives here: header sizes, the responsive
 * cell size, and the rectangle a drag covers. Rendering and gesture mapping read
 * the same constants, so the board can never be drawn at a size the touch
 * mapper disagrees with.
 *
 * Pure module: no React, no theme, no side effects.
 */

/** Width of the row-header column (and of the corner cell). */
export const HEADER_WIDTH = 28;

/** Height of the column-header row (and of the corner cell). */
export const HEADER_HEIGHT = 24;

/** Cell size used before the container has been measured. */
export const DEFAULT_CELL_SIZE = 35;

/** Below this the digits stop being readable. */
export const MIN_CELL_SIZE = 24;

/** Above this a 10-column board just wastes screen width. */
export const MAX_CELL_SIZE = 50;

/**
 * Largest cell size that fits a number of columns in the available width,
 * clamped to the readable range.
 *
 * @param {number} availableWidth - width left for cells, i.e. container width
 *   minus HEADER_WIDTH
 * @param {number} totalCols
 * @returns {number} cell size in dp
 */
export function calculateCellSize(availableWidth, totalCols) {
  if (!(availableWidth > 0) || !(totalCols > 0)) return DEFAULT_CELL_SIZE;

  const fitted = Math.floor(availableWidth / totalCols);
  return Math.max(MIN_CELL_SIZE, Math.min(fitted, MAX_CELL_SIZE));
}

/**
 * Pixel size of a whole board (headers included) at a given cell size.
 *
 * @param {number} totalRows
 * @param {number} totalCols
 * @param {number} cellSize
 * @returns {{ width: number, height: number }}
 */
export function getBoardSize(totalRows, totalCols, cellSize) {
  return {
    width: HEADER_WIDTH + totalCols * cellSize,
    height: HEADER_HEIGHT + totalRows * cellSize,
  };
}

/**
 * Absolute rectangle inside the board container that a drag currently covers.
 * Row and column drags span the whole board in the other axis, like Excel.
 *
 * @param {{ startRow: number, startCol: number, endRow: number, endCol: number, mode: 'cell'|'row'|'col' } | null} dragState
 * @param {number} cellSize
 * @param {number} totalRows
 * @param {number} totalCols
 * @returns {{ top: number, left: number, width: number, height: number } | null}
 */
export function getSelectionRect(dragState, cellSize, totalRows, totalCols) {
  if (!dragState) return null;

  const { startRow, startCol, endRow, endCol, mode } = dragState;
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);

  if (mode === 'row') {
    return {
      top: HEADER_HEIGHT + minRow * cellSize,
      left: HEADER_WIDTH,
      width: totalCols * cellSize,
      height: (maxRow - minRow + 1) * cellSize,
    };
  }

  if (mode === 'col') {
    return {
      top: HEADER_HEIGHT,
      left: HEADER_WIDTH + minCol * cellSize,
      width: (maxCol - minCol + 1) * cellSize,
      height: totalRows * cellSize,
    };
  }

  return {
    top: HEADER_HEIGHT + minRow * cellSize,
    left: HEADER_WIDTH + minCol * cellSize,
    width: (maxCol - minCol + 1) * cellSize,
    height: (maxRow - minRow + 1) * cellSize,
  };
}
