import { create } from 'zustand';

import {
  calculateColSelection,
  calculateRectSelection,
  calculateRowSelection,
} from '@/utils/selection';

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
   * Select a single cell, deselecting all others
   * @param {number} row
   * @param {number} col
   */
  selectCell: (row, col) => {
    const key = `${row},${col}`;
    set({ selectedCells: new Set([key]) });
  },

  /**
   * Select a rectangular range of cells, replacing current selection
   * @param {number} startRow
   * @param {number} startCol
   * @param {number} endRow
   * @param {number} endCol
   * @param {number} totalRows
   * @param {number} totalCols
   */
  selectRect: (startRow, startCol, endRow, endCol, totalRows, totalCols) => {
    const cells = calculateRectSelection(startRow, startCol, endRow, endCol, totalRows, totalCols);
    set({ selectedCells: cells });
  },

  /**
   * Select a range of rows (all columns), replacing current selection
   * @param {number} startRow
   * @param {number} endRow
   * @param {number} totalRows
   * @param {number} totalCols
   */
  selectRows: (startRow, endRow, totalRows, totalCols) => {
    const cells = calculateRowSelection(startRow, endRow, totalRows, totalCols);
    set({ selectedCells: cells });
  },

  /**
   * Select a range of columns (all rows), replacing current selection
   * @param {number} startCol
   * @param {number} endCol
   * @param {number} totalRows
   * @param {number} totalCols
   */
  selectCols: (startCol, endCol, totalRows, totalCols) => {
    const cells = calculateColSelection(startCol, endCol, totalRows, totalCols);
    set({ selectedCells: cells });
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
