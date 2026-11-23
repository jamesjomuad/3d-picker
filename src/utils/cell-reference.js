/**
 * Spreadsheet-style cell references
 *
 * Board coordinates stay zero-based numbers everywhere internally — gesture
 * mapping, the store's "row,col" keys and the selection engine all work in
 * indexes. This module is the only place that converts them to the Excel
 * notation the user sees: a lettered column plus a 1-based row, so row 0 /
 * col 3 displays as "D1".
 */

const LETTER_A = 65;
const ALPHABET_LENGTH = 26;

/**
 * Convert a zero-based column index to spreadsheet column letters
 * 0 -> A, 1 -> B, 9 -> J, 25 -> Z, 26 -> AA
 *
 * @param {number} col - zero-based column index
 * @returns {string} uppercase letters, or '' for a non-integer/negative index
 */
export function getColumnLetter(col) {
  if (!Number.isInteger(col) || col < 0) return '';

  let letters = '';
  // Columns are 1-based in Excel notation (A is column 1), while the loop
  // consumes a zero-based remainder, hence the -1 offsets on both sides.
  let value = col + 1;

  while (value > 0) {
    const remainder = (value - 1) % ALPHABET_LENGTH;
    letters = String.fromCharCode(LETTER_A + remainder) + letters;
    value = Math.floor((value - 1) / ALPHABET_LENGTH);
  }

  return letters;
}

/**
 * Cell reference for a zero-based row/column pair, e.g. 9 / 9 -> "J10"
 *
 * @param {number} row
 * @param {number} col
 * @returns {string}
 */
export function getCellReference(row, col) {
  return `${getColumnLetter(col)}${row + 1}`;
}

/**
 * Reference range between two opposite corners, in any drag direction.
 * Anchored on the top-left corner so dragging up-left reads the same as
 * dragging down-right: "A1", "A1:D1", "B2:D5".
 *
 * @param {number} startRow
 * @param {number} startCol
 * @param {number} endRow
 * @param {number} endCol
 * @returns {string} a single reference when both corners are the same cell
 */
export function getRangeReference(startRow, startCol, endRow, endCol) {
  const from = getCellReference(Math.min(startRow, endRow), Math.min(startCol, endCol));
  const to = getCellReference(Math.max(startRow, endRow), Math.max(startCol, endCol));

  return from === to ? from : `${from}:${to}`;
}

/**
 * Ordered path of cell references joined for display, e.g.
 * `[{row:0,column:0},{row:1,column:1}]` -> "A1 → B2".
 *
 * Reads `column` (the combination-search result shape) and falls back to
 * `col` (the board's internal shape), so either path can be displayed.
 *
 * @param {Array<{ row: number, column?: number, col?: number }>} path
 * @returns {string}
 */
export function getPathReference(path) {
  return path.map((cell) => getCellReference(cell.row, cell.column ?? cell.col)).join(' → ');
}
