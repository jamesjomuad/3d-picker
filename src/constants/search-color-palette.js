/**
 * Search result colour palette
 *
 * A fixed set of visually distinguishable colours, one per matching path,
 * assigned by result order (see `@/utils/search-highlight-utils`). Each entry
 * carries a light-mode and a dark-mode variant: the light colours are deep
 * enough for white text on a solid fill, the dark colours light enough for
 * near-black text, so an active path cell is readable in both themes.
 *
 * The palette lives here — not in the search engine, not in the cell
 * components — so the number of distinct colours, their hues and their theme
 * variants can change without touching any rendering or matching logic.
 */

export const SEARCH_COLOR_PALETTE = [
  { name: 'red', light: '#D93025', dark: '#FF8A80' },
  { name: 'orange', light: '#E8710A', dark: '#FFAB40' },
  { name: 'gold', light: '#9E7C00', dark: '#FFE082' },
  { name: 'green', light: '#1E8E3E', dark: '#A5D6A7' },
  { name: 'teal', light: '#00796B', dark: '#80CBC4' },
  { name: 'indigo', light: '#3949AB', dark: '#9FA8DA' },
  { name: 'purple', light: '#8E24AA', dark: '#CE93D8' },
  { name: 'pink', light: '#C2185B', dark: '#F48FB1' },
];

/** How many results get a colour of their own before the palette recycles. */
export const SEARCH_COLOR_COUNT = SEARCH_COLOR_PALETTE.length;

/**
 * The colour for a result index: deterministic by order, cycling back to the
 * start of the palette only once every colour has been assigned.
 *
 * @param {number} index - result index (zero-based)
 * @param {'light'|'dark'} mode
 * @returns {string} hex colour
 */
export function getSearchColor(index, mode) {
  const entry = SEARCH_COLOR_PALETTE[((index % SEARCH_COLOR_COUNT) + SEARCH_COLOR_COUNT) % SEARCH_COLOR_COUNT];
  return mode === 'dark' ? entry.dark : entry.light;
}

/**
 * Digit colour for a cell solid-filled with a search colour (the active path).
 * Light-mode palette colours are deep, so white digits; dark-mode ones are
 * pale, so near-black digits.
 *
 * @param {'light'|'dark'} mode
 * @returns {string} hex colour
 */
export function getSearchColorText(mode) {
  return mode === 'dark' ? '#111111' : '#FFFFFF';
}
