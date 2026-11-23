import { create } from 'zustand';

import { loadLibrary, saveLibrary } from '@/services/board-storage';
import { createBoard } from '@/utils/board-factory';
import { validateBoard } from '@/utils/board-validation';

/**
 * Board library store
 * Manages the collection of Angle Boards, active board, and persistence
 */
export const useLibraryStore = create((set, get) => ({
  /** @type {Object[]} All boards in the library */
  boards: [],

  /** @type {string|null} ID of the currently active board */
  activeBoardId: null,

  /** @type {boolean} Whether the library has been loaded from storage */
  isLoaded: false,

  /** @type {boolean} Whether a save operation is in progress */
  isSaving: false,

  /**
   * Loads the board library from storage
   * @returns {Promise<void>}
   */
  loadLibrary: async () => {
    try {
      const library = await loadLibrary();
      set({
        boards: library.boards,
        activeBoardId: library.activeBoardId,
        isLoaded: true,
      });
    } catch (error) {
      console.error('Failed to load library:', error);
      set({ isLoaded: true });
    }
  },

  /**
   * Persists the current state to storage
   * @returns {Promise<void>}
   */
  _persist: async () => {
    const { boards, activeBoardId } = get();
    set({ isSaving: true });
    try {
      await saveLibrary({
        version: 1,
        activeBoardId,
        boards,
      });
    } finally {
      set({ isSaving: false });
    }
  },

  /**
   * Gets the currently active board object
   * @returns {Object|null}
   */
  getActiveBoard: () => {
    const { boards, activeBoardId } = get();
    return boards.find((b) => b.id === activeBoardId) || boards[0] || null;
  },

  /**
   * Sets the active board by ID
   * @param {string} boardId
   */
  setActiveBoard: (boardId) => {
    set({ activeBoardId: boardId });
    get()._persist();
  },

  /**
   * Creates a new board and adds it to the library
   * @param {Object} [options]
   * @param {string} [options.name] - Board name
   * @param {number[][]} [options.grid] - Grid data
   * @returns {Object} The new board
   */
  createBoard: (options) => {
    const newBoard = createBoard(options);
    set((state) => ({
      boards: [...state.boards, newBoard],
      activeBoardId: state.activeBoardId || newBoard.id,
    }));
    get()._persist();
    return newBoard;
  },

  /**
   * Renames a board
   * @param {string} boardId
   * @param {string} newName
   */
  renameBoard: (boardId, newName) => {
    if (!newName || typeof newName !== 'string' || !newName.trim()) return;
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId
          ? { ...b, name: newName.trim(), updatedAt: new Date().toISOString() }
          : b
      ),
    }));
    get()._persist();
  },

  /**
   * Updates a board's grid
   * @param {string} boardId
   * @param {number[][]} newGrid
   * @returns {{ success: boolean, error?: string }}
   */
  updateGrid: (boardId, newGrid) => {
    const testBoard = { name: 'test', grid: newGrid };
    const validation = validateBoard(testBoard);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId
          ? { ...b, grid: newGrid.map((row) => [...row]), updatedAt: new Date().toISOString() }
          : b
      ),
    }));
    get()._persist();
    return { success: true };
  },

  /**
   * Updates a single cell in a board's grid
   * @param {string} boardId
   * @param {number} row
   * @param {number} col
   * @param {number} value
   * @returns {{ success: boolean, error?: string }}
   */
  updateCell: (boardId, row, col, value) => {
    if (!Number.isInteger(value) || value < 0 || value > 9) {
      return { success: false, error: 'Cell value must be an integer 0-9' };
    }

    set((state) => ({
      boards: state.boards.map((b) => {
        if (b.id !== boardId) return b;
        const newGrid = b.grid.map((r) => [...r]);
        newGrid[row][col] = value;
        return { ...b, grid: newGrid, updatedAt: new Date().toISOString() };
      }),
    }));
    get()._persist();
    return { success: true };
  },

  /**
   * Toggles a board's favorite status
   * @param {string} boardId
   */
  toggleFavorite: (boardId) => {
    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId
          ? { ...b, isFavorite: !b.isFavorite, updatedAt: new Date().toISOString() }
          : b
      ),
    }));
    get()._persist();
  },

  /**
   * Duplicates a board with a new ID and name
   * @param {string} boardId
   * @returns {Object|null} The new board, or null if not found
   */
  duplicateBoard: (boardId) => {
    const source = get().boards.find((b) => b.id === boardId);
    if (!source) return null;

    const now = new Date().toISOString();
    const newBoard = {
      id: undefined, // will be set by createBoard
      name: `${source.name} (copy)`,
      isFavorite: false,
      grid: source.grid.map((row) => [...row]),
      createdAt: now,
      updatedAt: now,
    };

    const created = createBoard({
      name: newBoard.name,
      grid: newBoard.grid,
    });

    set((state) => ({
      boards: [...state.boards, created],
    }));
    get()._persist();
    return created;
  },

  /**
   * Deletes a board
   * Prevents deletion of the last board — creates a replacement if needed
   * @param {string} boardId
   */
  deleteBoard: (boardId) => {
    const state = get();
    const remaining = state.boards.filter((b) => b.id !== boardId);

    if (remaining.length === 0) {
      // Last board — create a replacement instead of deleting
      const replacement = createBoard({ name: 'Angle Board 001' });
      set({
        boards: [replacement],
        activeBoardId: replacement.id,
      });
    } else {
      const wasActive = state.activeBoardId === boardId;
      set({
        boards: remaining,
        activeBoardId: wasActive ? remaining[0].id : state.activeBoardId,
      });
    }
    get()._persist();
  },

  /**
   * Gets boards filtered by favorite status
   * @param {'all' | 'favorites'} filter
   * @returns {Object[]}
   */
  getFilteredBoards: (filter) => {
    const { boards } = get();
    if (filter === 'favorites') {
      return boards.filter((b) => b.isFavorite);
    }
    return boards;
  },
}));
