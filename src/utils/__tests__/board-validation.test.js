import {
  isValidDigit,
  parseDigit,
  validateBoard,
  validateGrid,
} from '../board-validation';

const grid = [
  [6, 0, 3],
  [4, 2, 7],
];

describe('isValidDigit', () => {
  it('accepts every digit, including zero', () => {
    for (let digit = 0; digit <= 9; digit++) {
      expect(isValidDigit(digit)).toBe(true);
    }
  });

  it('rejects anything outside a single decimal digit', () => {
    expect(isValidDigit(-1)).toBe(false);
    expect(isValidDigit(10)).toBe(false);
    expect(isValidDigit(1.5)).toBe(false);
    expect(isValidDigit('6')).toBe(false);
    expect(isValidDigit(null)).toBe(false);
    expect(isValidDigit(undefined)).toBe(false);
  });
});

describe('parseDigit', () => {
  it('turns one typed character into a number', () => {
    expect(parseDigit('0')).toBe(0);
    expect(parseDigit('7')).toBe(7);
  });

  it('returns null for input that is not a single digit', () => {
    expect(parseDigit('')).toBeNull();
    expect(parseDigit('12')).toBeNull();
    expect(parseDigit('a')).toBeNull();
    expect(parseDigit('-')).toBeNull();
    expect(parseDigit(null)).toBeNull();
    expect(parseDigit(7)).toBeNull();
  });
});

describe('validateGrid', () => {
  it('accepts a rectangular grid of digits', () => {
    expect(validateGrid(grid)).toEqual({ valid: true });
  });

  it('rejects a missing or empty grid', () => {
    expect(validateGrid(null)).toEqual({ valid: false, error: 'Board grid must be an array' });
    expect(validateGrid([])).toEqual({ valid: false, error: 'Board grid cannot be empty' });
  });

  it('rejects a row that is not an array', () => {
    expect(validateGrid([[1, 2], '34'])).toEqual({
      valid: false,
      error: 'Row 1 must be an array',
    });
  });

  it('rejects a ragged grid', () => {
    expect(validateGrid([[1, 2, 3], [4, 5]])).toEqual({
      valid: false,
      error: 'Row 1 has 2 columns, expected 3',
    });
  });

  it('rejects a cell that is not a digit', () => {
    expect(validateGrid([[1, 2], [3, 10]])).toEqual({
      valid: false,
      error: 'Cell [1][1] must be an integer 0-9, got 10',
    });
  });
});

describe('validateBoard', () => {
  it('accepts a named board with a valid grid', () => {
    expect(validateBoard({ name: 'Angle Board 001', grid })).toEqual({ valid: true });
  });

  it('rejects anything that is not a board object', () => {
    expect(validateBoard(null)).toEqual({ valid: false, error: 'Board must be an object' });
    expect(validateBoard('board')).toEqual({ valid: false, error: 'Board must be an object' });
  });

  it('requires a name', () => {
    expect(validateBoard({ grid })).toEqual({
      valid: false,
      error: 'Board must have a name string',
    });
    expect(validateBoard({ name: '', grid })).toEqual({
      valid: false,
      error: 'Board must have a name string',
    });
  });

  it('delegates the shape rules to the grid validator', () => {
    expect(validateBoard({ name: 'Broken', grid: [[1, 2], [3]] })).toEqual({
      valid: false,
      error: 'Row 1 has 1 columns, expected 2',
    });
  });
});
