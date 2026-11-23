import boardData from '@/data/angle-board.json';
import { useBoardStore } from '@/store/boardStore';
import { getSelectedCellEntries, getSelectionSummary } from '@/utils/selection-summary';

const grid = boardData.grid;
const TOTAL_ROWS = grid.length;
const TOTAL_COLS = grid[0].length;

const keysFor = (pairs) => new Set(pairs.map(([row, col]) => `${row},${col}`));
const summaryFor = (selectedCells, options) => getSelectionSummary(grid, selectedCells, options);

beforeEach(() => {
  useBoardStore.setState({ selectedCells: new Set() });
});

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
    useBoardStore.getState().selectCell(0, 1);
    const summary = summaryFor(useBoardStore.getState().selectedCells);

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
    useBoardStore.getState().selectRect(0, 0, 0, 3, TOTAL_ROWS, TOTAL_COLS);
    const summary = summaryFor(useBoardStore.getState().selectedCells);

    expect(summary.type).toBe('rect');
    expect(summary.typeLabel).toBe('Rectangular range');
    expect(summary.count).toBe(4);
    expect(summary.digits).toEqual([6, 0, 3, 8]);
    expect(summary.digitsText).toBe('6,0,3,8');
    expect(summary.rangeLabel).toBe('A1:D1');
    expect(summary.coordinatesText).toBe('A1  B1  C1  D1');
  });

  it('reads a multi-row rectangle in row-major order', () => {
    useBoardStore.getState().selectRect(0, 0, 1, 2, TOTAL_ROWS, TOTAL_COLS);
    const summary = summaryFor(useBoardStore.getState().selectedCells);

    expect(summary.count).toBe(6);
    expect(summary.digits).toEqual([...grid[0].slice(0, 3), ...grid[1].slice(0, 3)]);
    expect(summary.rangeLabel).toBe('A1:C2');
  });

  it('returns the same range when dragged up-left', () => {
    useBoardStore.getState().selectRect(3, 3, 1, 1, TOTAL_ROWS, TOTAL_COLS);
    const summary = summaryFor(useBoardStore.getState().selectedCells);

    expect(summary.type).toBe('rect');
    expect(summary.count).toBe(9);
    expect(summary.rangeLabel).toBe('B2:D4');
    expect(summary.entries[0]).toMatchObject({ row: 1, col: 1 });
    expect(summary.entries[8]).toMatchObject({ row: 3, col: 3 });
  });
});

describe('row selection', () => {
  it('classifies and labels multiple whole rows', () => {
    useBoardStore.getState().selectRows(2, 3, TOTAL_ROWS, TOTAL_COLS);
    const summary = summaryFor(useBoardStore.getState().selectedCells);

    expect(summary.type).toBe('row');
    expect(summary.typeLabel).toBe('Entire rows');
    expect(summary.count).toBe(2 * TOTAL_COLS);
    expect(summary.rangeLabel).toBe('A3:J4');
    expect(summary.digits.slice(0, TOTAL_COLS)).toEqual(grid[2]);
    expect(summary.digits.slice(TOTAL_COLS)).toEqual(grid[3]);
  });

  it('uses the singular label for one row', () => {
    useBoardStore.getState().selectRows(4, 4, TOTAL_ROWS, TOTAL_COLS);
    const summary = summaryFor(useBoardStore.getState().selectedCells);

    expect(summary.type).toBe('row');
    expect(summary.typeLabel).toBe('Entire row');
    expect(summary.count).toBe(TOTAL_COLS);
    expect(summary.rangeLabel).toBe('A5:J5');
  });
});

describe('column selection', () => {
  it('classifies and labels whole columns', () => {
    useBoardStore.getState().selectCols(1, 2, TOTAL_ROWS, TOTAL_COLS);
    const summary = summaryFor(useBoardStore.getState().selectedCells);

    expect(summary.type).toBe('col');
    expect(summary.typeLabel).toBe('Entire columns');
    expect(summary.count).toBe(2 * TOTAL_ROWS);
    expect(summary.rangeLabel).toBe('B1:C10');
    expect(summary.digits.slice(0, 2)).toEqual([grid[0][1], grid[0][2]]);
    expect(summary.digits.slice(2, 4)).toEqual([grid[1][1], grid[1][2]]);
  });

  it('uses the singular label for one column', () => {
    useBoardStore.getState().selectCols(5, 5, TOTAL_ROWS, TOTAL_COLS);
    const summary = summaryFor(useBoardStore.getState().selectedCells);

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
    useBoardStore.getState().selectRect(0, 0, 9, 9, TOTAL_ROWS, TOTAL_COLS);
    const summary = summaryFor(useBoardStore.getState().selectedCells);

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

describe('live store integration', () => {
  it('reflects each selection change immediately', () => {
    const store = useBoardStore.getState;

    store().selectCell(0, 1);
    expect(summaryFor(store().selectedCells).digitsText).toBe('0');

    store().selectRect(0, 0, 0, 3, TOTAL_ROWS, TOTAL_COLS);
    expect(summaryFor(store().selectedCells).digitsText).toBe('6,0,3,8');

    store().selectRows(2, 3, TOTAL_ROWS, TOTAL_COLS);
    expect(summaryFor(store().selectedCells).count).toBe(20);

    store().selectCols(6, 8, TOTAL_ROWS, TOTAL_COLS);
    expect(summaryFor(store().selectedCells).type).toBe('col');

    store().clearSelection();
    expect(summaryFor(store().selectedCells).hasSelection).toBe(false);
  });
});
