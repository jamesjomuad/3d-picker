import {
  SEARCH_COLOR_COUNT,
  SEARCH_COLOR_PALETTE,
  getSearchColor,
  getSearchColorText,
} from '@/constants/search-color-palette';
import { assignResultColors, buildSearchHighlights } from '@/utils/search-highlight-utils';

const path = (...cells) => ({ path: cells.map(([row, column]) => ({ row, column })) });

describe('search colour palette', () => {
  it('offers several distinct colours per theme', () => {
    expect(SEARCH_COLOR_COUNT).toBeGreaterThanOrEqual(6);
    const light = SEARCH_COLOR_PALETTE.map((entry) => entry.light);
    const dark = SEARCH_COLOR_PALETTE.map((entry) => entry.dark);
    expect(new Set(light).size).toBe(light.length);
    expect(new Set(dark).size).toBe(dark.length);
  });

  it('assigns colours deterministically by order and recycles after the palette', () => {
    expect(getSearchColor(0, 'light')).toBe(getSearchColor(0, 'light'));
    expect(getSearchColor(SEARCH_COLOR_COUNT, 'light')).toBe(getSearchColor(0, 'light'));
    expect(getSearchColor(SEARCH_COLOR_COUNT + 1, 'dark')).toBe(getSearchColor(1, 'dark'));
  });

  it('wraps negative indexes into the palette instead of throwing', () => {
    expect(getSearchColor(-1, 'light')).toBe(getSearchColor(SEARCH_COLOR_COUNT - 1, 'light'));
  });

  it('picks a legible digit colour per theme', () => {
    expect(getSearchColorText('light')).not.toBe(getSearchColorText('dark'));
  });
});

describe('assignResultColors', () => {
  it('gives one colour per result, distinct until exhaustion', () => {
    const colors = assignResultColors(SEARCH_COLOR_COUNT, 'light');
    expect(colors).toHaveLength(SEARCH_COLOR_COUNT);
    expect(new Set(colors).size).toBe(SEARCH_COLOR_COUNT);

    const recycled = assignResultColors(SEARCH_COLOR_COUNT + 2, 'light');
    expect(recycled[SEARCH_COLOR_COUNT]).toBe(recycled[0]);
    expect(recycled[SEARCH_COLOR_COUNT + 1]).toBe(recycled[1]);
  });
});

describe('buildSearchHighlights', () => {
  it('returns null without results so the board stays prop-free', () => {
    expect(buildSearchHighlights([], 0, 'light')).toBeNull();
    expect(buildSearchHighlights(null, 0, 'light')).toBeNull();
  });

  it('gives every cell of a path that path colour', () => {
    const highlights = buildSearchHighlights([path([0, 0], [1, 1])], 0, 'light');
    const first = getSearchColor(0, 'light');

    expect([...highlights.cells.keys()]).toEqual(['0,0', '1,1']);
    for (const entry of highlights.cells.values()) {
      expect(entry.colors).toEqual([first]);
      expect(entry.activeColor).toBe(first);
    }
    expect(highlights.activeText).toBe(getSearchColorText('light'));
  });

  it('keeps both identities on cells shared by overlapping paths', () => {
    // Two paths crossing at 1,1.
    const results = [path([0, 0], [1, 1], [2, 2]), path([3, 3], [1, 1], [4, 4])];
    const highlights = buildSearchHighlights(results, 0, 'light');
    const [colorA, colorB] = assignResultColors(2, 'light');

    expect(highlights.cells.get('1,1').colors).toEqual([colorA, colorB]);
    expect(highlights.cells.get('0,0').colors).toEqual([colorA]);
    expect(highlights.cells.get('3,3').colors).toEqual([colorB]);
  });

  it('solid-fills only the active path, leaving the others as segments', () => {
    const results = [path([0, 0]), path([9, 9])];
    const highlights = buildSearchHighlights(results, 1, 'light');
    const [, colorB] = assignResultColors(2, 'light');

    expect(highlights.cells.get('0,0').activeColor).toBeNull();
    expect(highlights.cells.get('9,9').activeColor).toBe(colorB);
  });

  it('marks a shared cell active when the emphasised path crosses it', () => {
    const results = [path([0, 0], [1, 1]), path([1, 1], [2, 2])];
    const highlights = buildSearchHighlights(results, 1, 'light');
    const [, colorB] = assignResultColors(2, 'light');

    const shared = highlights.cells.get('1,1');
    expect(shared.colors).toHaveLength(2);
    expect(shared.activeColor).toBe(colorB);
  });

  it('collapses recycled identical colours into one segment', () => {
    // Results 0 and SEARCH_COLOR_COUNT share a colour; a cell on both is one colour.
    const results = Array.from({ length: SEARCH_COLOR_COUNT + 1 }, (_, i) =>
      i === SEARCH_COLOR_COUNT ? path([0, 0], [5, 5]) : path([i, 0], [i, 9])
    );
    const highlights = buildSearchHighlights(results, -1, 'light');

    expect(highlights.cells.get('0,0').colors).toHaveLength(1);
    const shared = highlights.cells.get('5,5');
    expect(shared.colors).toEqual([getSearchColor(0, 'light')]);
    expect(shared.activeColor).toBeNull();
  });

  it('recolours for the dark theme', () => {
    const highlights = buildSearchHighlights([path([0, 0])], 0, 'dark');
    expect(highlights.cells.get('0,0').colors).toEqual([getSearchColor(0, 'dark')]);
    expect(highlights.activeText).toBe(getSearchColorText('dark'));
  });
});
