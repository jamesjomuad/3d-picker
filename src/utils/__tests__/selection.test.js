import {
  clamp,
  calculateRectSelection,
  calculateRowSelection,
  calculateColSelection,
  touchToCell,
  touchToDragState,
  getTouchZone,
  getDragHighlights,
  getSelectedRowsAndCols,
} from '../selection';

const TOTAL_ROWS = 10;
const TOTAL_COLS = 10;

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 9)).toBe(5);
  });

  it('clamps to min when below', () => {
    expect(clamp(-3, 0, 9)).toBe(0);
  });

  it('clamps to max when above', () => {
    expect(clamp(15, 0, 9)).toBe(9);
  });

  it('handles min equal to max', () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });

  it('handles value equal to min', () => {
    expect(clamp(0, 0, 9)).toBe(0);
  });

  it('handles value equal to max', () => {
    expect(clamp(9, 0, 9)).toBe(9);
  });
});

describe('calculateRectSelection', () => {
  it('selects a single cell when start equals end', () => {
    const result = calculateRectSelection(3, 4, 3, 4, TOTAL_ROWS, TOTAL_COLS);
    expect(result.size).toBe(1);
    expect(result.has('3,4')).toBe(true);
  });

  it('selects a 2x2 rectangle', () => {
    const result = calculateRectSelection(1, 1, 2, 2, TOTAL_ROWS, TOTAL_COLS);
    expect(result.size).toBe(4);
    expect(result.has('1,1')).toBe(true);
    expect(result.has('1,2')).toBe(true);
    expect(result.has('2,1')).toBe(true);
    expect(result.has('2,2')).toBe(true);
  });

  it('selects correctly when dragging up-left (reversed coordinates)', () => {
    const result = calculateRectSelection(5, 5, 2, 3, TOTAL_ROWS, TOTAL_COLS);
    expect(result.size).toBe(12); // 4 rows × 3 cols
    expect(result.has('2,3')).toBe(true);
    expect(result.has('5,5')).toBe(true);
    expect(result.has('3,4')).toBe(true);
  });

  it('selects a horizontal line', () => {
    const result = calculateRectSelection(3, 0, 3, 9, TOTAL_ROWS, TOTAL_COLS);
    expect(result.size).toBe(10);
    for (let c = 0; c < 10; c++) {
      expect(result.has(`3,${c}`)).toBe(true);
    }
  });

  it('selects a vertical line', () => {
    const result = calculateRectSelection(0, 5, 9, 5, TOTAL_ROWS, TOTAL_COLS);
    expect(result.size).toBe(10);
    for (let r = 0; r < 10; r++) {
      expect(result.has(`${r},5`)).toBe(true);
    }
  });

  it('selects entire grid', () => {
    const result = calculateRectSelection(0, 0, 9, 9, TOTAL_ROWS, TOTAL_COLS);
    expect(result.size).toBe(100);
  });

  it('clamps out-of-bounds coordinates to edges', () => {
    const result = calculateRectSelection(-2, -1, 15, 12, TOTAL_ROWS, TOTAL_COLS);
    expect(result.size).toBe(100); // clamped to full grid
  });

  it('handles diagonal drag from bottom-right to top-left', () => {
    const result = calculateRectSelection(8, 7, 2, 1, TOTAL_ROWS, TOTAL_COLS);
    expect(result.size).toBe(49); // 7 rows × 7 cols
    expect(result.has('2,1')).toBe(true);
    expect(result.has('8,7')).toBe(true);
  });

  it('handles diagonal drag from top-left to bottom-right', () => {
    const result = calculateRectSelection(1, 2, 7, 8, TOTAL_ROWS, TOTAL_COLS);
    expect(result.size).toBe(49); // 7 rows × 7 cols
    expect(result.has('1,2')).toBe(true);
    expect(result.has('7,8')).toBe(true);
  });

  it('handles drag to grid edges', () => {
    const result = calculateRectSelection(0, 0, 0, 0, TOTAL_ROWS, TOTAL_COLS);
    expect(result.size).toBe(1);
    expect(result.has('0,0')).toBe(true);

    const result2 = calculateRectSelection(9, 9, 9, 9, TOTAL_ROWS, TOTAL_COLS);
    expect(result2.size).toBe(1);
    expect(result2.has('9,9')).toBe(true);
  });
});

describe('calculateRowSelection', () => {
  it('selects a single row (all columns)', () => {
    const result = calculateRowSelection(3, 3, TOTAL_ROWS, TOTAL_COLS);
    expect(result.size).toBe(10);
    for (let c = 0; c < 10; c++) {
      expect(result.has(`3,${c}`)).toBe(true);
    }
  });

  it('selects a range of rows (all columns)', () => {
    const result = calculateRowSelection(2, 5, TOTAL_ROWS, TOTAL_COLS);
    expect(result.size).toBe(40); // 4 rows × 10 cols
    for (let r = 2; r <= 5; r++) {
      for (let c = 0; c < 10; c++) {
        expect(result.has(`${r},${c}`)).toBe(true);
      }
    }
  });

  it('handles reversed row range', () => {
    const result = calculateRowSelection(7, 3, TOTAL_ROWS, TOTAL_COLS);
    expect(result.size).toBe(50); // 5 rows × 10 cols
  });
});

describe('calculateColSelection', () => {
  it('selects a single column (all rows)', () => {
    const result = calculateColSelection(4, 4, TOTAL_ROWS, TOTAL_COLS);
    expect(result.size).toBe(10);
    for (let r = 0; r < 10; r++) {
      expect(result.has(`${r},4`)).toBe(true);
    }
  });

  it('selects a range of columns (all rows)', () => {
    const result = calculateColSelection(1, 6, TOTAL_ROWS, TOTAL_COLS);
    expect(result.size).toBe(60); // 10 rows × 6 cols
    for (let r = 0; r < 10; r++) {
      for (let c = 1; c <= 6; c++) {
        expect(result.has(`${r},${c}`)).toBe(true);
      }
    }
  });

  it('handles reversed column range', () => {
    const result = calculateColSelection(8, 2, TOTAL_ROWS, TOTAL_COLS);
    expect(result.size).toBe(70); // 10 rows × 7 cols
  });
});

describe('touchToCell', () => {
  const HEADER_W = 28;
  const HEADER_H = 24;
  const CELL = 35;

  it('returns the correct cell for a position in the grid area', () => {
    const result = touchToCell(HEADER_W + 10, HEADER_H + 10, HEADER_W, HEADER_H, CELL, TOTAL_ROWS, TOTAL_COLS);
    expect(result).toEqual({ row: 0, col: 0 });
  });

  it('returns cell (3, 4) for correct coordinates', () => {
    const x = HEADER_W + 4 * CELL + 10; // col 4
    const y = HEADER_H + 3 * CELL + 10; // row 3
    const result = touchToCell(x, y, HEADER_W, HEADER_H, CELL, TOTAL_ROWS, TOTAL_COLS);
    expect(result).toEqual({ row: 3, col: 4 });
  });

  it('clamps to last cell at grid edges', () => {
    const x = HEADER_W + 9 * CELL + 30; // past last col
    const y = HEADER_H + 9 * CELL + 30; // past last row
    const result = touchToCell(x, y, HEADER_W, HEADER_H, CELL, TOTAL_ROWS, TOTAL_COLS);
    expect(result).toEqual({ row: 9, col: 9 });
  });

  it('returns null for touch in header area (negative grid coords)', () => {
    const result = touchToCell(10, 10, HEADER_W, HEADER_H, CELL, TOTAL_ROWS, TOTAL_COLS);
    expect(result).toBeNull();
  });

  it('returns null when x is in row header area', () => {
    const result = touchToCell(5, HEADER_H + 50, HEADER_W, HEADER_H, CELL, TOTAL_ROWS, TOTAL_COLS);
    expect(result).toBeNull();
  });

  it('returns null when y is in col header area', () => {
    const result = touchToCell(HEADER_W + 50, 5, HEADER_W, HEADER_H, CELL, TOTAL_ROWS, TOTAL_COLS);
    expect(result).toBeNull();
  });

  it('returns first cell at exact grid start', () => {
    const result = touchToCell(HEADER_W, HEADER_H, HEADER_W, HEADER_H, CELL, TOTAL_ROWS, TOTAL_COLS);
    expect(result).toEqual({ row: 0, col: 0 });
  });
});

describe('getTouchZone', () => {
  const HEADER_W = 28;
  const HEADER_H = 24;

  it('returns "cell" for touch in the grid area', () => {
    expect(getTouchZone(HEADER_W + 10, HEADER_H + 10, HEADER_W, HEADER_H)).toBe('cell');
  });

  it('returns "col" for touch in column header area', () => {
    expect(getTouchZone(HEADER_W + 50, 10, HEADER_W, HEADER_H)).toBe('col');
  });

  it('returns "row" for touch in row header area', () => {
    expect(getTouchZone(10, HEADER_H + 50, HEADER_W, HEADER_H)).toBe('row');
  });

  it('returns "corner" for touch in corner area', () => {
    expect(getTouchZone(10, 10, HEADER_W, HEADER_H)).toBe('corner');
  });

  it('returns "col" at exact column header boundary', () => {
    expect(getTouchZone(HEADER_W, HEADER_H - 1, HEADER_W, HEADER_H)).toBe('col');
  });

  it('returns "row" at exact row header boundary', () => {
    expect(getTouchZone(HEADER_W - 1, HEADER_H, HEADER_W, HEADER_H)).toBe('row');
  });
});

describe('getDragHighlights', () => {
  it('returns empty sets when dragState is null', () => {
    const result = getDragHighlights(null, TOTAL_ROWS, TOTAL_COLS);
    expect(result.rows.size).toBe(0);
    expect(result.cols.size).toBe(0);
  });

  it('highlights correct rows and cols for cell mode', () => {
    const dragState = { startRow: 2, startCol: 3, endRow: 5, endCol: 7, mode: 'cell' };
    const result = getDragHighlights(dragState, TOTAL_ROWS, TOTAL_COLS);
    expect(result.rows).toEqual(new Set([2, 3, 4, 5]));
    expect(result.cols).toEqual(new Set([3, 4, 5, 6, 7]));
  });

  it('highlights all cols for row mode', () => {
    const dragState = { startRow: 1, startCol: 0, endRow: 3, endCol: 9, mode: 'row' };
    const result = getDragHighlights(dragState, TOTAL_ROWS, TOTAL_COLS);
    expect(result.rows).toEqual(new Set([1, 2, 3]));
    expect(result.cols.size).toBe(10); // all columns
  });

  it('highlights all rows for col mode', () => {
    const dragState = { startRow: 0, startCol: 2, endRow: 9, endCol: 5, mode: 'col' };
    const result = getDragHighlights(dragState, TOTAL_ROWS, TOTAL_COLS);
    expect(result.rows.size).toBe(10); // all rows
    expect(result.cols).toEqual(new Set([2, 3, 4, 5]));
  });

  it('handles reversed cell drag', () => {
    const dragState = { startRow: 7, startCol: 8, endRow: 2, endCol: 3, mode: 'cell' };
    const result = getDragHighlights(dragState, TOTAL_ROWS, TOTAL_COLS);
    expect(result.rows).toEqual(new Set([2, 3, 4, 5, 6, 7]));
    expect(result.cols).toEqual(new Set([3, 4, 5, 6, 7, 8]));
  });
});

describe('getSelectedRowsAndCols', () => {
  it('returns empty sets for empty selection', () => {
    const result = getSelectedRowsAndCols(new Set());
    expect(result.rows.size).toBe(0);
    expect(result.cols.size).toBe(0);
  });

  it('extracts rows and cols from selection', () => {
    const selected = new Set(['1,2', '1,5', '3,2', '3,5']);
    const result = getSelectedRowsAndCols(selected);
    expect(result.rows).toEqual(new Set([1, 3]));
    expect(result.cols).toEqual(new Set([2, 5]));
  });

  it('handles single cell', () => {
    const result = getSelectedRowsAndCols(new Set(['4,7']));
    expect(result.rows).toEqual(new Set([4]));
    expect(result.cols).toEqual(new Set([7]));
  });
});

describe('touchToCell — 10x10 round trip', () => {
  const HEADER_W = 28;
  const HEADER_H = 24;

  // Every point inside a cell must map back to exactly that cell.
  [24, 30, 35, 50].forEach((CELL) => {
    it(`maps every cell back to itself at cellSize ${CELL}`, () => {
      for (let row = 0; row < TOTAL_ROWS; row++) {
        for (let col = 0; col < TOTAL_COLS; col++) {
          const x = HEADER_W + col * CELL + CELL / 2;
          const y = HEADER_H + row * CELL + CELL / 2;
          expect(touchToCell(x, y, HEADER_W, HEADER_H, CELL, TOTAL_ROWS, TOTAL_COLS)).toEqual({
            row,
            col,
          });
        }
      }
    });

    it(`maps the exact top-left corner of every cell at cellSize ${CELL}`, () => {
      for (let row = 0; row < TOTAL_ROWS; row++) {
        for (let col = 0; col < TOTAL_COLS; col++) {
          const x = HEADER_W + col * CELL;
          const y = HEADER_H + row * CELL;
          expect(touchToCell(x, y, HEADER_W, HEADER_H, CELL, TOTAL_ROWS, TOTAL_COLS)).toEqual({
            row,
            col,
          });
        }
      }
    });
  });

  it('does not leak into the next cell at the boundary', () => {
    const CELL = 35;
    expect(
      touchToCell(HEADER_W + CELL - 0.5, HEADER_H + CELL - 0.5, HEADER_W, HEADER_H, CELL, TOTAL_ROWS, TOTAL_COLS)
    ).toEqual({ row: 0, col: 0 });
  });

  it('clamps a touch past the far edge to the last cell', () => {
    const CELL = 35;
    expect(
      touchToCell(
        HEADER_W + TOTAL_COLS * CELL,
        HEADER_H + TOTAL_ROWS * CELL,
        HEADER_W,
        HEADER_H,
        CELL,
        TOTAL_ROWS,
        TOTAL_COLS
      )
    ).toEqual({ row: TOTAL_ROWS - 1, col: TOTAL_COLS - 1 });
  });

  it('rejects negative (outside the grid) coordinates', () => {
    const CELL = 35;
    expect(touchToCell(-5, HEADER_H + 10, HEADER_W, HEADER_H, CELL, TOTAL_ROWS, TOTAL_COLS)).toBeNull();
    expect(touchToCell(HEADER_W + 10, -5, HEADER_W, HEADER_H, CELL, TOTAL_ROWS, TOTAL_COLS)).toBeNull();
  });

  it('rejects cell-local coordinates (the old gesture failure signature)', () => {
    // React Native reports locationX/locationY relative to the deepest touched
    // view. When the cells were hit-testable, a tap at the centre of a cell
    // arrived as ~(17, 17); subtracting the header offsets underflowed and
    // touchToCell returned null, so no selection ever started. The grid keeps
    // its children pointerEvents="none" so coordinates arrive in container
    // space; this test pins the shape of the broken payload.
    const CELL = 35;
    const cellLocalCentre = CELL / 2;
    expect(
      touchToCell(cellLocalCentre, cellLocalCentre, HEADER_W, HEADER_H, CELL, TOTAL_ROWS, TOTAL_COLS)
    ).toBeNull();
  });
});

describe('touchToDragState', () => {
  const HEADER_W = 28;
  const HEADER_H = 24;
  const CELL = 35;

  it('starts a cell-mode drag inside the grid', () => {
    const drag = touchToDragState(
      HEADER_W + 4 * CELL + 10,
      HEADER_H + 3 * CELL + 10,
      HEADER_W,
      HEADER_H,
      CELL,
      TOTAL_ROWS,
      TOTAL_COLS
    );
    expect(drag).toEqual({ startRow: 3, startCol: 4, endRow: 3, endCol: 4, mode: 'cell' });
  });

  it('returns null for the corner', () => {
    expect(touchToDragState(5, 5, HEADER_W, HEADER_H, CELL, TOTAL_ROWS, TOTAL_COLS)).toBeNull();
  });

  it('starts a full-row drag from a row header', () => {
    const drag = touchToDragState(
      10,
      HEADER_H + 6 * CELL + 10,
      HEADER_W,
      HEADER_H,
      CELL,
      TOTAL_ROWS,
      TOTAL_COLS
    );
    expect(drag).toEqual({
      startRow: 6,
      startCol: 0,
      endRow: 6,
      endCol: TOTAL_COLS - 1,
      mode: 'row',
    });
  });

  it('starts a full-column drag from a column header', () => {
    const drag = touchToDragState(
      HEADER_W + 2 * CELL + 10,
      10,
      HEADER_W,
      HEADER_H,
      CELL,
      TOTAL_ROWS,
      TOTAL_COLS
    );
    expect(drag).toEqual({
      startRow: 0,
      startCol: 2,
      endRow: TOTAL_ROWS - 1,
      endCol: 2,
      mode: 'col',
    });
  });

  it('maps every row header to its own row', () => {
    for (let row = 0; row < TOTAL_ROWS; row++) {
      const drag = touchToDragState(
        10,
        HEADER_H + row * CELL + CELL / 2,
        HEADER_W,
        HEADER_H,
        CELL,
        TOTAL_ROWS,
        TOTAL_COLS
      );
      expect(drag.mode).toBe('row');
      expect(drag.startRow).toBe(row);
      expect(drag.endRow).toBe(row);
    }
  });

  it('maps every column header to its own column', () => {
    for (let col = 0; col < TOTAL_COLS; col++) {
      const drag = touchToDragState(
        HEADER_W + col * CELL + CELL / 2,
        10,
        HEADER_W,
        HEADER_H,
        CELL,
        TOTAL_ROWS,
        TOTAL_COLS
      );
      expect(drag.mode).toBe('col');
      expect(drag.startCol).toBe(col);
      expect(drag.endCol).toBe(col);
    }
  });

  it('clamps a header touch past the end of the grid to the last row/column', () => {
    expect(
      touchToDragState(10, HEADER_H + 40 * CELL, HEADER_W, HEADER_H, CELL, TOTAL_ROWS, TOTAL_COLS)
        .startRow
    ).toBe(TOTAL_ROWS - 1);
    expect(
      touchToDragState(HEADER_W + 40 * CELL, 10, HEADER_W, HEADER_H, CELL, TOTAL_ROWS, TOTAL_COLS)
        .startCol
    ).toBe(TOTAL_COLS - 1);
  });

  it('treats the exact header boundary as the first cell', () => {
    expect(touchToDragState(HEADER_W, HEADER_H, HEADER_W, HEADER_H, CELL, TOTAL_ROWS, TOTAL_COLS)).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 0,
      endCol: 0,
      mode: 'cell',
    });
  });
});
