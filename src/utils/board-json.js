import { isValidDigit } from '@/utils/board-validation';

export const BOARD_JSON_PROPERTIES = [
  'id',
  'name',
  'isFavorite',
  'grid',
  'createdAt',
  'updatedAt',
];

const READ_ONLY_PROPERTIES = ['id', 'createdAt', 'updatedAt'];
const ALLOWED_PROPERTIES = new Set(BOARD_JSON_PROPERTIES);

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getLocationFromIndex(text, index) {
  const safeIndex = Math.max(0, Math.min(index ?? 0, text.length));
  const before = text.slice(0, safeIndex);
  const lines = before.split('\n');

  return {
    index: safeIndex,
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function getLocationFromLineColumn(text, line, column) {
  const lines = text.split('\n');
  let index = 0;

  for (let i = 0; i < line - 1 && i < lines.length; i++) {
    index += lines[i].length + 1;
  }

  return getLocationFromIndex(text, index + Math.max(0, column - 1));
}

function findPropertyKeyLocation(text, key) {
  const match = new RegExp(`"${escapeRegExp(key)}"\\s*:`).exec(text);
  return match ? getLocationFromIndex(text, match.index) : null;
}

function findPropertyValueStart(text, key) {
  const match = new RegExp(`"${escapeRegExp(key)}"\\s*:`).exec(text);
  if (!match) return null;

  let index = match.index + match[0].length;
  while (index < text.length && /\s/.test(text[index])) index++;
  return index;
}

function skipWhitespace(text, start) {
  let index = start;
  while (index < text.length && /\s/.test(text[index])) index++;
  return index;
}

function skipString(text, start) {
  let index = start + 1;
  while (index < text.length) {
    if (text[index] === '\\') {
      index += 2;
    } else if (text[index] === '"') {
      return index + 1;
    } else {
      index++;
    }
  }
  return index;
}

function skipValue(text, start) {
  const index = skipWhitespace(text, start);
  const character = text[index];

  if (character === '"') return skipString(text, index);

  if (character === '[' || character === '{') {
    let depth = 0;
    let cursor = index;

    while (cursor < text.length) {
      if (text[cursor] === '"') {
        cursor = skipString(text, cursor);
        continue;
      }
      if (text[cursor] === '[' || text[cursor] === '{') depth++;
      if (text[cursor] === ']' || text[cursor] === '}') {
        depth--;
        if (depth === 0) return cursor + 1;
      }
      cursor++;
    }
    return cursor;
  }

  let cursor = index;
  while (cursor < text.length && !/[\s,\]}]/.test(text[cursor])) cursor++;
  return cursor;
}

function getArrayRanges(text, arrayStart) {
  if (text[arrayStart] !== '[') return [];

  const ranges = [];
  let index = arrayStart + 1;

  while (index < text.length) {
    index = skipWhitespace(text, index);
    if (text[index] === ',') {
      index++;
      continue;
    }
    if (text[index] === ']') break;

    const start = index;
    const end = skipValue(text, start);
    if (end === start) {
      index++;
      continue;
    }
    ranges.push({ start, end });
    index = end;
  }

  return ranges;
}

function getGridLocation(text, rowIndex, colIndex) {
  const gridStart = findPropertyValueStart(text, 'grid');
  if (gridStart == null) return null;
  if (rowIndex == null) return getLocationFromIndex(text, gridStart);

  const rows = getArrayRanges(text, gridStart);
  const row = rows[rowIndex];
  if (!row) return getLocationFromIndex(text, gridStart);
  if (colIndex == null) return getLocationFromIndex(text, row.start);

  const cells = getArrayRanges(text, row.start);
  const cell = cells[colIndex];
  return getLocationFromIndex(text, cell?.start ?? row.start);
}

function makeIssue(message, location) {
  return location ? { message, location } : { message };
}

function cleanParseMessage(message) {
  return message
    .replace(/^JSON Parse error:\s*/i, '')
    .replace(/\s*in JSON at position \d+(?: \(line \d+ column \d+\))?/i, '')
    .replace(/\s*\(line \d+ column \d+\)/i, '')
    .trim();
}

function parseJsonIssue(error, text) {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = cleanParseMessage(rawMessage);
  const lineMatch = /line (\d+)(?:[^\d]+column (\d+))?/i.exec(rawMessage);
  const positionMatch = /position (\d+)/i.exec(rawMessage);

  if (lineMatch) {
    const line = Number(lineMatch[1]);
    const column = Number(lineMatch[2] ?? 1);
    return makeIssue(message, getLocationFromLineColumn(text, line, column));
  }

  if (positionMatch) {
    return makeIssue(message, getLocationFromIndex(text, Number(positionMatch[1])));
  }

  return makeIssue(message);
}

function validateGridForJson(grid, text) {
  const gridLocation =
    text == null
      ? null
      : getLocationFromIndex(text, findPropertyValueStart(text, 'grid') ?? 0);

  if (!Array.isArray(grid)) {
    return [makeIssue('"grid" must be an array of rows.', gridLocation)];
  }

  if (grid.length === 0) {
    return [makeIssue('"grid" cannot be empty.', gridLocation)];
  }

  const errors = [];
  const firstRow = grid[0];

  if (!Array.isArray(firstRow)) {
    errors.push(
      makeIssue('Row 0 must be an array.', getGridLocation(text, 0))
    );
  }

  const expectedColumns = Array.isArray(firstRow) ? firstRow.length : null;

  for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
    const row = grid[rowIndex];

    if (!Array.isArray(row)) {
      if (rowIndex !== 0) {
        errors.push(
          makeIssue(`Row ${rowIndex} must be an array.`, getGridLocation(text, rowIndex))
        );
      }
      continue;
    }

    if (expectedColumns != null && row.length !== expectedColumns) {
      errors.push(
        makeIssue(
          `Row ${rowIndex} has ${row.length} columns, expected ${expectedColumns}.`,
          getGridLocation(text, rowIndex)
        )
      );
    }

    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const value = row[colIndex];
      if (!isValidDigit(value)) {
        errors.push(
          makeIssue(
            `Cell [${rowIndex}][${colIndex}] must be an integer 0-9, got ${JSON.stringify(value)}.`,
            getGridLocation(text, rowIndex, colIndex)
          )
        );
      }
    }
  }

  return errors;
}

function validateParsedBoard(value, originalBoard, text) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      valid: false,
      errors: [makeIssue('Root must be a board object.', getLocationFromIndex(text ?? '', 0))],
    };
  }

  const errors = [];

  for (const key of Object.keys(value)) {
    if (!ALLOWED_PROPERTIES.has(key)) {
      errors.push(
        makeIssue(`"${key}" is not a board property.`, findPropertyKeyLocation(text, key))
      );
    }
  }

  for (const key of BOARD_JSON_PROPERTIES) {
    if (!hasOwn(value, key)) {
      errors.push(makeIssue(`Missing required property "${key}".`, getLocationFromIndex(text, 0)));
    }
  }

  for (const key of READ_ONLY_PROPERTIES) {
    if (!hasOwn(value, key)) continue;
    if (value[key] !== originalBoard[key]) {
      errors.push(
        makeIssue(
          `"${key}" is read-only and must stay ${JSON.stringify(originalBoard[key])}.`,
          findPropertyValueStart(text, key) == null
            ? null
            : getLocationFromIndex(text, findPropertyValueStart(text, key))
        )
      );
    }
  }

  if (hasOwn(value, 'name') && (typeof value.name !== 'string' || !value.name.trim())) {
    const start = findPropertyValueStart(text, 'name');
    errors.push(
      makeIssue('"name" must be a non-empty string.', start == null ? null : getLocationFromIndex(text, start))
    );
  }

  if (hasOwn(value, 'isFavorite') && typeof value.isFavorite !== 'boolean') {
    const start = findPropertyValueStart(text, 'isFavorite');
    errors.push(
      makeIssue('"isFavorite" must be true or false.', start == null ? null : getLocationFromIndex(text, start))
    );
  }

  if (hasOwn(value, 'grid')) {
    errors.push(...validateGridForJson(value.grid, text));
  }

  errors.sort((a, b) => (a.location?.index ?? 0) - (b.location?.index ?? 0));

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    board: {
      id: value.id,
      name: value.name,
      isFavorite: value.isFavorite,
      grid: cloneGrid(value.grid),
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    },
  };
}

export function serializeBoardJson(board) {
  const ordered = {};
  for (const key of BOARD_JSON_PROPERTIES) {
    ordered[key] = key === 'grid' && board.grid ? cloneGrid(board.grid) : board[key];
  }
  return JSON.stringify(ordered, null, 2);
}

export function parseBoardJson(text, originalBoard) {
  if (typeof text !== 'string' || !text.trim()) {
    return { success: false, errors: [makeIssue('Enter board JSON.')] };
  }

  if (!originalBoard || typeof originalBoard !== 'object') {
    return { success: false, errors: [makeIssue('Original board is required.')] };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { success: false, errors: [parseJsonIssue(error, text)] };
  }

  const validation = validateParsedBoard(parsed, originalBoard, text);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  return { success: true, board: validation.board, errors: [] };
}

export function compareBoards(currentBoard, nextBoard) {
  const changes = [];

  if (currentBoard.name !== nextBoard.name) {
    changes.push({ kind: 'name', from: currentBoard.name, to: nextBoard.name });
  }

  if (currentBoard.isFavorite !== nextBoard.isFavorite) {
    changes.push({
      kind: 'isFavorite',
      from: currentBoard.isFavorite,
      to: nextBoard.isFavorite,
    });
  }

  const currentRows = currentBoard.grid.length;
  const nextRows = nextBoard.grid.length;
  const currentColumns = currentRows > 0 ? currentBoard.grid[0].length : 0;
  const nextColumns = nextRows > 0 ? nextBoard.grid[0].length : 0;

  if (currentRows !== nextRows || currentColumns !== nextColumns) {
    changes.push({
      kind: 'gridSize',
      from: { rows: currentRows, columns: currentColumns },
      to: { rows: nextRows, columns: nextColumns },
    });
  }

  const sharedRows = Math.min(currentRows, nextRows);
  for (let row = 0; row < sharedRows; row++) {
    const sharedColumns = Math.min(currentBoard.grid[row].length, nextBoard.grid[row].length);
    for (let column = 0; column < sharedColumns; column++) {
      const from = currentBoard.grid[row][column];
      const to = nextBoard.grid[row][column];
      if (from !== to) {
        changes.push({ kind: 'cell', row, column, from, to });
      }
    }
  }

  return { changed: changes.length > 0, changes };
}

export function formatJsonIssue(issue) {
  if (!issue) return '';
  if (!issue.location) return issue.message;
  return `Line ${issue.location.line}, column ${issue.location.column}: ${issue.message}`;
}

export function formatBoardChange(change) {
  switch (change.kind) {
    case 'name':
      return `Name: "${change.from}" -> "${change.to}"`;
    case 'isFavorite':
      return `Favorite: ${change.from} -> ${change.to}`;
    case 'gridSize':
      return `Grid size: ${change.from.rows}x${change.from.columns} -> ${change.to.rows}x${change.to.columns}`;
    case 'cell':
      return `Cell [${change.row}][${change.column}]: ${change.from} -> ${change.to}`;
    default:
      return 'Board changed';
  }
}
