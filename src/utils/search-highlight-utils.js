/**
 * Search highlight building
 *
 * Turns the ordered results of `@/utils/combination-search` into the per-cell
 * colour data the Angle Board renders, keeping the palette rules (assignment
 * by result order, recycling only once exhausted) out of both the search
 * engine and the cell components.
 *
 * A cell can sit on several matching paths, so its entry keeps a list of
 * colours — one per distinct colour crossing it, in first-path order — and,
 * when the emphasised path crosses it, that path's solid colour on top.
 */

import { getSearchColor, getSearchColorText } from '@/constants/search-color-palette';

/**
 * Assign a colour to every result, deterministically by order: result i gets
 * palette colour `i % palette size`, so different paths differ until the
 * palette is exhausted and only then repeat.
 *
 * @param {number} count - number of results
 * @param {'light'|'dark'} mode
 * @returns {string[]} one colour per result, in result order
 */
export function assignResultColors(count, mode) {
  return Array.from({ length: count }, (_, index) => getSearchColor(index, mode));
}

/**
 * Build the board's highlight layer for a set of search results.
 *
 * @param {Array<{ path: Array<{ row: number, column: number }> }>} results
 *   search results, in result order
 * @param {number} activeIndex - the result the screen is emphasising
 * @param {'light'|'dark'} mode
 * @param {string[]} [colors] - one colour per result, in result order. Pass
 *   this when colours are grouped (e.g. every path of the same combination
 *   shares its colour); omitted, each result gets its own by order.
 * @returns {{ cells: Map<string, { colors: string[], activeColor: string|null }>, activeText: string }|null}
 *   `cells` maps "row,col" to its colour data (only crossed cells appear);
 *   `activeText` is the digit colour to use on a solid-filled active cell.
 *   Null when there are no results, so the board stays prop-free.
 */
export function buildSearchHighlights(results, activeIndex, mode, colors) {
  if (!Array.isArray(results) || results.length === 0) return null;

  const resultColors = colors ?? assignResultColors(results.length, mode);
  const cells = new Map();

  results.forEach((result, index) => {
    for (const cell of result.path) {
      const key = `${cell.row},${cell.column}`;
      let entry = cells.get(key);
      if (!entry) {
        entry = { colors: [], activeColor: null };
        cells.set(key, entry);
      }
      // Same colour twice (palette recycle, or siblings of one combination)
      // is still one segment.
      if (!entry.colors.includes(resultColors[index])) entry.colors.push(resultColors[index]);
    }
  });

  const active = results[activeIndex];
  if (active) {
    const activeColor = resultColors[activeIndex];
    for (const cell of active.path) {
      cells.get(`${cell.row},${cell.column}`).activeColor = activeColor;
    }
  }

  return { cells, activeText: getSearchColorText(mode) };
}
