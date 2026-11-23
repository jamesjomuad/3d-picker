import { create } from 'zustand';

/**
 * Angle Board selection store
 *
 * Holds the one piece of board state more than one component needs at once: the
 * selected cells, as a Set of "row,col" keys so rendering can look a cell up in
 * constant time.
 *
 * It deliberately holds no logic. Deciding which cells a gesture means is the
 * selection engine's job (`@/utils/selection`); the board computes the set and
 * hands it over through `onSelectionChange`. That keeps
 * `@/components/angle-board` free of this store, so the same board can be
 * dropped into a screen that keeps selection somewhere else (or nowhere).
 */

/** @returns {Set<string>} */
const emptySelection = () => new Set();

export const useAngleBoardStore = create((set) => ({
  /** @type {Set<string>} Selected cell keys as "row,col" */
  selectedCells: emptySelection(),

  /**
   * Replace the selection with the given cells.
   * @param {Set<string>|string[]} cells
   */
  setSelection: (cells) => {
    // Copied, so the store owns its data even when a caller reuses the Set.
    set({ selectedCells: new Set(cells) });
  },

  /**
   * Deselect every cell.
   */
  clearSelection: () => {
    set({ selectedCells: emptySelection() });
  },
}));
