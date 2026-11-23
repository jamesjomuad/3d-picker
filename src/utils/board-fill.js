import {
  calculateColSelection,
  calculateRectSelection,
  calculateRowSelection,
  getSelectionBounds,
  isSolidRectangle,
} from './selection';

/**
 * Drag-fill (the Excel fill handle) for an editable Angle Board.
 *
 * A fill has two rectangles: the `source` block the digits come from and the
 * `target` block they are written to. Dragging outward cycles the source pattern
 * over the larger area, dragging inward crops it, and a block with nothing to
 * extend simply keeps its own digits.
 *
 * Pure module: it never mutates the grid, and it reports only the cells whose digit
 * actually changes, so the caller can skip no-op writes.
 */

/**
 * Cells a drag covers, row-major.
 *
 * @param {{ startRow: number, startCol: number, endRow: number, endCol: number, mode: 'cell'|'row'|'col' }|null} rect
 * @param {number} totalRows
 * @param {number} totalCols
 * @returns {Array<{ row: number, col: number }>}
 */
export function getDragCells(rect, totalRows, totalCols) {
  if (!rect) return [];

  const { startRow, startCol, endRow, endCol, mode } = rect;
  const keys =
    mode === 'row'
      ? calculateRowSelection(startRow, endRow, totalRows, totalCols)
      : mode === 'col'
        ? calculateColSelection(startCol, endCol, totalRows, totalCols)
        : calculateRectSelection(startRow, startCol, endRow, endCol, totalRows, totalCols);

  return [...keys]
    .map((key) => {
      const [row, col] = key.split(',').map(Number);
      return { row, col };
    })
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

/**
 * The block a fill copies from: the current selection when it is a solid rectangle
 * the drag touches (that is what a fill handle extends), and the dragged block
 * itself otherwise. A self-source changes nothing, which is the right answer for a
 * board with no selection yet: there is no pattern to invent.
 *
 * @param {number[][]} grid
 * @param {Set<string>|null} selection - the selection when the drag started
 * @param {Object} target - the dragged rectangle
 * @returns {Object} a drag-shaped rectangle
 */
export function getFillSource(grid, selection, target) {
  const totalRows = grid.length;
  const totalCols = grid[0].length;

  const bounds = getSelectionBounds(selection);
  if (!bounds || !isSolidRectangle(selection)) return target;

  const source = {
    startRow: bounds.minRow,
    startCol: bounds.minCol,
    endRow: bounds.maxRow,
    endCol: bounds.maxCol,
    mode: 'cell',
  };

  const sourceKeys = new Set(
    getDragCells(source, totalRows, totalCols).map((cell) => `${cell.row},${cell.col}`)
  );
  const touchesBlock = getDragCells(target, totalRows, totalCols).some((cell) =>
    sourceKeys.has(`${cell.row},${cell.col}`)
  );

  return touchesBlock ? source : target;
}

/**
 * Digits to write when the `source` block is filled over the `target` block.
 *
 * Each target cell takes the source cell at the same offset, wrapped around the
 * source's own height and width. Growing a two-row block by two rows repeats those
 * two rows; shrinking one keeps the digits that stay inside; extending upward or
 * leftward cycles the pattern the same way.
 *
 * @param {number[][]} grid - the board as it stands now
 * @param {Object} source - rectangle to copy from
 * @param {Object} target - rectangle to write to
 * @returns {Object<string, number>} changed cells as "row,col" -> digit, empty when
 *   the fill would change nothing
 */
export function computeFill(grid, source, target) {
  if (!grid || !grid.length || !source || !target) return {};

  const totalRows = grid.length;
  const totalCols = grid[0].length;

  const sourceCells = getDragCells(source, totalRows, totalCols);
  if (sourceCells.length === 0) return {};

  const startRow = sourceCells[0].row;
  const startCol = sourceCells[0].col;
  const height = sourceCells[sourceCells.length - 1].row - startRow + 1;
  const width = sourceCells[sourceCells.length - 1].col - startCol + 1;
  const pattern = sourceCells.map(({ row, col }) => grid[row][col]);

  const changed = {};
  for (const cell of getDragCells(target, totalRows, totalCols)) {
    // Wrapped offsets, so a target reaching above or left of the source still lands
    // inside the pattern (JS `%` keeps the sign of its dividend).
    const from = startRow + wrap(cell.row - startRow, height);
    const to = startCol + wrap(cell.col - startCol, width);
    const value = pattern[(from - startRow) * width + (to - startCol)];

    if (grid[cell.row][cell.col] !== value) {
      changed[`${cell.row},${cell.col}`] = value;
    }
  }

  return changed;
}

/** Non-negative modulo: `offset % size` alone can go negative. */
function wrap(offset, size) {
  return ((offset % size) + size) % size;
}
