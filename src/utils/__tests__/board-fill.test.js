import { getDragCells, getFillSource, computeFill } from '../board-fill';

/**
 * The board used by these tests is 4 rows x 3 columns, deliberately uneven in
 * value so every fill result can be read by eye.
 */
const GRID = [
  [6, 0, 3],
  [4, 2, 7],
  [1, 8, 9],
  [5, 5, 5],
];
const ROWS = GRID.length;
const COLS = GRID[0].length;

const drag = (startRow, startCol, endRow, endCol, mode = 'cell') => ({
  startRow,
  startCol,
  endRow,
  endCol,
  mode,
});

const cells = (...keys) => new Set(keys);

describe('getDragCells', () => {
  it('lists a rectangle in row-major order', () => {
    expect(getDragCells(drag(1, 1, 2, 2), ROWS, COLS)).toEqual([
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
    ]);
  });

  it('reads an up-left drag like a down-right one', () => {
    expect(getDragCells(drag(2, 2, 1, 1), ROWS, COLS)).toEqual(
      getDragCells(drag(1, 1, 2, 2), ROWS, COLS)
    );
  });

  it('expands a row drag to the whole width', () => {
    expect(getDragCells(drag(1, 1, 2, 1, 'row'), ROWS, COLS)).toEqual([
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
    ]);
  });

  it('expands a column drag to the whole height', () => {
    // A column drag is a header drag: it covers every row of that column, which
    // is what makes filling it different from dragging over two cells.
    expect(getDragCells(drag(0, 1, 1, 1, 'col'), ROWS, COLS)).toEqual([
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 2, col: 1 },
      { row: 3, col: 1 },
    ]);
  });

  it('keeps a single-cell drag a single cell', () => {
    expect(getDragCells(drag(2, 2, 2, 2), ROWS, COLS)).toEqual([{ row: 2, col: 2 }]);
  });
});

describe('getFillSource', () => {
  const target = drag(0, 0, 1, 1);

  it('takes a selected block the drag touches', () => {
    expect(getFillSource(GRID, cells('0,0', '0,1'), target)).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 0,
      endCol: 1,
      mode: 'cell',
    });
  });

  it('ignores a selection the drag does not touch', () => {
    // Row 2 is a solid block, but the drag is far above it: nothing to extend.
    expect(getFillSource(GRID, cells('2,0', '2,1', '2,2'), target)).toEqual(target);
  });

  it('ignores a selection that is not a solid block', () => {
    // Two cells on a diagonal: no rectangle to repeat, so the drag is its own source.
    expect(getFillSource(GRID, cells('0,0', '1,1'), target)).toEqual(target);
  });

  it('falls back to the drag with no selection at all', () => {
    expect(getFillSource(GRID, cells(), target)).toEqual(target);
    expect(getFillSource(GRID, null, target)).toEqual(target);
  });
});

describe('computeFill', () => {
  it('repeats one digit across the drag', () => {
    // Source A1 (6) dragged over the row it sits on.
    expect(computeFill(GRID, drag(0, 0, 0, 0), drag(0, 0, 0, 2))).toEqual({
      '0,1': 6,
      '0,2': 6,
    });
  });

  it('reports only the cells that change', () => {
    // The source cell itself already holds 6, so it is not a change.
    const changes = computeFill(GRID, drag(0, 0, 0, 0), drag(0, 0, 0, 0));
    expect(changes).toEqual({});
  });

  it('extends a block downward by repeating its rows', () => {
    // Rows 1-2 (the pattern) grown to rows 1-3.
    const changes = computeFill(GRID, drag(1, 0, 2, 2), drag(1, 0, 3, 2));

    expect(changes).toEqual({
      '3,0': 4,
      '3,1': 2,
      '3,2': 7,
    });
  });

  it('extends a block upward, cycling the pattern', () => {
    // Rows 1-2 as the pattern, dragged up to include row 0: Excel repeats the
    // series backwards, which for a cyclic fill means the last pattern row again.
    const changes = computeFill(GRID, drag(1, 0, 2, 2), drag(0, 0, 2, 2));

    expect(changes).toEqual({ '0,0': 1, '0,1': 8, '0,2': 9 });
  });

  it('extends a block leftward, cycling the pattern', () => {
    // B1:C1 (0,3) dragged left to include A1.
    const changes = computeFill(GRID, drag(0, 1, 0, 2), drag(0, 0, 0, 2));

    expect(changes).toEqual({ '0,0': 3 });
  });

  it('leaves a block alone when a smaller drag crops it', () => {
    // Rows 1-2 hold the pattern, but the drag only covers rows 1-2: identical.
    expect(computeFill(GRID, drag(1, 0, 2, 2), drag(1, 0, 2, 2))).toEqual({});
  });

  it('fills a whole row from one cell', () => {
    expect(computeFill(GRID, drag(0, 0, 0, 0), drag(1, 0, 1, 0, 'row'))).toEqual({
      '1,0': 6,
      '1,1': 6,
      '1,2': 6,
    });
  });

  it('fills a whole column from a selected block', () => {
    // Rows 1-2, column 0 holds 4 then 1; extended up and down it repeats 4,1.
    const changes = computeFill(GRID, drag(1, 0, 2, 0), drag(0, 0, 3, 0, 'col'));

    expect(changes).toEqual({ '0,0': 1, '3,0': 4 });
  });

  it('tiles a block over a larger rectangle', () => {
    // A1:B2 (6,0 / 4,2) spread over the whole board.
    const changes = computeFill(GRID, drag(0, 0, 1, 1), drag(0, 0, 3, 2));

    expect(changes['2,0']).toBe(6);
    expect(changes['2,1']).toBe(0);
    expect(changes['3,1']).toBe(2);
    // Column 3 is outside the 2-column pattern, so it wraps to the pattern's first column.
    expect(changes['2,2']).toBe(6);
  });

  it('does nothing without a source or target', () => {
    expect(computeFill(GRID, null, drag(0, 0, 0, 0))).toEqual({});
    expect(computeFill(GRID, drag(0, 0, 0, 0), null)).toEqual({});
    expect(computeFill(null, drag(0, 0, 0, 0), drag(0, 0, 0, 0))).toEqual({});
  });

  it('never mutates the grid it read', () => {
    const before = GRID.map((row) => [...row]);
    computeFill(GRID, drag(0, 0, 1, 1), drag(0, 0, 3, 2));
    expect(GRID).toEqual(before);
  });
});
