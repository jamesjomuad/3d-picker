/**
 * Board creation utilities
 * Generates new boards with default values and unique IDs
 */

let idCounter = 0;

/**
 * Generates a unique board ID
 * @returns {string}
 */
export function generateBoardId() {
  idCounter += 1;
  const timestamp = Date.now().toString(36);
  const counter = idCounter.toString(36).padStart(4, '0');
  return `board-${timestamp}-${counter}`;
}

/**
 * Creates an empty 10×10 grid filled with zeros
 * @param {number} [rows=10]
 * @param {number} [cols=10]
 * @returns {number[][]}
 */
export function createEmptyGrid(rows = 10, cols = 10) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

/**
 * Creates a new board with default values
 * @param {Object} [options]
 * @param {string} [options.name] - Board name
 * @param {number[][]} [options.grid] - Grid data
 * @returns {Object} New board object
 */
export function createBoard({ name, grid } = {}) {
  const now = new Date().toISOString();
  return {
    id: generateBoardId(),
    name: name || 'New Board',
    isFavorite: false,
    grid: grid || createEmptyGrid(),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Resets the ID counter (for testing only)
 */
export function resetIdCounter() {
  idCounter = 0;
}
