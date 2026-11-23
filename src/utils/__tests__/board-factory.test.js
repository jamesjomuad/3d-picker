/**
 * Tests for board factory utilities
 */

import {
  createBoard,
  createEmptyGrid,
  generateBoardId,
  resetIdCounter,
} from '@/utils/board-factory';

beforeEach(() => {
  resetIdCounter();
});

describe('createEmptyGrid', () => {
  it('creates a 10x10 grid of zeros by default', () => {
    const grid = createEmptyGrid();
    expect(grid.length).toBe(10);
    for (const row of grid) {
      expect(row.length).toBe(10);
      for (const cell of row) {
        expect(cell).toBe(0);
      }
    }
  });

  it('creates a grid with custom dimensions', () => {
    const grid = createEmptyGrid(5, 7);
    expect(grid.length).toBe(5);
    expect(grid[0].length).toBe(7);
  });

  it('creates independent rows (not shared references)', () => {
    const grid = createEmptyGrid();
    grid[0][0] = 5;
    expect(grid[1][0]).toBe(0);
  });
});

describe('generateBoardId', () => {
  it('generates unique IDs', () => {
    const id1 = generateBoardId();
    const id2 = generateBoardId();
    expect(id1).not.toBe(id2);
  });

  it('starts with "board-"', () => {
    const id = generateBoardId();
    expect(id.startsWith('board-')).toBe(true);
  });
});

describe('createBoard', () => {
  it('creates a board with default values', () => {
    const board = createBoard();
    expect(board.id).toBeTruthy();
    expect(board.name).toBe('New Board');
    expect(board.isFavorite).toBe(false);
    expect(board.grid.length).toBe(10);
    expect(board.grid[0].length).toBe(10);
    expect(board.createdAt).toBeTruthy();
    expect(board.updatedAt).toBeTruthy();
  });

  it('creates a board with a custom name', () => {
    const board = createBoard({ name: 'My Board' });
    expect(board.name).toBe('My Board');
  });

  it('creates a board with a custom grid', () => {
    const customGrid = createEmptyGrid(10, 10);
    customGrid[0][0] = 5;
    const board = createBoard({ grid: customGrid });
    expect(board.grid[0][0]).toBe(5);
  });

  it('creates unique IDs for each board', () => {
    const board1 = createBoard();
    const board2 = createBoard();
    expect(board1.id).not.toBe(board2.id);
  });
});
