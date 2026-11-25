/**
 * Tests for plot highlights — plotting reuses combination search so every
 * matching path lights up, with the saved path emphasised when it still fits.
 */

import { getSearchColor, getSearchColorText } from '@/constants/search-color-palette';
import { buildPlotHighlights } from '@/utils/plot-highlights';

const GRID = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

/** All ones: several paths cross the same cells, so overlays are testable. */
const ONES = [
  [1, 1],
  [1, 1],
];

const cell = (row, column) => ({ row, column });

describe('buildPlotHighlights', () => {
  it('finds the saved path and colours every cell of it like search', () => {
    const savedPath = [cell(0, 0), cell(0, 1), cell(0, 2)];
    const result = buildPlotHighlights(GRID, '123', savedPath, 'light');

    expect(result.results).toHaveLength(1);
    expect(result.activeIndex).toBe(0);
    expect([...result.highlights.cells.keys()]).toEqual(['0,0', '0,1', '0,2']);
    expect(result.highlights.cells.get('0,0').colors).toEqual([getSearchColor(0, 'light')]);
    expect(result.highlights.cells.get('0,0').activeColor).toBe(getSearchColor(0, 'light'));
    expect(result.highlights.activeText).toBe(getSearchColorText('light'));
  });

  it('highlights every matching path, not just the saved one', () => {
    const result = buildPlotHighlights(ONES, '11', [cell(0, 0), cell(0, 1)], 'light');

    expect(result.results.length).toBeGreaterThan(1);
    const shared = result.highlights.cells.get('0,0');
    expect(shared.colors.length).toBeGreaterThan(1);
    expect(shared.activeColor).toBe(getSearchColor(result.activeIndex, 'light'));
  });

  it('accepts the older col spelling in saved coordinates', () => {
    const savedPath = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ];
    expect(buildPlotHighlights(GRID, '123', savedPath, 'light').activeIndex).toBe(0);
  });

  it('emphasises the first match when the saved path no longer matches', () => {
    const result = buildPlotHighlights(ONES, '11', [cell(9, 9), cell(8, 8)], 'dark');

    expect(result.activeIndex).toBe(0);
    expect(result.highlights.cells.get('0,0').activeColor).toBe(getSearchColor(0, 'dark'));
  });

  it('returns no colour layer when the digits have no match', () => {
    const result = buildPlotHighlights(GRID, '99', [cell(0, 0)], 'light');

    expect(result.results).toEqual([]);
    expect(result.activeIndex).toBe(-1);
    expect(result.highlights).toBeNull();
  });

  it('never mutates the grid, digits or saved path', () => {
    const gridCopy = GRID.map((row) => [...row]);
    const pathCopy = [cell(0, 0), cell(1, 1)];
    buildPlotHighlights(gridCopy, '15', pathCopy, 'light');

    expect(gridCopy).toEqual(GRID);
    expect(pathCopy).toEqual([cell(0, 0), cell(1, 1)]);
  });
});
