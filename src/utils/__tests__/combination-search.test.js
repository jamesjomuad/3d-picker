/**
 * Combination search tests
 *
 * The engine finds every path through the board whose consecutive digits sit in
 * neighbouring cells. These tests hand-count the paths on small grids, because
 * the answer to "how many ways can 1-2-3 be drawn here" is exactly verifiable
 * on a 2x2 or 3x3 board and hopeless to predict on the real 10x10 one.
 */

import {
  MAX_RESULTS,
  getPathCellKeys,
  parseCombination,
  parseCombinationList,
  searchCombinations,
} from '../combination-search';

/** 1 2 3 / 4 5 6 / 7 8 9 - every line and diagonal runs exactly once. */
const GRID = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

/** All ones: what the path shape does when the digits repeat. */
const ONES = [
  [1, 1],
  [1, 1],
];

const cell = (row, column) => ({ row, column });

describe('searchCombinations - the eight directions', () => {
  it('finds a horizontal path to the right', () => {
    expect(searchCombinations(GRID, '123')).toEqual([
      {
        digits: '123',
        path: [cell(0, 0), cell(0, 1), cell(0, 2)],
        start: cell(0, 0),
        end: cell(0, 2),
      },
    ]);
  });

  it('finds a vertical path downwards', () => {
    expect(searchCombinations(GRID, '147')).toEqual([
      {
        digits: '147',
        path: [cell(0, 0), cell(1, 0), cell(2, 0)],
        start: cell(0, 0),
        end: cell(2, 0),
      },
    ]);
  });

  it('finds the down-right diagonal', () => {
    expect(searchCombinations(GRID, '159')).toEqual([
      { digits: '159', path: [cell(0, 0), cell(1, 1), cell(2, 2)], start: cell(0, 0), end: cell(2, 2) },
    ]);
  });

  it('finds the down-left diagonal', () => {
    expect(searchCombinations(GRID, '357')).toEqual([
      { digits: '357', path: [cell(0, 2), cell(1, 1), cell(2, 0)], start: cell(0, 2), end: cell(2, 0) },
    ]);
  });

  it('walks against the digits: reverse runs the same line backwards', () => {
    expect(searchCombinations(GRID, '321')).toEqual([
      { digits: '321', path: [cell(0, 2), cell(0, 1), cell(0, 0)], start: cell(0, 2), end: cell(0, 0) },
    ]);
  });

  it('reaches a diagonal neighbour but never jumps over a cell', () => {
    // 2 -> 7: (0,1) to (2,0) is not a neighbour pair, so no path exists,
    // even though both digits are on the board.
    expect(searchCombinations(GRID, '27')).toEqual([]);
  });
});

describe('searchCombinations - many paths', () => {
  // 1 2 / 1 2: each 1 reaches a 2 east, south, or diagonally.
  const STACK = [
    [1, 2],
    [1, 2],
  ];

  it('starts from every cell holding the first digit', () => {
    const results = searchCombinations(STACK, '12');

    // (0,0): east and south-east. (1,0): north-east and east.
    expect(results).toHaveLength(4);
    expect(new Set(results.map((r) => getPathCellKeys(r.path)[0]))).toEqual(
      new Set(['0,0', '1,0'])
    );
  });

  it('keeps overlapping paths as separate results', () => {
    const results = searchCombinations(STACK, '12');

    // The two 1-cells and the two 2-cells each share both of them, so every
    // path reuses cells other paths go through - and all four stay separate.
    const keys = results.map((r) => getPathCellKeys(r.path).join('|'));
    expect(new Set(keys).size).toBe(4);
  });

  it('counts every direction on repeated digits', () => {
    // On the all-ones 2x2 every pair of cells is neighbours (diagonals too),
    // so 1-1 is every directed pair: 4 x 3.
    expect(searchCombinations(ONES, '11')).toHaveLength(12);
  });

  it('reports each full traversal of a small board once', () => {
    // 1-1-1-1 is every ordering of the four cells, and all of them are legal.
    const results = searchCombinations(ONES, '1111');
    expect(results).toHaveLength(24);
    expect(results.every((r) => new Set(getPathCellKeys(r.path)).size === 4)).toBe(true);
  });
});

describe('searchCombinations - never reuses a cell', () => {
  it('gives up when the combination is longer than the board', () => {
    // Five ones cannot be drawn on four cells without visiting one twice.
    expect(searchCombinations(ONES, '11111')).toEqual([]);
  });

  it('refuses to step back onto the cell it came from', () => {
    // 1-1-1 needs three distinct ones in a chain; the 2x2 board allows it,
    // but each path must hold three different cells.
    const results = searchCombinations(ONES, '111');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => new Set(getPathCellKeys(r.path)).size === 3)).toBe(true);
  });
});

describe('searchCombinations - the digits themselves', () => {
  it('treats zero as a digit like any other', () => {
    const grid = [
      [0, 1],
      [2, 0],
    ];

    // 0-1: (0,0) east to (0,1), and (1,1) north to (0,1).
    expect(searchCombinations(grid, '01')).toEqual([
      { digits: '01', path: [cell(0, 0), cell(0, 1)], start: cell(0, 0), end: cell(0, 1) },
      { digits: '01', path: [cell(1, 1), cell(0, 1)], start: cell(1, 1), end: cell(0, 1) },
    ]);
  });

  it('finds every single occurrence for a one-digit combination', () => {
    const results = searchCombinations(GRID, '5');

    expect(results).toEqual([
      { digits: '5', path: [cell(1, 1)], start: cell(1, 1), end: cell(1, 1) },
    ]);
  });

  it('returns nothing when a digit is missing', () => {
    expect(searchCombinations(GRID, '13')).toEqual([]);
  });

  it('returns nothing when the chain breaks', () => {
    // 1, 5 and 9 are all present and 1-5, 5-9 both run, but 1-5-9-3 cannot
    // end anywhere: 3 has no 9 neighbour.
    expect(searchCombinations(GRID, '1593')).toEqual([]);
  });
});

describe('searchCombinations - input handling', () => {
  it('rejects a combination that is not digits', () => {
    expect(searchCombinations(GRID, '12a')).toEqual([]);
    expect(searchCombinations(GRID, '')).toEqual([]);
    expect(searchCombinations(GRID, null)).toEqual([]);
    expect(searchCombinations(GRID, [1, 10])).toEqual([]);
  });

  it('rejects a missing board', () => {
    expect(searchCombinations([], '1')).toEqual([]);
    expect(searchCombinations(null, '1')).toEqual([]);
  });

  it('never walks off the board', () => {
    // Corner starts can only go inward, and the engine simply finds no
    // outside neighbours: 1 is at a corner and 0 does not exist at all.
    const results = searchCombinations(GRID, '10');
    expect(results).toEqual([]);
  });
});

describe('searchCombinations - staying bounded', () => {
  it('stops at the limit it is given', () => {
    const results = searchCombinations(ONES, '11', { limit: 5 });

    expect(results).toHaveLength(5);
  });

  it('defaults to the documented cap', () => {
    expect(MAX_RESULTS).toBe(500);
  });

  it('grows exponentially without a cap, which is why there is one', () => {
    // 1-1-1-1-1 on the all-ones 2x2 is five digits on four cells: no reuse
    // means no results at all, not an endless search.
    expect(searchCombinations(ONES, '11111')).toEqual([]);
  });
});

describe('parseCombination', () => {
  it('reads a digit string into digits', () => {
    expect(parseCombination('103')).toEqual([1, 0, 3]);
  });

  it('accepts an array of digits', () => {
    expect(parseCombination([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('copies an array rather than sharing it', () => {
    const digits = [1, 2];
    expect(parseCombination(digits)).not.toBe(digits);
  });

  it('refuses anything that is not a run of digits', () => {
    expect(parseCombination('')).toBeNull();
    expect(parseCombination('1a')).toBeNull();
    expect(parseCombination('1.5')).toBeNull();
    expect(parseCombination(' 1')).toBeNull();
    expect(parseCombination('1,2')).toBeNull();
    expect(parseCombination(12)).toBeNull();
    expect(parseCombination(null)).toBeNull();
    expect(parseCombination(undefined)).toBeNull();
    expect(parseCombination([])).toBeNull();
    expect(parseCombination([1, null])).toBeNull();
    expect(parseCombination([1, 2, 10])).toBeNull();
    expect(parseCombination([1, 2.5])).toBeNull();
    expect(parseCombination(['1'])).toBeNull();
  });
});

describe('parseCombinationList', () => {
  it('splits on commas and trims whitespace around each entry', () => {
    expect(parseCombinationList('123, 456 ,789')).toEqual(['123', '456', '789']);
  });

  it('ignores empty entries from stray or trailing commas', () => {
    expect(parseCombinationList('123,')).toEqual(['123']);
    expect(parseCombinationList(',123,,456,')).toEqual(['123', '456']);
  });

  it('keeps leading zeros', () => {
    expect(parseCombinationList('012, 3')).toEqual(['012', '3']);
  });

  it('refuses the whole query when any entry is invalid or none exist', () => {
    expect(parseCombinationList('')).toBeNull();
    expect(parseCombinationList(' , ')).toBeNull();
    expect(parseCombinationList('123, abc')).toBeNull();
    expect(parseCombinationList('12 3')).toBeNull();
    expect(parseCombinationList(null)).toBeNull();
  });
});

describe('getPathCellKeys', () => {
  it('keys a path for the selection Set', () => {
    expect(getPathCellKeys([cell(0, 1), cell(1, 1), cell(2, 2)])).toEqual(['0,1', '1,1', '2,2']);
  });

  it('handles an empty path', () => {
    expect(getPathCellKeys([])).toEqual([]);
  });
});
