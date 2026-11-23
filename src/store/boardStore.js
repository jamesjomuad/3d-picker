import { create } from 'zustand';

/**
 * Board selection store
 * Manages cell selection state for the Angle Board
 *
 * Selected cells are stored as a Set of "row,col" keys
 * for O(1) lookup during rendering
 */
export const useBoardStore = create((set, get) => ({
  /** @type {Set<string>} Selected cell keys as "row,col" */
  selectedCells: new Set(),

  /**
   * Toggle a cell's selection state
   * @param {number} row
   * @param {number} col
   */
  toggleCell: (row, col) => {
    const key = `${row},${col}`;
    const current = get().selectedCells;
    const next = new Set(current);

    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }

    set({ selectedCells: next });
  },

  /**
   * Select a single cell, deselecting all others
   * @param {number} row
   * @param {number} col
   */
  selectCell: (row, col) => {
    const key = `${row},${col}`;
    set({ selectedCells: new Set([key]) });
  },

  /**
   * Deselect all cells
   */
  clearSelection: () => {
    set({ selectedCells: new Set() });
  },

  /**
   * Get the count of selected cells
   * @returns {number}
   */
  getSelectionCount: () => {
    return get().selectedCells.size;
  },

  /**
   * Check if a cell is selected
   * @param {number} row
   * @param {number} col
   * @returns {boolean}
   */
  isCellSelected: (row, col) => {
    const key = `${row},${col}`;
    return get().selectedCells.has(key);
  },
}));
