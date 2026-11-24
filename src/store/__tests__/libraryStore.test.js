/**
 * Tests for the board library store
 */

import { useLibraryStore } from '@/store/libraryStore';

// Mock the board-storage service
let mockStoredLibrary = null;
jest.mock('@/services/board-storage', () => ({
  loadLibrary: jest.fn(async () => {
    if (mockStoredLibrary) return mockStoredLibrary;
    // Return a default library with one board
    return {
      version: 1,
      activeBoardId: 'board-default',
      boards: [
        {
          id: 'board-default',
          name: 'Angle Board 001',
          isFavorite: false,
          grid: Array.from({ length: 10 }, (_, r) =>
            Array.from({ length: 10 }, (_, c) => (r * 10 + c) % 10)
          ),
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    };
  }),
  saveLibrary: jest.fn(async (library) => {
    mockStoredLibrary = library;
  }),
  clearLibrary: jest.fn(async () => {
    mockStoredLibrary = null;
  }),
}));

/** Helper to reset the store to initial state */
function resetStore() {
  useLibraryStore.setState({
    boards: [],
    activeBoardId: null,
    isLoaded: false,
    isSaving: false,
  });
  mockStoredLibrary = null;
}

beforeEach(() => {
  resetStore();
  jest.clearAllMocks();
});

describe('loadLibrary', () => {
  it('loads from storage when data exists', async () => {
    const existing = {
      version: 1,
      activeBoardId: 'board-1',
      boards: [
        {
          id: 'board-1',
          name: 'Test Board',
          isFavorite: false,
          grid: Array.from({ length: 10 }, () => Array(10).fill(0)),
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    };
    mockStoredLibrary = existing;

    await useLibraryStore.getState().loadLibrary();

    const state = useLibraryStore.getState();
    expect(state.isLoaded).toBe(true);
    expect(state.boards.length).toBe(1);
    expect(state.boards[0].name).toBe('Test Board');
    expect(state.activeBoardId).toBe('board-1');
  });

  it('creates default library when no data exists', async () => {
    mockStoredLibrary = null;
    await useLibraryStore.getState().loadLibrary();

    const state = useLibraryStore.getState();
    expect(state.isLoaded).toBe(true);
    expect(state.boards.length).toBeGreaterThanOrEqual(1);
    expect(state.activeBoardId).toBeTruthy();
  });
});

describe('createBoard', () => {
  beforeEach(async () => {
    await useLibraryStore.getState().loadLibrary();
  });

  it('creates a new board with default values', () => {
    const initialCount = useLibraryStore.getState().boards.length;
    const newBoard = useLibraryStore.getState().createBoard();

    expect(newBoard.id).toBeTruthy();
    expect(newBoard.name).toBe('New Board');
    expect(newBoard.grid.length).toBe(10);
    expect(useLibraryStore.getState().boards.length).toBe(initialCount + 1);
  });

  it('creates a board with a custom name', () => {
    const board = useLibraryStore.getState().createBoard({ name: 'Custom Name' });
    expect(board.name).toBe('Custom Name');
  });

  it('sets active board if none was set', async () => {
    resetStore();
    useLibraryStore.setState({ boards: [], activeBoardId: null, isLoaded: true });
    const board = useLibraryStore.getState().createBoard();
    expect(useLibraryStore.getState().activeBoardId).toBe(board.id);
  });
});

describe('renameBoard', () => {
  let boardId;

  beforeEach(async () => {
    await useLibraryStore.getState().loadLibrary();
    const board = useLibraryStore.getState().createBoard({ name: 'Original' });
    boardId = board.id;
  });

  it('renames a board', () => {
    useLibraryStore.getState().renameBoard(boardId, 'Renamed');
    const board = useLibraryStore.getState().boards.find((b) => b.id === boardId);
    expect(board.name).toBe('Renamed');
  });

  it('trims the name', () => {
    useLibraryStore.getState().renameBoard(boardId, '  Trimmed  ');
    const board = useLibraryStore.getState().boards.find((b) => b.id === boardId);
    expect(board.name).toBe('Trimmed');
  });

  it('does not rename with empty name', () => {
    useLibraryStore.getState().renameBoard(boardId, 'Original');
    useLibraryStore.getState().renameBoard(boardId, '');
    const board = useLibraryStore.getState().boards.find((b) => b.id === boardId);
    expect(board.name).toBe('Original');
  });

  it('updates updatedAt timestamp', () => {
    const before = useLibraryStore.getState().boards.find((b) => b.id === boardId).updatedAt;
    useLibraryStore.getState().renameBoard(boardId, 'Changed');
    const after = useLibraryStore.getState().boards.find((b) => b.id === boardId).updatedAt;
    expect(new Date(after) >= new Date(before)).toBe(true);
  });
});

describe('updateGrid and updateCell', () => {
  let boardId;

  beforeEach(async () => {
    await useLibraryStore.getState().loadLibrary();
    const board = useLibraryStore.getState().createBoard();
    boardId = board.id;
  });

  it('updates a single cell', () => {
    const result = useLibraryStore.getState().updateCell(boardId, 3, 4, 7);
    expect(result.success).toBe(true);

    const board = useLibraryStore.getState().boards.find((b) => b.id === boardId);
    expect(board.grid[3][4]).toBe(7);
  });

  it('rejects invalid cell values', () => {
    const result = useLibraryStore.getState().updateCell(boardId, 0, 0, 15);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects negative cell values', () => {
    const result = useLibraryStore.getState().updateCell(boardId, 0, 0, -1);
    expect(result.success).toBe(false);
  });

  it('rejects non-integer cell values', () => {
    const result = useLibraryStore.getState().updateCell(boardId, 0, 0, 3.5);
    expect(result.success).toBe(false);
  });

  it('updates an entire grid', () => {
    const newGrid = Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 10 }, (_, c) => (r + c) % 10)
    );
    const result = useLibraryStore.getState().updateGrid(boardId, newGrid);
    expect(result.success).toBe(true);

    const board = useLibraryStore.getState().boards.find((b) => b.id === boardId);
    expect(board.grid[1][2]).toBe(3);
  });

  it('rejects invalid grid data', () => {
    const badGrid = Array.from({ length: 10 }, () => Array(10).fill(99));
    const result = useLibraryStore.getState().updateGrid(boardId, badGrid);
    expect(result.success).toBe(false);
  });
});

describe('applyCells', () => {
  let boardId;

  beforeEach(async () => {
    await useLibraryStore.getState().loadLibrary();
    const board = useLibraryStore.getState().createBoard();
    boardId = board.id;
  });

  const board = () => useLibraryStore.getState().boards.find((b) => b.id === boardId);

  it('writes every cell of the map', () => {
    const result = useLibraryStore.getState().applyCells(boardId, { '0,0': 4, '2,3': 9 });
    expect(result.success).toBe(true);

    expect(board().grid[0][0]).toBe(4);
    expect(board().grid[2][3]).toBe(9);
  });

  it('replaces the board once for a whole fill', () => {
    const before = board();
    useLibraryStore.getState().applyCells(boardId, { '0,0': 1, '0,1': 2, '0,2': 3 });
    const after = board();

    expect(after).not.toBe(before);
    // The previous board object is untouched, so nothing shares a row array.
    expect(before.grid[0][0]).toBe(0);
    expect(after.updatedAt >= before.updatedAt).toBe(true);
  });

  it('refuses a map holding a non-digit without writing anything', () => {
    const result = useLibraryStore.getState().applyCells(boardId, { '0,0': 1, '0,1': 12 });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();

    expect(board().grid[0][0]).toBe(0);
    expect(board().grid[0][1]).toBe(0);
  });

  it('leaves the board alone for an empty map', () => {
    const before = board();
    expect(useLibraryStore.getState().applyCells(boardId, {}).success).toBe(true);
    expect(board()).toBe(before);
  });

  it('is what updateCell does for one cell', () => {
    useLibraryStore.getState().updateCell(boardId, 5, 5, 8);
    expect(board().grid[5][5]).toBe(8);
  });
});

describe('toggleFavorite', () => {
  let boardId;

  beforeEach(async () => {
    await useLibraryStore.getState().loadLibrary();
    const board = useLibraryStore.getState().createBoard();
    boardId = board.id;
  });

  it('toggles favorite on', () => {
    useLibraryStore.getState().toggleFavorite(boardId);
    const board = useLibraryStore.getState().boards.find((b) => b.id === boardId);
    expect(board.isFavorite).toBe(true);
  });

  it('toggles favorite off', () => {
    useLibraryStore.getState().toggleFavorite(boardId);
    useLibraryStore.getState().toggleFavorite(boardId);
    const board = useLibraryStore.getState().boards.find((b) => b.id === boardId);
    expect(board.isFavorite).toBe(false);
  });
});

describe('getFilteredBoards', () => {
  beforeEach(async () => {
    await useLibraryStore.getState().loadLibrary();
    const b1 = useLibraryStore.getState().createBoard({ name: 'Board A' });
    useLibraryStore.getState().createBoard({ name: 'Board B' });
    useLibraryStore.getState().toggleFavorite(b1.id);
  });

  it('returns all boards with "all" filter', () => {
    const all = useLibraryStore.getState().getFilteredBoards('all');
    expect(all.length).toBeGreaterThanOrEqual(3); // default + 2 created
  });

  it('returns only favorites with "favorites" filter', () => {
    const favs = useLibraryStore.getState().getFilteredBoards('favorites');
    expect(favs.length).toBe(1);
    expect(favs[0].isFavorite).toBe(true);
  });
});

describe('duplicateBoard', () => {
  let originalId;

  beforeEach(async () => {
    await useLibraryStore.getState().loadLibrary();
    const board = useLibraryStore.getState().createBoard({ name: 'Original' });
    originalId = board.id;
    useLibraryStore.getState().updateCell(originalId, 0, 0, 5);
  });

  it('creates a copy with a new ID', () => {
    const copy = useLibraryStore.getState().duplicateBoard(originalId);
    expect(copy.id).not.toBe(originalId);
    expect(copy.id).toBeTruthy();
  });

  it('appends " (copy)" to the name', () => {
    const copy = useLibraryStore.getState().duplicateBoard(originalId);
    expect(copy.name).toBe('Original (copy)');
  });

  it('uses a provided name for the copy', () => {
    const copy = useLibraryStore.getState().duplicateBoard(originalId, '  My Copy  ');
    expect(copy.name).toBe('My Copy');
  });

  it('falls back to the default name when the provided name is blank', () => {
    const copy = useLibraryStore.getState().duplicateBoard(originalId, '   ');
    expect(copy.name).toBe('Original (copy)');
  });

  it('copies the grid data', () => {
    const copy = useLibraryStore.getState().duplicateBoard(originalId);
    expect(copy.grid[0][0]).toBe(5);
  });

  it('creates an independent copy (editing one does not affect the other)', () => {
    const copy = useLibraryStore.getState().duplicateBoard(originalId);
    useLibraryStore.getState().updateCell(originalId, 0, 0, 9);
    const updatedOriginal = useLibraryStore.getState().boards.find((b) => b.id === originalId);
    const copyAfter = useLibraryStore.getState().boards.find((b) => b.id === copy.id);
    expect(updatedOriginal.grid[0][0]).toBe(9);
    expect(copyAfter.grid[0][0]).toBe(5);
  });

  it('returns null for non-existent board', () => {
    const result = useLibraryStore.getState().duplicateBoard('non-existent');
    expect(result).toBeNull();
  });
});

describe('deleteBoard', () => {
  let boardId1, boardId2;

  beforeEach(async () => {
    await useLibraryStore.getState().loadLibrary();
    const b1 = useLibraryStore.getState().createBoard({ name: 'Board 1' });
    const b2 = useLibraryStore.getState().createBoard({ name: 'Board 2' });
    boardId1 = b1.id;
    boardId2 = b2.id;
  });

  it('removes the board from the list', () => {
    const countBefore = useLibraryStore.getState().boards.length;
    useLibraryStore.getState().deleteBoard(boardId1);
    expect(useLibraryStore.getState().boards.length).toBe(countBefore - 1);
    expect(useLibraryStore.getState().boards.find((b) => b.id === boardId1)).toBeUndefined();
  });

  it('switches active board if deleted board was active', () => {
    useLibraryStore.getState().setActiveBoard(boardId1);
    useLibraryStore.getState().deleteBoard(boardId1);
    expect(useLibraryStore.getState().activeBoardId).not.toBe(boardId1);
    expect(useLibraryStore.getState().activeBoardId).toBeTruthy();
  });

  it('keeps active board if a different board was deleted', () => {
    useLibraryStore.getState().setActiveBoard(boardId2);
    useLibraryStore.getState().deleteBoard(boardId1);
    expect(useLibraryStore.getState().activeBoardId).toBe(boardId2);
  });

  it('creates a replacement when deleting the last board', async () => {
    // Delete all but one
    const boards = [...useLibraryStore.getState().boards];
    for (let i = 0; i < boards.length - 1; i++) {
      useLibraryStore.getState().deleteBoard(boards[i].id);
    }
    expect(useLibraryStore.getState().boards.length).toBe(1);
    const lastId = useLibraryStore.getState().boards[0].id;

    // Delete the last board — should create a replacement
    useLibraryStore.getState().deleteBoard(lastId);
    expect(useLibraryStore.getState().boards.length).toBe(1);
    expect(useLibraryStore.getState().boards[0].id).not.toBe(lastId);
  });
});

describe('setActiveBoard', () => {
  let boardId;

  beforeEach(async () => {
    await useLibraryStore.getState().loadLibrary();
    const board = useLibraryStore.getState().createBoard();
    boardId = board.id;
  });

  it('sets the active board ID', () => {
    useLibraryStore.getState().setActiveBoard(boardId);
    expect(useLibraryStore.getState().activeBoardId).toBe(boardId);
  });
});

describe('persistence', () => {
  it('persists board data via saveLibrary', async () => {
    await useLibraryStore.getState().loadLibrary();
    const board = useLibraryStore.getState().createBoard({ name: 'Persisted Board' });
    useLibraryStore.getState().updateCell(board.id, 0, 0, 7);
    useLibraryStore.getState().toggleFavorite(board.id);

    // The mock saveLibrary stores the library
    expect(mockStoredLibrary).toBeTruthy();
    expect(mockStoredLibrary.boards.some((b) => b.id === board.id)).toBe(true);

    const reloaded = mockStoredLibrary.boards.find((b) => b.id === board.id);
    expect(reloaded.name).toBe('Persisted Board');
    expect(reloaded.grid[0][0]).toBe(7);
    expect(reloaded.isFavorite).toBe(true);
  });
});

describe('replaceCells', () => {
  let boardId;

  beforeEach(async () => {
    await useLibraryStore.getState().loadLibrary();
    const board = useLibraryStore.getState().createBoard({ name: 'Replace Test' });
    boardId = board.id;
    // Set up a known grid: row 0 = [1,2,3,0,0,0,0,0,0,0], rest = zeros
    const grid = Array.from({ length: 10 }, () => Array(10).fill(0));
    grid[0][0] = 1;
    grid[0][1] = 2;
    grid[0][2] = 3;
    useLibraryStore.getState().updateGrid(boardId, grid);
  });

  it('replaces one occurrence and persists', async () => {
    const result = await useLibraryStore.getState().replaceCells(boardId, { '0,0': 9 });
    expect(result.success).toBe(true);

    const board = useLibraryStore.getState().boards.find((b) => b.id === boardId);
    expect(board.grid[0][0]).toBe(9);
    expect(board.grid[0][1]).toBe(2); // unchanged
    expect(mockStoredLibrary).toBeTruthy();
  });

  it('replaces multiple occurrences in one call', async () => {
    const result = await useLibraryStore.getState().replaceCells(boardId, {
      '0,0': 5,
      '0,1': 5,
      '0,2': 5,
    });
    expect(result.success).toBe(true);

    const board = useLibraryStore.getState().boards.find((b) => b.id === boardId);
    expect(board.grid[0][0]).toBe(5);
    expect(board.grid[0][1]).toBe(5);
    expect(board.grid[0][2]).toBe(5);
  });

  it('does not update state when persistence fails', async () => {
    // Capture the grid before the failed replace
    const boardBefore = useLibraryStore.getState().boards.find((b) => b.id === boardId);
    const gridBefore = boardBefore.grid.map((r) => [...r]);

    // Make saveLibrary throw
    const { saveLibrary } = require('@/services/board-storage');
    saveLibrary.mockRejectedValueOnce(new Error('Disk full'));

    const result = await useLibraryStore.getState().replaceCells(boardId, { '0,0': 9 });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();

    // State must be unchanged
    const boardAfter = useLibraryStore.getState().boards.find((b) => b.id === boardId);
    expect(boardAfter.grid).toEqual(gridBefore);
  });

  it('rejects invalid cell values', async () => {
    const result = await useLibraryStore.getState().replaceCells(boardId, { '0,0': 15 });
    expect(result.success).toBe(false);
  });

  it('returns success for empty changes without persisting', async () => {
    const { saveLibrary } = require('@/services/board-storage');
    saveLibrary.mockClear();

    const result = await useLibraryStore.getState().replaceCells(boardId, {});
    expect(result.success).toBe(true);
    expect(saveLibrary).not.toHaveBeenCalled();
  });

  it('returns failure for a non-existent board', async () => {
    const result = await useLibraryStore.getState().replaceCells('no-such-board', { '0,0': 5 });
    expect(result.success).toBe(false);
  });
});
