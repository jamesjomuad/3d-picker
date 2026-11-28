/**
 * Fun Pick geometry generation
 *
 * Regression coverage for the exact selection that omitted the straight
 * vertical combinations 432 and 967. Generation must keep every valid walk:
 * straight continuations and 90-degree turns, in both traversal directions,
 * while never reusing a cell or duplicating a generated path.
 */

import boardData from '@/data/angle-board.json';

import {
  FUN_PICK_DIRECTIONS,
  applyFilters,
  createFilterSelection,
  generateCombinations,
} from '../fun-pick-utils';

const GRID = boardData.grid;

/** Exact board cells behind the reported selection: 4,9 / 3,6 / 2,7. */
const SELECTED_KEYS = ['0,7', '0,8', '1,7', '1,8', '2,7', '2,8'];

const selectionOf = (keys) => new Set(keys);

const generate = (keys = SELECTED_KEYS, direction = FUN_PICK_DIRECTIONS.all) =>
  generateCombinations(GRID, selectionOf(keys), { direction });

const digitsOf = (combinations) => combinations.map((item) => item.digits);

const filteredDigits = (filterValue) => {
  const filters = createFilterSelection();
  filters[filterValue] = true;
  return digitsOf(applyFilters(generate(), filters));
};

const pathKeysOf = (combination) =>
  combination.path.map((cell) => `${cell.row},${cell.column}`);

describe('Fun Pick straight and angle paths', () => {
  it('generates the reported missing combinations in All Directions', () => {
    expect(digitsOf(generate())).toEqual(expect.arrayContaining(['967', '432']));
  });

  it('generates reverse straight walks and the existing angle walks', () => {
    expect(digitsOf(generate())).toEqual(
      expect.arrayContaining(['967', '432', '769', '234', '496', '436'])
    );
  });

  it('classifies straight vertical walks by their direction family', () => {
    expect(filteredDigits('direction-orthogonal')).toEqual(
      expect.arrayContaining(['967', '432'])
    );
    expect(filteredDigits('direction-vertical')).toEqual(expect.arrayContaining(['967', '432']));
    expect(filteredDigits('direction-diagonal')).not.toEqual(
      expect.arrayContaining(['967', '432'])
    );
    expect(filteredDigits('direction-horizontal')).not.toEqual(
      expect.arrayContaining(['967', '432'])
    );
  });

  it('does not depend on selected-cell insertion order', () => {
    const forward = digitsOf(generate(SELECTED_KEYS));
    const reversed = digitsOf(generate([...SELECTED_KEYS].reverse()));

    expect(reversed).toHaveLength(forward.length);
    expect(new Set(reversed)).toEqual(new Set(forward));
  });

  it('does not duplicate a generated digit combination for this selection', () => {
    const digits = digitsOf(generate());

    expect(new Set(digits).size).toBe(digits.length);
  });

  it('never reuses a cell inside one combination', () => {
    for (const combination of generate()) {
      const keys = pathKeysOf(combination);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('Fun Pick straight continuation geometry', () => {
  const grid = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];
  const keys = grid.flatMap((row, rowIndex) =>
    row.map((_, colIndex) => `${rowIndex},${colIndex}`)
  );

  const generateGrid = (direction = FUN_PICK_DIRECTIONS.all) =>
    generateCombinations(grid, selectionOf(keys), { direction });

  it('generates straight diagonal and orthogonal walks in both directions', () => {
    expect(digitsOf(generateGrid())).toEqual(
      expect.arrayContaining(['159', '951', '357', '753', '123', '321', '147', '741'])
    );
  });

  it('keeps straight diagonal walks in Diagonal Only and out of Horizontal & Vertical', () => {
    expect(digitsOf(generateGrid(FUN_PICK_DIRECTIONS.diagonal))).toEqual(
      expect.arrayContaining(['159', '951', '357', '753'])
    );
    expect(digitsOf(generateGrid(FUN_PICK_DIRECTIONS.orthogonal))).not.toEqual(
      expect.arrayContaining(['159', '951', '357', '753'])
    );
  });
});
