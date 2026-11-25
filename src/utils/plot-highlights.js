/**
 * Plot highlight building
 *
 * Plotting a saved pick reuses the search engine: the saved digits are matched
 * against the board shown now, and every matching path is coloured the same
 * way a typed search colours its results. The saved coordinates remain a
 * separate outline supplied by `plotCells`; this module only builds the colour
 * layer, so the preview and the plotted board agree.
 */

import { searchCombinations } from '@/utils/combination-search';
import { buildSearchHighlights } from '@/utils/search-highlight-utils';

/**
 * Stable identity for a path, accepting both the stored `column` key and the
 * older `col` spelling. Used to find the saved path among the search results.
 *
 * @param {Array<{ row: number, column?: number, col?: number }>} path
 * @returns {string|null}
 */
function pathKey(path) {
  if (!Array.isArray(path)) return null;
  return path.map((cell) => `${cell?.row},${cell?.column ?? cell?.col}`).join('|');
}

/**
 * Find every path matching a plotted pick and build its search-style colours.
 *
 * The saved path is emphasised when it still matches the active board;
 * otherwise the first match is emphasised, just as a typed search does. When
 * nothing matches, `highlights` is null and only the saved outline remains.
 *
 * @param {number[][]} grid - the active board's grid
 * @param {string} digits - the saved combination
 * @param {Array<{ row: number, column?: number, col?: number }>} path - saved coordinates
 * @param {'light'|'dark'} mode
 * @returns {{
 *   results: Array<{ digits: string, path: Array<{row:number,column:number}> }>,
 *   activeIndex: number,
 *   highlights: Object|null
 * }}
 */
export function buildPlotHighlights(grid, digits, path, mode) {
  const results = searchCombinations(grid, digits);
  const savedKey = pathKey(path);
  const savedIndex = savedKey === null ? -1 : results.findIndex((result) => pathKey(result.path) === savedKey);
  const activeIndex = savedIndex >= 0 ? savedIndex : results.length > 0 ? 0 : -1;

  return {
    results,
    activeIndex,
    highlights: buildSearchHighlights(results, activeIndex, mode),
  };
}
