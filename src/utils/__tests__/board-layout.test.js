import {
  DEFAULT_CELL_SIZE,
  HEADER_HEIGHT,
  HEADER_WIDTH,
  MAX_CELL_SIZE,
  MIN_CELL_SIZE,
  calculateCellSize,
  getBoardSize,
  getSelectionRect,
} from '../board-layout';

const drag = (startRow, startCol, endRow, endCol, mode) => ({
  startRow,
  startCol,
  endRow,
  endCol,
  mode,
});

describe('calculateCellSize', () => {
  it('fills the available width when the fit is inside the readable range', () => {
    expect(calculateCellSize(350, 10)).toBe(35);
    expect(calculateCellSize(369, 10)).toBe(36);
  });

  it('never shrinks a cell below the readable minimum', () => {
    expect(calculateCellSize(200, 10)).toBe(MIN_CELL_SIZE);
  });

  it('never grows past the maximum', () => {
    expect(calculateCellSize(900, 10)).toBe(MAX_CELL_SIZE);
  });

  it('falls back to the default size before it has been measured', () => {
    expect(calculateCellSize(0, 10)).toBe(DEFAULT_CELL_SIZE);
    expect(calculateCellSize(-HEADER_WIDTH, 10)).toBe(DEFAULT_CELL_SIZE);
    expect(calculateCellSize(350, 0)).toBe(DEFAULT_CELL_SIZE);
  });
});

describe('getBoardSize', () => {
  it('adds the header band to the cell area', () => {
    expect(getBoardSize(10, 10, 35)).toEqual({
      width: HEADER_WIDTH + 10 * 35,
      height: HEADER_HEIGHT + 10 * 35,
    });
  });
});

describe('getSelectionRect', () => {
  it('is null with no drag in progress', () => {
    expect(getSelectionRect(null, 35, 10, 10)).toBeNull();
  });

  it('maps a cell range below the header band', () => {
    expect(getSelectionRect(drag(0, 0, 1, 2, 'cell'), 35, 10, 10)).toEqual({
      top: HEADER_HEIGHT,
      left: HEADER_WIDTH,
      width: 3 * 35,
      height: 2 * 35,
    });
  });

  it('anchored the same way when dragged up-left', () => {
    const downRight = getSelectionRect(drag(1, 1, 4, 3, 'cell'), 35, 10, 10);
    const upLeft = getSelectionRect(drag(4, 3, 1, 1, 'cell'), 35, 10, 10);

    expect(upLeft).toEqual(downRight);
    expect(upLeft.top).toBe(HEADER_HEIGHT + 1 * 35);
    expect(upLeft.left).toBe(HEADER_WIDTH + 1 * 35);
  });

  it('spans the full width for a row drag', () => {
    expect(getSelectionRect(drag(2, 5, 3, 1, 'row'), 35, 10, 10)).toEqual({
      top: HEADER_HEIGHT + 2 * 35,
      left: HEADER_WIDTH,
      width: 10 * 35,
      height: 2 * 35,
    });
  });

  it('spans the full height for a column drag', () => {
    expect(getSelectionRect(drag(4, 3, 9, 6, 'col'), 35, 10, 10)).toEqual({
      top: HEADER_HEIGHT,
      left: HEADER_WIDTH + 3 * 35,
      width: 4 * 35,
      height: 10 * 35,
    });
  });
});
