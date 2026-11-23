import { useBoardStore } from '@/store/boardStore';

const TOTAL_ROWS = 10;
const TOTAL_COLS = 10;

/** Read the current selection set straight from the store. */
const selection = () => useBoardStore.getState().selectedCells;

const keys = () => [...selection()].sort();

beforeEach(() => {
  useBoardStore.setState({ selectedCells: new Set() });
});

describe('initial state', () => {
  it('starts with nothing selected', () => {
    expect(selection().size).toBe(0);
  });
});

describe('selectCell', () => {
  it('selects a single cell', () => {
    useBoardStore.getState().selectCell(3, 4);
    expect(keys()).toEqual(['3,4']);
  });

  it('replaces the previous selection', () => {
    useBoardStore.getState().selectRect(0, 0, 1, 1, TOTAL_ROWS, TOTAL_COLS);
    useBoardStore.getState().selectCell(7, 2);
    expect(keys()).toEqual(['7,2']);
  });

  it('selects a cell whose digit is zero (selection is coordinate-based)', () => {
    // 0 is a valid digit, never "empty": the store keys on coordinates only.
    useBoardStore.getState().selectCell(0, 1);
    expect(useBoardStore.getState().isCellSelected(0, 1)).toBe(true);
    expect(selection().size).toBe(1);
  });
});

describe('selectRect', () => {
  it('selects a horizontal range', () => {
    useBoardStore.getState().selectRect(3, 2, 3, 5, TOTAL_ROWS, TOTAL_COLS);
    expect(keys()).toEqual(['3,2', '3,3', '3,4', '3,5']);
  });

  it('selects a vertical range', () => {
    useBoardStore.getState().selectRect(2, 6, 5, 6, TOTAL_ROWS, TOTAL_COLS);
    expect(keys()).toEqual(['2,6', '3,6', '4,6', '5,6']);
  });

  it('selects a diagonal range dragged down-right', () => {
    useBoardStore.getState().selectRect(1, 1, 3, 3, TOTAL_ROWS, TOTAL_COLS);
    expect(selection().size).toBe(9);
    expect(selection().has('1,1')).toBe(true);
    expect(selection().has('3,3')).toBe(true);
  });

  it('selects the same range dragged up-left', () => {
    useBoardStore.getState().selectRect(3, 3, 1, 1, TOTAL_ROWS, TOTAL_COLS);
    expect(selection().size).toBe(9);
    expect(selection().has('1,1')).toBe(true);
    expect(selection().has('3,3')).toBe(true);
  });

  it('selects a single cell when start and end match', () => {
    useBoardStore.getState().selectRect(9, 9, 9, 9, TOTAL_ROWS, TOTAL_COLS);
    expect(keys()).toEqual(['9,9']);
  });

  it('clamps out-of-bounds drags to the grid', () => {
    useBoardStore.getState().selectRect(-3, -3, 99, 99, TOTAL_ROWS, TOTAL_COLS);
    expect(selection().size).toBe(TOTAL_ROWS * TOTAL_COLS);
  });

  it('produces a new Set instance so subscribers re-render', () => {
    const before = selection();
    useBoardStore.getState().selectRect(0, 0, 0, 0, TOTAL_ROWS, TOTAL_COLS);
    expect(selection()).not.toBe(before);
  });
});

describe('selectRows', () => {
  it('selects one full row', () => {
    useBoardStore.getState().selectRows(4, 4, TOTAL_ROWS, TOTAL_COLS);
    expect(selection().size).toBe(TOTAL_COLS);
    for (let c = 0; c < TOTAL_COLS; c++) {
      expect(selection().has(`4,${c}`)).toBe(true);
    }
  });

  it('selects a reversed row range', () => {
    useBoardStore.getState().selectRows(6, 2, TOTAL_ROWS, TOTAL_COLS);
    expect(selection().size).toBe(5 * TOTAL_COLS);
    expect(selection().has('2,0')).toBe(true);
    expect(selection().has('6,9')).toBe(true);
  });
});

describe('selectCols', () => {
  it('selects one full column', () => {
    useBoardStore.getState().selectCols(5, 5, TOTAL_ROWS, TOTAL_COLS);
    expect(selection().size).toBe(TOTAL_ROWS);
    for (let r = 0; r < TOTAL_ROWS; r++) {
      expect(selection().has(`${r},5`)).toBe(true);
    }
  });

  it('selects a reversed column range', () => {
    useBoardStore.getState().selectCols(8, 6, TOTAL_ROWS, TOTAL_COLS);
    expect(selection().size).toBe(3 * TOTAL_ROWS);
    expect(selection().has('0,6')).toBe(true);
    expect(selection().has('9,8')).toBe(true);
  });
});

describe('clearSelection', () => {
  it('empties the selection', () => {
    useBoardStore.getState().selectRect(0, 0, 4, 4, TOTAL_ROWS, TOTAL_COLS);
    useBoardStore.getState().clearSelection();
    expect(selection().size).toBe(0);
  });
});

describe('queries', () => {
  it('getSelectionCount mirrors the set size', () => {
    useBoardStore.getState().selectRect(2, 2, 4, 5, TOTAL_ROWS, TOTAL_COLS);
    expect(useBoardStore.getState().getSelectionCount()).toBe(12);
  });

  it('isCellSelected is false for unselected cells', () => {
    useBoardStore.getState().selectCell(1, 1);
    expect(useBoardStore.getState().isCellSelected(1, 1)).toBe(true);
    expect(useBoardStore.getState().isCellSelected(1, 2)).toBe(false);
  });
});
