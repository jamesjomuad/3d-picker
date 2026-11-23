import { computeReplace, countMatches } from '../board-replace';

/**
 * 4x3 grid with known digit distribution for deterministic assertions:
 *   6 0 3
 *   4 2 7
 *   1 8 9
 *   5 5 5
 *
 * Digit counts: 5 appears 3 times, 0 appears once, 3 once, 4 once, etc.
 */
const GRID = [
  [6, 0, 3],
  [4, 2, 7],
  [1, 8, 9],
  [5, 5, 5],
];

describe('countMatches', () => {
  it('counts a digit that appears once', () => {
    expect(countMatches(GRID, 3)).toBe(1);
  });

  it('counts a digit that appears multiple times', () => {
    expect(countMatches(GRID, 5)).toBe(3);
  });

  it('counts digit 0 correctly', () => {
    expect(countMatches(GRID, 0)).toBe(1);
  });

  it('returns 0 when no cells match', () => {
    // 0–9 minus {0,1,2,3,4,5,6,7,8,9} — every digit is present except none
    // But the grid has 12 cells covering 0-9. Let's build a grid with no 7:
    const noSeven = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    expect(countMatches(noSeven, 7)).toBe(0);
  });

  it('returns 0 for an invalid digit', () => {
    expect(countMatches(GRID, 10)).toBe(0);
    expect(countMatches(GRID, -1)).toBe(0);
  });

  it('returns 0 for a null or empty grid', () => {
    expect(countMatches(null, 5)).toBe(0);
    expect(countMatches([], 5)).toBe(0);
  });
});

describe('computeReplace', () => {
  it('replaces one occurrence', () => {
    const result = computeReplace(GRID, 3, 8);
    expect(result.count).toBe(1);
    expect(result.changes).toEqual({ '0,2': 8 });
  });

  it('replaces multiple occurrences', () => {
    const result = computeReplace(GRID, 5, 9);
    expect(result.count).toBe(3);
    expect(result.changes).toEqual({
      '3,0': 9,
      '3,1': 9,
      '3,2': 9,
    });
  });

  it('replaces all 100 cells in a uniform 10×10 grid', () => {
    const uniform = Array.from({ length: 10 }, () => Array(10).fill(7));
    const result = computeReplace(uniform, 7, 2);
    expect(result.count).toBe(100);
    expect(Object.keys(result.changes).length).toBe(100);
    for (const value of Object.values(result.changes)) {
      expect(value).toBe(2);
    }
  });

  it('replaces digit 0 correctly', () => {
    const result = computeReplace(GRID, 0, 5);
    expect(result.count).toBe(1);
    expect(result.changes).toEqual({ '0,1': 5 });
  });

  it('returns empty changes when no cells match', () => {
    // A grid that has no 2s
    const noTwo = [
      [1, 3, 5],
      [7, 9, 0],
    ];
    const result = computeReplace(noTwo, 2, 8);
    expect(result.count).toBe(0);
    expect(result.changes).toEqual({});
  });

  it('returns empty when find and replace digits are identical', () => {
    const result = computeReplace(GRID, 5, 5);
    expect(result.count).toBe(0);
    expect(result.changes).toEqual({});
  });

  it('preserves all non-matching cells (changes map only has matching keys)', () => {
    const result = computeReplace(GRID, 5, 0);
    const changedKeys = Object.keys(result.changes);
    expect(changedKeys).toEqual(['3,0', '3,1', '3,2']);
    // No other cells are reported as changed
    expect(changedKeys).not.toContain('0,0');
    expect(changedKeys).not.toContain('0,1');
  });

  it('does not mutate the original grid', () => {
    const before = GRID.map((row) => [...row]);
    computeReplace(GRID, 5, 0);
    expect(GRID).toEqual(before);
  });

  it('reports the correct count even for dense grids', () => {
    const dense = Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 10 }, (_, c) => (r + c) % 10)
    );
    // Each digit 0-9 appears exactly 10 times in a 10×10 grid where cell = (r+c)%10
    const result = computeReplace(dense, 3, 7);
    expect(result.count).toBe(10);
  });

  it('handles invalid digits gracefully', () => {
    expect(computeReplace(GRID, 10, 5)).toEqual({ count: 0, changes: {} });
    expect(computeReplace(GRID, 5, 10)).toEqual({ count: 0, changes: {} });
    expect(computeReplace(null, 5, 3)).toEqual({ count: 0, changes: {} });
  });
});
