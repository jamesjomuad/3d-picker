// Lightweight in-memory expo-sqlite mock for Results repository tests.
// It understands only the statements emitted by the Results database module.

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

const state = {
  rows: new Map(),
  metadata: new Map(),
  userVersion: 0,
  openedNames: [],
};

function snapshotState() {
  return {
    rows: new Map([...state.rows].map(([key, value]) => [key, { ...value }])),
    metadata: new Map(state.metadata),
    userVersion: state.userVersion,
  };
}

function restoreState(snapshot) {
  state.rows = snapshot.rows;
  state.metadata = snapshot.metadata;
  state.userVersion = snapshot.userVersion;
}

function matchLimit(params) {
  const value = params[params.length - 1];
  return Number.isFinite(value) && value > 0 ? value : Infinity;
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
        const needle = String(params[0] ?? '').replace(/^%|%$/g, '').toLowerCase();
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
