import {
  MAX_BOARD_COLUMNS,
  MAX_BOARD_ROWS,
  MIN_BOARD_DIMENSION,
  isValidBoardDimension,
  resizeGrid,
} from '../board-resize';

const grid = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

describe('isValidBoardDimension', () => {
  it('accepts the bounds of both axes', () => {
    expect(isValidBoardDimension(MIN_BOARD_DIMENSION, 'rows')).toBe(true);
    expect(isValidBoardDimension(MAX_BOARD_ROWS, 'rows')).toBe(true);
    expect(isValidBoardDimension(MAX_BOARD_COLUMNS, 'columns')).toBe(true);
  });

  it('rejects values outside the axis range', () => {
    expect(isValidBoardDimension(MIN_BOARD_DIMENSION - 1, 'rows')).toBe(false);
    expect(isValidBoardDimension(MAX_BOARD_ROWS + 1, 'rows')).toBe(false);
    expect(isValidBoardDimension(MAX_BOARD_COLUMNS + 1, 'columns')).toBe(false);
    expect(isValidBoardDimension(2.5, 'columns')).toBe(false);
  });
});

describe('resizeGrid', () => {
  it('grows the grid with zeros and keeps overlapping digits', () => {
    const result = resizeGrid(grid, 4, 5);

    expect(result.success).toBe(true);
    expect(result.shrunk).toBe(false);
    expect(result.grid).toEqual([
      [1, 2, 3, 0, 0],
      [4, 5, 6, 0, 0],
      [7, 8, 9, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
  });

  it('shrinks the grid and reports the data loss', () => {
    const result = resizeGrid(grid, 2, 2);

    expect(result.success).toBe(true);
    expect(result.shrunk).toBe(true);
    expect(result.grid).toEqual([
      [1, 2],
      [4, 5],
    ]);
  });

  it('never mutates the source grid', () => {
    const before = grid.map((row) => [...row]);
    resizeGrid(grid, 4, 4);
    expect(grid).toEqual(before);
  });

  it('rejects dimensions outside the allowed range', () => {
    expect(resizeGrid(grid, 1, 3).success).toBe(false);
    expect(resizeGrid(grid, 3, MAX_BOARD_COLUMNS + 1).success).toBe(false);
  });

  it('rejects an invalid source grid', () => {
    expect(resizeGrid([[1, 2], [3]], 2, 2).success).toBe(false);
    expect(resizeGrid([[1, 10]], 2, 2).success).toBe(false);
  });
});
