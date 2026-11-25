/**
 * Tests for plotting a saved basket pick onto the active board
 */

import {
  PLOT_PARAM,
  parsePlotRequest,
  serializePlotRequest,
  validatePlotRequest,
} from '@/utils/plot-combination';

const grid = [
  [6, 0, 3],
  [4, 2, 7],
  [1, 8, 9],
];

const entry = {
  digits: '073',
  path: [
    { row: 0, column: 1 },
    { row: 1, column: 2 },
    { row: 2, column: 0 },
  ],
  addedAt: '2026-11-23T20:35:00.000Z',
};

describe('plot request transport', () => {
  it('serialises only the fields needed to plot', () => {
    expect(JSON.parse(serializePlotRequest(entry))).toEqual({
      digits: entry.digits,
      path: entry.path,
    });
  });

  it('uses a reserved-free query param name', () => {
    expect(PLOT_PARAM).toBe('plot');
  });

  it('parses a valid request and rejects junk without throwing', () => {
    expect(parsePlotRequest(serializePlotRequest(entry))).toEqual({
      digits: entry.digits,
      path: entry.path,
    });
    expect(parsePlotRequest('{not json')).toBeNull();
    expect(parsePlotRequest('')).toBeNull();
    expect(parsePlotRequest(['073'])).toBeNull();
  });
});

describe('validatePlotRequest', () => {
  it('accepts valid in-bounds coordinates and derives cell keys', () => {
    const result = validatePlotRequest(entry, grid);
    expect(result.valid).toBe(true);
    expect(result.digits).toBe('073');
    expect([...result.cells]).toEqual(['0,1', '1,2', '2,0']);
  });

  it('accepts the col fallback used by older stored paths', () => {
    const result = validatePlotRequest(
      { digits: '42', path: [{ row: 0, col: 0 }, { row: 2, col: 2 }] },
      grid
    );
    expect(result.valid).toBe(true);
    expect([...result.cells]).toEqual(['0,0', '2,2']);
  });

  it('rejects a missing or malformed request', () => {
    expect(validatePlotRequest(null, grid).error).toBe('The saved pick could not be read.');
    expect(validatePlotRequest({ digits: '', path: [] }, grid).error).toBe(
      'The saved pick has no valid digits.'
    );
    expect(validatePlotRequest({ digits: '07a', path: entry.path }, grid).error).toBe(
      'The saved pick has no valid digits.'
    );
    expect(validatePlotRequest({ digits: '073', path: [] }, grid).error).toBe(
      'The saved pick has no stored cells.'
    );
  });

  it('rejects a digit/cell length mismatch', () => {
    const result = validatePlotRequest({ digits: '07', path: entry.path }, grid);
    expect(result.error).toBe('The saved pick has a different number of digits and cells.');
  });

  it('rejects missing, empty and ragged grids', () => {
    expect(validatePlotRequest(entry, null).error).toBe('No active board is available.');
    expect(validatePlotRequest(entry, []).error).toBe('No active board is available.');
    expect(validatePlotRequest(entry, [[]]).error).toBe('The active board has no cells.');
    expect(validatePlotRequest(entry, [[1, 2], [3]]).error).toBe(
      'The active board grid is not rectangular.'
    );
  });

  it('rejects invalid and out-of-bounds coordinates', () => {
    expect(validatePlotRequest({ digits: '7', path: [null] }, grid).error).toBe(
      'The saved pick has an invalid cell.'
    );
    expect(validatePlotRequest({ digits: '7', path: [{ row: 0.5, column: 1 }] }, grid).error).toBe(
      'The saved pick has an invalid cell coordinate.'
    );
    expect(validatePlotRequest({ digits: '7', path: [{ row: 3, column: 0 }] }, grid).error).toBe(
      'Some saved cells are outside the active board.'
    );
    expect(validatePlotRequest({ digits: '7', path: [{ row: 0, column: -1 }] }, grid).error).toBe(
      'Some saved cells are outside the active board.'
    );
  });

  it('rejects invalid active-board cell values', () => {
    const brokenGrid = [
      [0, null, 3],
      [4, 2, 7],
      [1, 8, 9],
    ];
    const result = validatePlotRequest({ digits: '7', path: [{ row: 0, column: 1 }] }, brokenGrid);
    expect(result.error).toBe('The active board has an invalid cell value.');
  });

  it('never mutates the request, path or grid', () => {
    const request = { digits: entry.digits, path: entry.path.map((cell) => ({ ...cell })) };
    const gridCopy = grid.map((row) => [...row]);
    validatePlotRequest(request, gridCopy);
    expect(request).toEqual({ digits: entry.digits, path: entry.path });
    expect(gridCopy).toEqual(grid);
  });

  it('does not require saved digits to match the active grid (preview only)', () => {
    // grid[0][1] is 0 but the saved digit at that cell could be anything;
    // plotting highlights coordinates and never writes digits.
    const result = validatePlotRequest({ digits: '9', path: [{ row: 0, column: 1 }] }, grid);
    expect(result.valid).toBe(true);
  });
});
