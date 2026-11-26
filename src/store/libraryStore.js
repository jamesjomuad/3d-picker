import { create } from 'zustand';

import { loadLibrary, saveLibrary } from '@/services/board-storage';
import { createBoard } from '@/utils/board-factory';
import { isValidDigit, validateBoard } from '@/utils/board-validation';
import { resizeGrid as resizeGridData } from '@/utils/board-resize';

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
   * Resizes a board's grid, preserving overlapping digits.
   * Dimensions stay derived from the grid; nothing else is stored.
   *
   * @param {string} boardId
   * @param {number} rows
   * @param {number} columns
   * @returns {{ success: boolean, grid?: number[][], shrunk?: boolean, error?: string }}
   */
  resizeGrid: (boardId, rows, columns) => {
    const board = get().boards.find((b) => b.id === boardId);
    if (!board) return { success: false, error: 'Board not found' };

    const result = resizeGridData(board.grid, rows, columns);
    if (!result.success) return result;

    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId
          ? { ...b, grid: result.grid, updatedAt: new Date().toISOString() }
          : b
      ),
    }));
    get()._persist();
    return { success: true, grid: result.grid, shrunk: result.shrunk };
  },

  /**
   * Writes several cells of a board in one step, the way a drag-fill does.
   *
   * Takes the same map the board reports: "row,col" -> digit. The board is
   * copied, versioned and persisted once for the whole map, so filling a block
   * is one write, not one per cell.
   *
   * @param {string} boardId
   * @param {Object<string, number>} changes
   * @returns {{ success: boolean, error?: string }}
   */
  applyCells: (boardId, changes) => {
    const entries = Object.entries(changes ?? {});
    if (entries.length === 0) return { success: true };

    for (const [, value] of entries) {
      if (!isValidDigit(value)) {
        return { success: false, error: 'Cell value must be an integer 0-9' };
      }
    }

    set((state) => ({
      boards: state.boards.map((b) => {
        if (b.id !== boardId) return b;
        const newGrid = b.grid.map((r) => [...r]);
        for (const [key, value] of entries) {
          const [row, col] = key.split(',').map(Number);
          newGrid[row][col] = value;
        }
        return { ...b, grid: newGrid, updatedAt: new Date().toISOString() };
      }),
    }));
    get()._persist();
    return { success: true };
  },

  updateCell: (boardId, row, col, value) =>
    get().applyCells(boardId, { [`${row},${col}`]: value }),

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
   * @param {string} [name] - Name for the copy; defaults to "<source> (copy)"
   * @returns {Object|null} The new board, or null if not found
   */
  duplicateBoard: (boardId, name) => {
    const source = get().boards.find((b) => b.id === boardId);
    if (!source) return null;

    const copyName =
      typeof name === 'string' && name.trim() ? name.trim() : `${source.name} (copy)`;

    const created = createBoard({
      name: copyName,
      grid: source.grid.map((row) => [...row]),
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

  /**
   * Replaces cells across a board with persistence-first semantics.
   *
   * Unlike `applyCells` (which updates state optimistically), this copies the
   * grid, applies the changes, validates the result, persists the whole library
   * and only then commits the in-memory update. If the save fails, the state
   * is left untouched — UI and storage stay consistent.
   *
   * @param {string} boardId
   * @param {Object<string, number>} changes - "row,col" -> digit
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  replaceCells: async (boardId, changes) => {
    const entries = Object.entries(changes ?? {});
    if (entries.length === 0) return { success: true };

    for (const [, value] of entries) {
      if (!isValidDigit(value)) {
        return { success: false, error: 'Cell value must be an integer 0-9' };
      }
    }

    const source = get().boards.find((b) => b.id === boardId);
    if (!source) return { success: false, error: 'Board not found' };

    // Apply changes to a copy
    const newGrid = source.grid.map((row) => [...row]);
    for (const [key, value] of entries) {
      const [row, col] = key.split(',').map(Number);
      newGrid[row][col] = value;
    }

    // Validate the resulting grid before saving
    const validation = validateBoard({ name: 'test', grid: newGrid });
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const updatedBoard = { ...source, grid: newGrid, updatedAt: new Date().toISOString() };
    const newBoards = get().boards.map((b) => (b.id === boardId ? updatedBoard : b));

    // Persist first — only update state when it succeeds
    try {
      await saveLibrary({
        version: 1,
        activeBoardId: get().activeBoardId,
        boards: newBoards,
      });
    } catch (error) {
      console.error('Failed to save board:', error);
      return { success: false, error: 'Failed to save changes' };
    }

    set({ boards: newBoards });
    return { success: true };
  },

  /**
   * Applies a complete edited board with persistence-first semantics.
   * Identity and creation time come from the stored board, so JSON edits can
   * change only name, favorite state and grid data.
   *
   * @param {string} boardId
   * @param {Object} board - Validated board from the JSON editor
   * @returns {Promise<{ success: boolean, board?: Object, error?: string }>}
   */
  applyEditedBoard: async (boardId, board) => {
    if (!board || board.id !== boardId) {
      return { success: false, error: 'Board identity cannot change' };
    }
    if (typeof board.isFavorite !== 'boolean') {
      return { success: false, error: 'Board must have a valid favorite state' };
    }

    const validation = validateBoard(board);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const source = get().boards.find((b) => b.id === boardId);
    if (!source) return { success: false, error: 'Board not found' };

    const updatedBoard = {
      ...source,
      name: board.name,
      isFavorite: board.isFavorite,
      grid: board.grid.map((row) => [...row]),
      updatedAt: new Date().toISOString(),
    };
    const newBoards = get().boards.map((b) => (b.id === boardId ? updatedBoard : b));

    try {
      await saveLibrary({
        version: 1,
        activeBoardId: get().activeBoardId,
        boards: newBoards,
      });
    } catch (error) {
      console.error('Failed to save board:', error);
      return { success: false, error: 'Failed to save changes' };
    }

    set({ boards: newBoards });
    return { success: true, board: updatedBoard };
  },
}));
