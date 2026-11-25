/**
 * Local backup documents
 *
 * A backup is a plain JSON document holding only user-owned local data: the
 * board library and the Selection Basket. Draw results stay out because they
 * are a network cache, and settings stay out because a backup should restore
 * collections, not silently change the device's theme.
 *
 * Import is deliberately strict. A document must match this app's format and
 * pass the same rules the storage services enforce before it can replace what
 * is already on the device.
 */

import { loadBasket, saveBasket } from '@/services/basket-storage';
import { loadLibrary, saveLibrary } from '@/services/board-storage';
import { validateBoard } from '@/utils/board-validation';

export const BACKUP_FORMAT = '3d-picker-backup';
export const BACKUP_VERSION = 1;

/**
 * Builds a backup from the current stored local data.
 * @returns {Promise<Object>} Backup document
 */
export async function createBackup() {
  const [library, basket] = await Promise.all([loadLibrary(), loadBasket()]);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      library,
      basket: { version: 1, entries: basket },
    },
  };
}

/**
 * Serializes a backup for sharing or saving to a file.
 * @param {Object} backup
 * @returns {string}
 */
export function serializeBackup(backup) {
  return JSON.stringify(backup, null, 2);
}

/**
 * Is this a usable saved-pick entry with a real timestamp when one is present?
 * @param {unknown} entry
 * @returns {boolean}
 */
function isValidEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (typeof entry.digits !== 'string' || entry.digits.length === 0) return false;
  if (!Array.isArray(entry.path) || entry.path.length === 0) return false;
  if (
    !entry.path.every(
      (cell) => cell && Number.isInteger(cell.row) && Number.isInteger(cell.column)
    )
  ) {
    return false;
  }

  if (entry.addedAt === undefined) return true;
  if (typeof entry.addedAt !== 'string' && typeof entry.addedAt !== 'number') return false;
  return !Number.isNaN(new Date(entry.addedAt).getTime());
}

/**
 * Copies a validated board to a stable shape. Import never writes arbitrary
 * properties from a user-supplied file into AsyncStorage.
 * @param {Object} board
 * @returns {Object}
 */
function normalizeBoard(board) {
  return {
    id: board.id,
    name: board.name,
    isFavorite: board.isFavorite === true,
    grid: board.grid.map((row) => [...row]),
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
  };
}

/**
 * Copies a validated basket entry to a stable shape.
 * @param {Object} entry
 * @returns {Object}
 */
function normalizeEntry(entry) {
  const normalized = {
    digits: entry.digits,
    path: entry.path.map((cell) => ({ row: cell.row, column: cell.column })),
  };

  return entry.addedAt === undefined ? normalized : { ...normalized, addedAt: entry.addedAt };
}

/**
 * Parses and validates backup text from a file.
 * @param {string} text
 * @returns {{ valid: true, backup: Object } | { valid: false, error: string }}
 */
export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { valid: false, error: 'The selected file is not valid JSON.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, error: 'The backup document is not an object.' };
  }
  if (parsed.format !== BACKUP_FORMAT) {
    return { valid: false, error: 'The selected file is not a 3D Picker backup.' };
  }
  if (parsed.version !== BACKUP_VERSION) {
    return { valid: false, error: `Unsupported backup version: ${parsed.version}.` };
  }
  if (typeof parsed.exportedAt !== 'string' || Number.isNaN(new Date(parsed.exportedAt).getTime())) {
    return { valid: false, error: 'The backup has no valid export date.' };
  }

  const data = parsed.data;
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'The backup is missing its data.' };
  }

  const library = data.library;
  if (!library || typeof library !== 'object' || library.version !== 1) {
    return { valid: false, error: 'The backup library format is invalid.' };
  }
  if (!Array.isArray(library.boards) || library.boards.length === 0) {
    return { valid: false, error: 'The backup contains no boards.' };
  }
  if (library.activeBoardId !== null && typeof library.activeBoardId !== 'string') {
    return { valid: false, error: 'The active board reference is invalid.' };
  }

  const seenIds = new Set();
  const boards = [];
  for (const board of library.boards) {
    if (!board || typeof board.id !== 'string' || board.id.length === 0) {
      return { valid: false, error: 'A board in the backup has no valid ID.' };
    }
    if (seenIds.has(board.id)) {
      return { valid: false, error: 'The backup contains duplicate board IDs.' };
    }
    if (board.isFavorite !== undefined && typeof board.isFavorite !== 'boolean') {
      return { valid: false, error: `Board "${board.name}" has an invalid favorite flag.` };
    }
    if (typeof board.createdAt !== 'string' || typeof board.updatedAt !== 'string') {
      return { valid: false, error: `Board "${board.name}" has invalid dates.` };
    }
    const validation = validateBoard(board);
    if (!validation.valid) {
      return { valid: false, error: `Invalid board "${board.name}": ${validation.error}` };
    }
    seenIds.add(board.id);
    boards.push(normalizeBoard(board));
  }

  if (typeof library.activeBoardId === 'string' && !seenIds.has(library.activeBoardId)) {
    return { valid: false, error: 'The active board is not in the backup.' };
  }

  const basket = data.basket;
  if (!basket || typeof basket !== 'object' || basket.version !== 1) {
    return { valid: false, error: 'The backup collection format is invalid.' };
  }
  if (!Array.isArray(basket.entries)) {
    return { valid: false, error: 'The backup collection entries are invalid.' };
  }
  for (const entry of basket.entries) {
    if (!isValidEntry(entry)) {
      return { valid: false, error: 'The backup contains an invalid saved pick.' };
    }
  }

  return {
    valid: true,
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: parsed.exportedAt,
      data: {
        library: {
          version: 1,
          activeBoardId: library.activeBoardId,
          boards,
        },
        basket: {
          version: 1,
          entries: basket.entries.map(normalizeEntry),
        },
      },
    },
  };
}

/**
 * Replaces local data with a validated backup. If the second write fails,
 * the previously loaded documents are written back so a failed import does
 * not leave the library and basket from different backups.
 * @param {Object} backup - Validated backup from `parseBackup`
 * @returns {Promise<void>}
 */
export async function restoreBackup(backup) {
  const previousLibrary = await loadLibrary();
  const previousBasket = await loadBasket();

  try {
    await saveLibrary(backup.data.library);
    await saveBasket(backup.data.basket.entries);
  } catch (error) {
    try {
      await saveLibrary(previousLibrary);
      await saveBasket(previousBasket);
    } catch (rollbackError) {
      console.error('Failed to roll back backup import:', rollbackError);
    }
    throw error;
  }
}
