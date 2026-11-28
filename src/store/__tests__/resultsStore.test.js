/**
 * Tests for the results store.
 * Network clients are mocked; the store owns merge, cursor and cache safety.
 */

import { useResultsStore } from '@/store/resultsStore';

let mockStoredCache = null;
jest.mock('@/services/lottery-storage', () => ({
  loadDrawResults: jest.fn(async () => {
    if (mockStoredCache) return mockStoredCache;
    return {
      records: [],
      nextCursor: null,
      hasMore: false,
      lastSyncAt: null,
      gameCodes: [],
      historyCursors: {},
    };
  }),
  saveDrawResults: jest.fn(async (state) => {
    mockStoredCache = state;
  }),
}));

let mockLatest;
let mockGameCodes;
let mockHistoryBundle;
jest.mock('@/services/lottery-api', () => ({
  fetchLatestResults: jest.fn(async () => {
    if (mockLatest instanceof Error) throw mockLatest;
    return mockLatest;
  }),
  fetchGameCodes: jest.fn(async () => {
    if (mockGameCodes instanceof Error) throw mockGameCodes;
    return mockGameCodes;
  }),
  fetchHistoryBundle: jest.fn(async (args) => {
    if (mockHistoryBundle instanceof Error) throw mockHistoryBundle;
    return typeof mockHistoryBundle === 'function'
      ? mockHistoryBundle(args)
      : mockHistoryBundle;
  }),
}));

const GAME_CODES = ['3d_lotto_2pm', '3d_lotto_5pm', '3d_lotto_9pm'];

function makeRecord(id, overrides = {}) {
  return {
    id,
    lottery: '3DL',
    drawNumber: '9PM Draw',
    result: ['0', '3', '7'],
    drawDate: '2026-11-24',
    drawTime: '21:00:00',
    jackpot: '4500',
    currency: 'PHP',
    totalWinners: '27',
    winnersStatus: 'final',
    provisional: false,
    lastVerifiedAt: null,
    lastSuccessfulCaptureAt: null,
    collectedAt: '2026-11-25T00:00:00.000Z',
    sources: ['history'],
    conflict: false,
    conflictSnapshots: [],
    fetchedAt: '2026-11-25T00:00:00.000Z',
    gameCode: '3d_lotto_9pm',
    gameName: '3D Lotto',
    slot: '9PM Draw',
    sourceId: id,
    serverTime: '2026-11-24T21:00:00+08:00',
    drawId: id,
    timezone: 'Asia/Manila',
    ...overrides,
  };
}

function bundle(records, cursors = {}) {
  return {
    records,
    cursors,
    hasMore: Object.keys(cursors).length > 0,
    failedCodes: [],
    dropped: 0,
    total: records.length,
  };
}

function resetStore() {
  jest.clearAllMocks();
  mockStoredCache = null;
  mockLatest = { records: [], dropped: 0, total: 0 };
  mockGameCodes = [...GAME_CODES];
  mockHistoryBundle = bundle([]);
  useResultsStore.setState({
    records: [],
    isLoaded: false,
    isRefreshing: false,
    isLoadingMore: false,
    hasMore: false,
    nextCursor: null,
    gameCodes: [],
    historyCursors: {},
    lastSyncAt: null,
    error: null,
  });
}

beforeEach(resetStore);

describe('load', () => {
  it('hydrates cached records, codes and per-game cursors once', async () => {
    mockStoredCache = {
      records: [makeRecord('cached-1')],
      nextCursor: 'cursor-1',
      hasMore: true,
      lastSyncAt: '2026-11-25T00:00:00.000Z',
      gameCodes: GAME_CODES,
      historyCursors: { '3d_lotto_9pm': 'cursor-1' },
    };

    await useResultsStore.getState().load();
    await useResultsStore.getState().load();

    const state = useResultsStore.getState();
    expect(state.records).toHaveLength(1);
    expect(state.nextCursor).toBe('cursor-1');
    expect(state.hasMore).toBe(true);
    expect(state.gameCodes).toEqual(GAME_CODES);
    expect(state.historyCursors).toEqual({ '3d_lotto_9pm': 'cursor-1' });
  });
});

describe('refresh', () => {
  it('merges latest and history and persists the result', async () => {
    const { fetchHistoryBundle } = require('@/services/lottery-api');
    mockLatest = {
      records: [makeRecord('latest-1', { sources: ['latest'] })],
      dropped: 0,
      total: 1,
    };
    mockHistoryBundle = bundle(
      [makeRecord('history-1')],
      { '3d_lotto_2pm': 'c2' }
    );

    await useResultsStore.getState().load();
    const result = await useResultsStore.getState().refresh();

    expect(result.success).toBe(true);
    expect(fetchHistoryBundle).toHaveBeenCalledWith({
      gameCodes: GAME_CODES,
      cursors: {},
    });
    const state = useResultsStore.getState();
    expect(state.records.map((record) => record.id).sort()).toEqual([
      'history-1',
      'latest-1',
    ]);
    expect(state.nextCursor).toBe('c2');
    expect(state.historyCursors).toEqual({ '3d_lotto_2pm': 'c2' });
    expect(state.hasMore).toBe(true);
    expect(state.lastSyncAt).toBeTruthy();
    expect(state.error).toBeNull();
    expect(mockStoredCache.records).toHaveLength(2);
  });

  it('keeps cached records when discovery and latest both fail', async () => {
    mockStoredCache = {
      records: [makeRecord('cached-1')],
      nextCursor: null,
      hasMore: false,
      lastSyncAt: '2026-11-25T00:00:00.000Z',
      gameCodes: [],
      historyCursors: {},
    };
    await useResultsStore.getState().load();

    mockLatest = new Error('Request failed (502)');
    mockGameCodes = new Error('Request failed (502)');
    const result = await useResultsStore.getState().refresh();

    expect(result.success).toBe(false);
    const state = useResultsStore.getState();
    expect(state.records).toHaveLength(1);
    expect(state.error).toContain('saved results');
    expect(state.error).not.toContain('502');
    expect(state.error).not.toContain('Request failed');
    expect(state.lastSyncAt).toBe('2026-11-25T00:00:00.000Z');
  });

  it('uses cached codes when live discovery fails', async () => {
    const { fetchHistoryBundle } = require('@/services/lottery-api');
    useResultsStore.setState({
      gameCodes: GAME_CODES,
      historyCursors: { '3d_lotto_9pm': 'cached-cursor' },
    });
    mockGameCodes = new Error('Request failed (502)');
    mockHistoryBundle = bundle([], {});

    const result = await useResultsStore.getState().refresh();

    expect(result.success).toBe(true);
    expect(fetchHistoryBundle).toHaveBeenCalledWith({
      gameCodes: GAME_CODES,
      cursors: { '3d_lotto_9pm': 'cached-cursor' },
    });
    expect(useResultsStore.getState().error).toContain('saved results');
  });

  it('persists fetched records after a successful refresh', async () => {
    const { saveDrawResults } = require('@/services/lottery-storage');
    saveDrawResults.mockClear();

    mockLatest = { records: [makeRecord('latest-1')], dropped: 0, total: 1 };
    mockHistoryBundle = bundle([makeRecord('history-1')]);

    await useResultsStore.getState().refresh();

    expect(saveDrawResults).toHaveBeenCalledTimes(1);
    expect(mockStoredCache.records).toHaveLength(2);
  });

  it('shows partial failure when only one endpoint succeeds', async () => {
    mockLatest = new Error('Request failed (502)');
    mockHistoryBundle = bundle([makeRecord('history-1')]);

    const result = await useResultsStore.getState().refresh();

    expect(result.success).toBe(true);
    expect(useResultsStore.getState().records).toHaveLength(1);
    expect(useResultsStore.getState().error).toContain('saved results');
  });

  it('ignores overlapping refresh calls', async () => {
    useResultsStore.setState({ isRefreshing: true });
    expect((await useResultsStore.getState().refresh()).success).toBe(false);

    useResultsStore.setState({ isRefreshing: false, isLoadingMore: true });
    expect((await useResultsStore.getState().refresh()).success).toBe(false);
  });
});

describe('loadOlder', () => {
  it('requests the next page only for active stored cursors', async () => {
    const { fetchHistoryBundle } = require('@/services/lottery-api');
    const cursors = { '3d_lotto_9pm': 'cursor-1' };
    useResultsStore.setState({
      isLoaded: true,
      records: [makeRecord('newer', { drawDate: '2026-11-24' })],
      hasMore: true,
      gameCodes: GAME_CODES,
      historyCursors: cursors,
      nextCursor: 'cursor-1',
    });
    mockHistoryBundle = ({ gameCodes, cursors: requestCursors }) => {
      expect(gameCodes).toEqual(['3d_lotto_9pm']);
      expect(requestCursors).toEqual(cursors);
      return bundle([makeRecord('older', { drawDate: '2026-11-20' })]);
    };

    const result = await useResultsStore.getState().loadOlder();

    expect(result.success).toBe(true);
    expect(fetchHistoryBundle).toHaveBeenCalledTimes(1);
    const state = useResultsStore.getState();
    expect(state.records.map((record) => record.id)).toEqual(['newer', 'older']);
    expect(state.hasMore).toBe(false);
    expect(state.historyCursors).toEqual({});
    expect(state.nextCursor).toBeNull();
    expect(mockStoredCache.records).toHaveLength(2);
  });

  it('drops an expired cursor without removing older results', async () => {
    useResultsStore.setState({
      isLoaded: true,
      records: [makeRecord('kept')],
      hasMore: true,
      gameCodes: GAME_CODES,
      historyCursors: { '3d_lotto_2pm': 'expired' },
    });
    mockHistoryBundle = ({ cursors }) => {
      expect(cursors).toEqual({ '3d_lotto_2pm': 'expired' });
      return {
        ...bundle([]),
        failedCodes: ['3d_lotto_2pm'],
      };
    };

    const result = await useResultsStore.getState().loadOlder();

    expect(result.success).toBe(true);
    const state = useResultsStore.getState();
    expect(state.records).toHaveLength(1);
    expect(state.hasMore).toBe(false);
    expect(state.historyCursors).toEqual({});
    expect(state.error).toContain('Saved results are unchanged');
  });

  it('does nothing without cursors, codes, or while a request is active', async () => {
    useResultsStore.setState({
      isLoaded: true,
      hasMore: true,
      nextCursor: null,
    });
    expect((await useResultsStore.getState().loadOlder()).success).toBe(false);

    useResultsStore.setState({
      historyCursors: { '3d_lotto_9pm': 'c1' },
      gameCodes: [],
    });
    expect((await useResultsStore.getState().loadOlder()).success).toBe(false);

    useResultsStore.setState({ gameCodes: GAME_CODES, isLoadingMore: true });
    expect((await useResultsStore.getState().loadOlder()).success).toBe(false);

    useResultsStore.setState({ isLoadingMore: false, isRefreshing: true });
    expect((await useResultsStore.getState().loadOlder()).success).toBe(false);
  });

  it('keeps records and cursor when the older page fails', async () => {
    useResultsStore.setState({
      isLoaded: true,
      records: [makeRecord('kept')],
      hasMore: true,
      gameCodes: GAME_CODES,
      historyCursors: { '3d_lotto_9pm': 'c1' },
      nextCursor: 'c1',
    });
    mockHistoryBundle = new Error('Request failed (502)');

    const result = await useResultsStore.getState().loadOlder();

    expect(result.success).toBe(false);
    const state = useResultsStore.getState();
    expect(state.records).toHaveLength(1);
    expect(state.historyCursors).toEqual({ '3d_lotto_9pm': 'c1' });
    expect(state.nextCursor).toBe('c1');
    expect(state.error).toBeTruthy();
    expect(state.error).not.toContain('502');
  });
});
