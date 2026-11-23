import {
  getCellReference,
  getColumnLetter,
  getPathReference,
  getRangeReference,
} from '@/utils/cell-reference';

describe('getColumnLetter', () => {
  it('maps the board columns to A–J', () => {
    expect(getColumnLetter(0)).toBe('A');
    expect(getColumnLetter(1)).toBe('B');
    expect(getColumnLetter(2)).toBe('C');
    expect(getColumnLetter(9)).toBe('J');
  });

  it('continues past Z with double letters', () => {
    expect(getColumnLetter(25)).toBe('Z');
    expect(getColumnLetter(26)).toBe('AA');
    expect(getColumnLetter(27)).toBe('AB');
    expect(getColumnLetter(51)).toBe('AZ');
    expect(getColumnLetter(52)).toBe('BA');
  });

  it('rejects indexes that are not columns', () => {
    expect(getColumnLetter(-1)).toBe('');
    expect(getColumnLetter(1.5)).toBe('');
    expect(getColumnLetter(undefined)).toBe('');
  });
});

describe('getCellReference', () => {
  it('uses a lettered column and a 1-based row', () => {
    expect(getCellReference(0, 0)).toBe('A1');
    expect(getCellReference(0, 2)).toBe('C1');
    expect(getCellReference(1, 0)).toBe('A2');
    expect(getCellReference(9, 9)).toBe('J10');
  });
});

describe('getRangeReference', () => {
  it('collapses to a single reference for one cell', () => {
    expect(getRangeReference(0, 0, 0, 0)).toBe('A1');
  });

  it('formats the documented range shapes', () => {
    // Horizontal run on one row.
    expect(getRangeReference(0, 0, 0, 3)).toBe('A1:D1');
    // Vertical run on one column.
    expect(getRangeReference(1, 1, 5, 1)).toBe('B2:B6');
    // Rectangle.
    expect(getRangeReference(1, 1, 4, 3)).toBe('B2:D5');
    // Entire row of a 10-column board.
    expect(getRangeReference(2, 0, 2, 9)).toBe('A3:J3');
    // Entire column of a 10-row board.
    expect(getRangeReference(0, 2, 9, 2)).toBe('C1:C10');
  });

  it('anchors on the top-left corner regardless of drag direction', () => {
    expect(getRangeReference(3, 3, 1, 1)).toBe(getRangeReference(1, 1, 3, 3));
    expect(getRangeReference(0, 3, 0, 0)).toBe('A1:D1');
  });
});

describe('getPathReference', () => {
  it('joins the cells of a path with arrows', () => {
    expect(
      getPathReference([
        { row: 0, column: 0 },
        { row: 1, column: 1 },
        { row: 2, column: 2 },
      ])
    ).toBe('A1 → B2 → C3');
  });

  it('is a single reference for a one-cell path', () => {
    expect(getPathReference([{ row: 3, column: 4 }])).toBe('E4');
  });

  it('accepts either column key spelling', () => {
    expect(getPathReference([{ row: 0, col: 1 }])).toBe('B1');
  });

  it('is empty for no cells', () => {
    expect(getPathReference([])).toBe('');
  });
});
