// Lightweight in-memory expo-sqlite mock for Results and Collection repository tests.
// It understands only the statements emitted by the shared database modules.

const RESULT_COLUMNS = [
  'id',
  'source_id',
  'game_code',
  'game_name',
  'draw_date',
  'slot',
  'numbers',
  'extra_numbers',
  'prize_amount',
  'currency',
  'winners_count',
  'winners_status',
  'server_time',
  'fetched_at',
  'updated_at',
  'record_json',
];

const COLLECTION_COLUMNS = [
  'id',
  'combination',
  'coordinates',
  'search_text',
  'added_at',
  'is_favorite',
  'created_at',
  'updated_at',
];

const state = {
  rows: new Map(),
  metadata: new Map(),
  collectionRows: new Map(),
  collectionMetadata: new Map(),
  userVersion: 0,
  openedNames: [],
};

function snapshotState() {
  return {
    rows: new Map([...state.rows].map(([key, value]) => [key, { ...value }])),
    metadata: new Map(state.metadata),
    collectionRows: new Map(
      [...state.collectionRows].map(([key, value]) => [key, { ...value }])
    ),
    collectionMetadata: new Map(state.collectionMetadata),
    userVersion: state.userVersion,
  };
}

function restoreState(snapshot) {
  state.rows = snapshot.rows;
  state.metadata = snapshot.metadata;
  state.collectionRows = snapshot.collectionRows;
  state.collectionMetadata = snapshot.collectionMetadata;
  state.userVersion = snapshot.userVersion;
}

function matchLimit(params) {
  const value = params[params.length - 1];
  return Number.isFinite(value) && value > 0 ? value : Infinity;
}

function likeNeedle(value) {
  return String(value ?? '').replace(/^%|%$/g, '').toLowerCase();
}

const database = {
  execAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
  runAsync: jest.fn(),
  withTransactionAsync: jest.fn(),
};

const openDatabaseAsync = jest.fn();

function applyImplementations() {
  openDatabaseAsync.mockImplementation(async (name) => {
    state.openedNames.push(name);
    return database;
  });

  database.execAsync.mockImplementation(async (sql) => {
    const versionMatch = /PRAGMA user_version\s*=\s*(\d+)/i.exec(sql);
    if (versionMatch) state.userVersion = Number(versionMatch[1]);
    return [];
  });

  database.getFirstAsync.mockImplementation(async (sql, params = []) => {
    if (/PRAGMA user_version/i.test(sql)) {
      return { user_version: state.userVersion };
    }
    if (/SELECT record_json FROM lotto_results WHERE id = \?/i.test(sql)) {
      const row = state.rows.get(params[0]);
      return row ? { record_json: row.record_json } : null;
    }
    if (/SELECT COUNT\(\*\) AS count FROM lotto_results/i.test(sql)) {
      return { count: state.rows.size };
    }

    if (/FROM collection_metadata WHERE key = \?/i.test(sql)) {
      const value = state.collectionMetadata.get(params[0]);
      return typeof value === 'string' ? { value } : null;
    }
    if (/SELECT COUNT\(\*\) AS count FROM collection_items/i.test(sql)) {
      return { count: state.collectionRows.size };
    }
    if (/SELECT COUNT\(\*\) AS total/i.test(sql)) {
      let favorites = 0;
      for (const row of state.collectionRows.values()) {
        if (Number(row.is_favorite) === 1) favorites += 1;
      }
      return { total: state.collectionRows.size, favorites };
    }
    if (/FROM collection_items WHERE combination = \?/i.test(sql)) {
      const row = [...state.collectionRows.values()].find(
        (item) => item.combination === params[0]
      );
      return row ? { ...row } : null;
    }
    return null;
  });

  database.getAllAsync.mockImplementation(async (sql, params = []) => {
    if (/SELECT key, value FROM results_sync_metadata/i.test(sql)) {
      return [...state.metadata].map(([key, value]) => ({ key, value }));
    }

    if (/SELECT DISTINCT draw_date/i.test(sql)) {
      const dates = [...new Set(
        [...state.rows.values()]
          .map((row) => row.draw_date)
          .filter((date) => typeof date === 'string' && date.length > 0)
      )].sort().reverse();
      return dates.slice(0, matchLimit(params)).map((draw_date) => ({ draw_date }));
    }

    if (/SELECT record_json FROM lotto_results/i.test(sql)) {
      let rows = [...state.rows.values()];

      if (/WHERE draw_date = \?/i.test(sql)) {
        rows = rows.filter((row) => row.draw_date === params[0]);
      } else if (/WHERE numbers LIKE \?/i.test(sql)) {
        const needle = likeNeedle(params[0]);
        rows = rows.filter((row) =>
          [row.numbers, row.game_name, row.game_code]
            .some((value) => String(value ?? '').toLowerCase().includes(needle))
        );
      }

      rows.sort(
        (a, b) =>
          String(b.draw_date ?? '').localeCompare(String(a.draw_date ?? '')) ||
          String(b.id).localeCompare(String(a.id))
      );
      return rows.slice(0, matchLimit(params)).map(({ record_json }) => ({ record_json }));
    }

    if (/FROM collection_items/i.test(sql)) {
      let rows = [...state.collectionRows.values()];

      if (/is_favorite = 1/i.test(sql)) {
        rows = rows.filter((row) => Number(row.is_favorite) === 1);
      }

      const likeClauses = [...sql.matchAll(/(combination|search_text) LIKE \?/gi)];
      let paramIndex = 0;
      for (const clause of likeClauses) {
        const field = clause[1] === 'combination' ? 'combination' : 'search_text';
        const needle = likeNeedle(params[paramIndex]);
        paramIndex += 1;
        rows = rows.filter((row) =>
          String(row[field] ?? '').toLowerCase().includes(needle)
        );
      }

      rows.sort(
        (a, b) =>
          String(b.added_at ?? '').localeCompare(String(a.added_at ?? '')) ||
          String(b.id).localeCompare(String(a.id))
      );
      return rows.map((row) => ({
        id: row.id,
        combination: row.combination,
        coordinates: row.coordinates,
        added_at: row.added_at,
        is_favorite: row.is_favorite,
      }));
    }

    return [];
  });

  database.runAsync.mockImplementation(async (sql, params = []) => {
    if (/INSERT INTO lotto_results/i.test(sql)) {
      const row = {};
      RESULT_COLUMNS.forEach((column, index) => {
        row[column] = params[index] ?? null;
      });
      state.rows.set(row.id, row);
      return { rowsAffected: 1 };
    }

    if (/UPDATE lotto_results/i.test(sql)) {
      const id = params[params.length - 1];
      const existing = state.rows.get(id);
      if (!existing) return { rowsAffected: 0 };
      const updates = {};
      RESULT_COLUMNS.filter((column) => column !== 'id').forEach((column, index) => {
        updates[column] = params[index] ?? null;
      });
      state.rows.set(id, { ...existing, ...updates });
      return { rowsAffected: 1 };
    }

    if (/INSERT INTO results_sync_metadata/i.test(sql)) {
      state.metadata.set(params[0], params[1]);
      return { rowsAffected: 1 };
    }

    if (/INSERT INTO collection_metadata/i.test(sql)) {
      state.collectionMetadata.set(params[0], params[1]);
      return { rowsAffected: 1 };
    }

    if (/INSERT INTO collection_items/i.test(sql)) {
      const row = {};
      COLLECTION_COLUMNS.forEach((column, index) => {
        row[column] = params[index] ?? null;
      });
      const existing = [...state.collectionRows.values()].find(
        (item) => item.combination === row.combination
      );
      if (existing && /DO NOTHING/i.test(sql)) return { rowsAffected: 0 };
      state.collectionRows.set(row.id, row);
      return { rowsAffected: 1 };
    }

    if (/UPDATE collection_items/i.test(sql)) {
      const id = params[params.length - 1];
      const existing = state.collectionRows.get(id);
      if (!existing) return { rowsAffected: 0 };
      state.collectionRows.set(id, {
        ...existing,
        is_favorite: params[0],
        updated_at: params[1],
      });
      return { rowsAffected: 1 };
    }

    if (/DELETE FROM collection_items\s*$/i.test(sql)) {
      const count = state.collectionRows.size;
      state.collectionRows.clear();
      return { rowsAffected: count };
    }

    if (/DELETE FROM collection_items WHERE id = \?/i.test(sql)) {
      if (!state.collectionRows.has(params[0])) return { rowsAffected: 0 };
      state.collectionRows.delete(params[0]);
      return { rowsAffected: 1 };
    }

    return { rowsAffected: 0 };
  });

  database.withTransactionAsync.mockImplementation(async (callback) => {
    const before = snapshotState();
    try {
      return await callback();
    } catch (error) {
      restoreState(before);
      throw error;
    }
  });
}

function reset() {
  state.rows.clear();
  state.metadata.clear();
  state.collectionRows.clear();
  state.collectionMetadata.clear();
  state.userVersion = 0;
  state.openedNames.length = 0;
  jest.resetAllMocks();
  applyImplementations();
}

applyImplementations();

module.exports = {
  openDatabaseAsync,
  __database: database,
  __dbState: state,
  __resetSqliteMock: reset,
};
