import {
  compareBoards,
  formatJsonIssue,
  parseBoardJson,
  serializeBoardJson,
} from '@/utils/board-json';

function makeBoard() {
  return {
    id: 'board-1',
    name: 'Board One',
    isFavorite: false,
    grid: [
      [1, 2],
      [0, 9],
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('serializeBoardJson', () => {
  it('serializes the real board shape in a stable order', () => {
    const json = serializeBoardJson(makeBoard());

    expect(Object.keys(JSON.parse(json))).toEqual([
      'id',
      'name',
      'isFavorite',
      'grid',
      'createdAt',
      'updatedAt',
    ]);
    expect(json).toContain('"grid"');
  });

  it('does not mutate the source grid', () => {
    const board = makeBoard();
    const json = serializeBoardJson(board);

    JSON.parse(json).grid[0][0] = 8;
    expect(board.grid[0][0]).toBe(1);
  });
});

describe('parseBoardJson', () => {
  it('parses a valid edited board', () => {
    const original = makeBoard();
    const next = {
      ...original,
      name: 'Renamed',
      grid: [
        [5, 2],
        [0, 9],
      ],
    };

    const result = parseBoardJson(JSON.stringify(next, null, 2), original);

    expect(result.success).toBe(true);
    expect(result.board.name).toBe('Renamed');
    expect(result.board.grid[0][0]).toBe(5);
  });

  it('reports malformed JSON', () => {
    const result = parseBoardJson('{ "name": "Board One", }', makeBoard());

    expect(result.success).toBe(false);
    expect(result.errors[0].message).toBeTruthy();
  });

  it('rejects unknown properties', () => {
    const next = { ...makeBoard(), surprise: true };
    const result = parseBoardJson(JSON.stringify(next, null, 2), makeBoard());

    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.message.includes('"surprise"'))).toBe(true);
  });

  it('rejects missing required properties', () => {
    const next = makeBoard();
    delete next.updatedAt;
    const result = parseBoardJson(JSON.stringify(next, null, 2), makeBoard());

    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.message.includes('"updatedAt"'))).toBe(true);
  });

  it('rejects read-only identity changes', () => {
    const next = { ...makeBoard(), id: 'board-2' };
    const result = parseBoardJson(JSON.stringify(next, null, 2), makeBoard());

    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.message.includes('"id" is read-only'))).toBe(true);
  });

  it('reports row and cell errors with source locations', () => {
    const next = makeBoard();
    next.grid[0][0] = 12;
    next.grid[1] = [0, 9, 4];
    const result = parseBoardJson(JSON.stringify(next, null, 2), makeBoard());

    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.message.includes('Row 1 has 3 columns'))).toBe(true);
    expect(result.errors.some((error) => error.message.includes('Cell [0][0]'))).toBe(true);
    expect(result.errors.every((error) => error.location?.line > 0)).toBe(true);
  });

  it('formats issues with line and column', () => {
    const issue = {
      message: 'Bad value',
      location: { index: 4, line: 2, column: 3 },
    };

    expect(formatJsonIssue(issue)).toBe('Line 2, column 3: Bad value');
  });
});

describe('compareBoards', () => {
  it('describes name, favorite, size and cell changes', () => {
    const current = makeBoard();
    const next = makeBoard();
    next.name = 'Changed';
    next.isFavorite = true;
    next.grid[0][0] = 7;
    next.grid.push([3, 4]);

    const comparison = compareBoards(current, next);

    expect(comparison.changed).toBe(true);
    expect(comparison.changes.map((change) => change.kind)).toEqual([
      'name',
      'isFavorite',
      'gridSize',
      'cell',
    ]);
  });

  it('reports no changes for an equal board', () => {
    const comparison = compareBoards(makeBoard(), makeBoard());

    expect(comparison.changed).toBe(false);
    expect(comparison.changes).toEqual([]);
  });
});
