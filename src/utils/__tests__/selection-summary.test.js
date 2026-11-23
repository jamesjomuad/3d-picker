import boardData from '@/data/angle-board.json';
import {
  calculateColSelection,
  calculateRectSelection,
  calculateRowSelection,
} from '@/utils/selection';
import { getSelectedCellEntries, getSelectionSummary } from '@/utils/selection-summary';

const grid = boardData.grid;
const TOTAL_ROWS = grid.length;
const TOTAL_COLS = grid[0].length;

const keysFor = (pairs) => new Set(pairs.map(([row, col]) => `${row},${col}`));
const summaryFor = (selectedCells, options) => getSelectionSummary(grid, selectedCells, options);

// Selections come from the engine, exactly as the board produces them.
const rect = (startRow, startCol, endRow, endCol) =>
  calculateRectSelection(startRow, startCol, endRow, endCol, TOTAL_ROWS, TOTAL_COLS);
const rows = (startRow, endRow) =>
  calculateRowSelection(startRow, endRow, TOTAL_ROWS, TOTAL_COLS);
const cols = (startCol, endCol) =>
  calculateColSelection(startCol, endCol, TOTAL_ROWS, TOTAL_COLS);

describe('empty selection', () => {
  it('reports an empty summary', () => {
    const summary = summaryFor(new Set());

    expect(summary.hasSelection).toBe(false);
    expect(summary.count).toBe(0);
    expect(summary.type).toBe('none');
    expect(summary.entries).toEqual([]);
    expect(summary.digits).toEqual([]);
    expect(summary.digitsText).toBe('');
    expect(summary.coordinatesText).toBe('');
    expect(summary.rangeLabel).toBeNull();
  });

  it('tolerates a missing selection set', () => {
    expect(getSelectionSummary(grid, null).hasSelection).toBe(false);
  });
});

describe('single cell selection', () => {
  it('derives value, coordinate, range and type', () => {
    const summary = summaryFor(rect(0, 1, 0, 1));

    expect(summary.hasSelection).toBe(true);
    expect(summary.count).toBe(1);
    expect(summary.type).toBe('single');
    expect(summary.typeLabel).toBe('Single cell');
    expect(summary.digits).toEqual([0]);
    expect(summary.digitsText).toBe('0');
    expect(summary.coordinatesText).toBe('B1');
    expect(summary.rangeLabel).toBe('B1');
    expect(summary.entries[0]).toMatchObject({ row: 0, col: 1, value: 0, label: 'B1' });
  });

  it('keeps zero as a valid digit rather than treating it as empty', () => {
    const summary = summaryFor(keysFor([[3, 2]]));

    expect(grid[3][2]).toBe(0);
    expect(summary.count).toBe(1);
    expect(summary.digits).toEqual([0]);
    expect(summary.digitsText).toBe('0');
  });
});

describe('rectangular selection', () => {
  it('matches the documented example: 6,0,3,8 in A1:D1', () => {
    const summary = summaryFor(rect(0, 0, 0, 3));

    expect(summary.type).toBe('rect');
    expect(summary.typeLabel).toBe('Rectangular range');
    expect(summary.count).toBe(4);
    expect(summary.digits).toEqual([6, 0, 3, 8]);
    expect(summary.digitsText).toBe('6,0,3,8');
    expect(summary.rangeLabel).toBe('A1:D1');
    expect(summary.coordinatesText).toBe('A1  B1  C1  D1');
  });

  it('reads a multi-row rectangle in row-major order', () => {
    const summary = summaryFor(rect(0, 0, 1, 2));

    expect(summary.count).toBe(6);
    expect(summary.digits).toEqual([...grid[0].slice(0, 3), ...grid[1].slice(0, 3)]);
    expect(summary.rangeLabel).toBe('A1:C2');
  });

  it('returns the same range when dragged up-left', () => {
    const summary = summaryFor(rect(3, 3, 1, 1));

    expect(summary.type).toBe('rect');
    expect(summary.count).toBe(9);
    expect(summary.rangeLabel).toBe('B2:D4');
    expect(summary.entries[0]).toMatchObject({ row: 1, col: 1 });
    expect(summary.entries[8]).toMatchObject({ row: 3, col: 3 });
  });
});

describe('row selection', () => {
  it('classifies and labels multiple whole rows', () => {
    const summary = summaryFor(rows(2, 3));

    expect(summary.type).toBe('row');
    expect(summary.typeLabel).toBe('Entire rows');
    expect(summary.count).toBe(2 * TOTAL_COLS);
    expect(summary.rangeLabel).toBe('A3:J4');
    expect(summary.digits.slice(0, TOTAL_COLS)).toEqual(grid[2]);
    expect(summary.digits.slice(TOTAL_COLS)).toEqual(grid[3]);
  });

  it('uses the singular label for one row', () => {
    const summary = summaryFor(rows(4, 4));

    expect(summary.type).toBe('row');
    expect(summary.typeLabel).toBe('Entire row');
    expect(summary.count).toBe(TOTAL_COLS);
    expect(summary.rangeLabel).toBe('A5:J5');
  });
});

describe('column selection', () => {
  it('classifies and labels whole columns', () => {
    const summary = summaryFor(cols(1, 2));

    expect(summary.type).toBe('col');
    expect(summary.typeLabel).toBe('Entire columns');
    expect(summary.count).toBe(2 * TOTAL_ROWS);
    expect(summary.rangeLabel).toBe('B1:C10');
    expect(summary.digits.slice(0, 2)).toEqual([grid[0][1], grid[0][2]]);
    expect(summary.digits.slice(2, 4)).toEqual([grid[1][1], grid[1][2]]);
  });

  it('uses the singular label for one column', () => {
    const summary = summaryFor(cols(5, 5));

    expect(summary.type).toBe('col');
    expect(summary.typeLabel).toBe('Entire column');
    expect(summary.count).toBe(TOTAL_ROWS);
    expect(summary.rangeLabel).toBe('F1:F10');
  });
});

describe('ordering', () => {
  it('is row-major regardless of the order cells entered the Set', () => {
    const summary = summaryFor(keysFor([[1, 2], [0, 1], [0, 0]]));

    expect(summary.entries.map((entry) => entry.key)).toEqual(['0,0', '0,1', '1,2']);
    expect(summary.digits).toEqual([grid[0][0], grid[0][1], grid[1][2]]);
  });

  it('returns entries for grid cells only', () => {
    const entries = getSelectedCellEntries(grid, keysFor([[0, 0], [99, 99]]));

    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe('0,0');
  });
});

describe('large selections', () => {
  it('collapses the coordinate list but keeps every digit', () => {
    const summary = summaryFor(rect(0, 0, 9, 9));

    expect(summary.count).toBe(TOTAL_ROWS * TOTAL_COLS);
    expect(summary.type).toBe('rect');
    expect(summary.digitsText.split(',')).toHaveLength(TOTAL_ROWS * TOTAL_COLS);
    expect(summary.coordinatesText).toBe('A1 → J10');
    expect(summary.rangeLabel).toBe('A1:J10');
  });

  it('honours a custom coordinate list limit', () => {
    const summary = summaryFor(keysFor([[0, 0], [0, 1], [0, 2], [0, 3]]), {
      coordinateListLimit: 2,
    });

    expect(summary.coordinatesText).toBe('A1 → D1');
  });

  it('classifies a full-board selection as a rectangle, not rows or columns', () => {
    const fullBoard = summaryFor(keysFor(grid.flatMap((row, r) => row.map((_, c) => [r, c]))));
    expect(fullBoard.type).toBe('rect');
  });

  it('falls back to a custom type for non-rectangular sets', () => {
    const summary = summaryFor(keysFor([[0, 0], [0, 1], [1, 1]]));

    expect(summary.type).toBe('custom');
    expect(summary.typeLabel).toBe('Selection');
    expect(summary.count).toBe(3);
  });
});

describe('engine to summary', () => {
  it('reports each selection shape the board can commit', () => {
    expect(summaryFor(rect(0, 1, 0, 1)).digitsText).toBe('0');
    expect(summaryFor(rect(0, 0, 0, 3)).digitsText).toBe('6,0,3,8');
    expect(summaryFor(rows(2, 3)).count).toBe(20);
    expect(summaryFor(cols(6, 8)).type).toBe('col');
    expect(summaryFor(new Set()).hasSelection).toBe(false);
  });
});
