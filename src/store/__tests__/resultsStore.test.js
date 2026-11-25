/**
 * Tests for the results store
 */

import { useResultsStore } from '@/store/resultsStore';

let mockStoredCache = null;
jest.mock('@/services/lottery-storage', () => ({
  loadDrawResults: jest.fn(async () => {
    if (mockStoredCache) return mockStoredCache;
    return { records: [], nextCursor: null, hasMore: false, lastSyncAt: null };
  }),
  saveDrawResults: jest.fn(async (state) => {
    mockStoredCache = state;
  }),
}));

let mockLatest;
let mockHistory;
jest.mock('@/services/lottery-api', () => ({
  fetchLatestResults: jest.fn(async () => {
    if (mockLatest instanceof Error) throw mockLatest;
    return mockLatest;
  }),
  fetchHistoryPage: jest.fn(async ({ cursor } = {}) => {
    if (mockHistory instanceof Error) throw mockHistory;
    return typeof mockHistory === 'function' ? mockHistory(cursor) : mockHistory;
  }),
}));

function makeRecord(id, overrides = {}) {
  return {
    id,
    lottery: '3DL',
    drawNumber: '',
    result: ['0', '3', '7'],
    drawDate: '2026-11-24',
    drawTime: '21:00:00+08',
    jackpot: null,
    totalWinners: null,
    provisional: null,
    lastVerifiedAt: null,
    lastSuccessfulCaptureAt: null,
    collectedAt: null,
    sources: ['history'],
    conflict: false,
    conflictSnapshots: [],
    fetchedAt: '2026-11-25T00:00:00.000Z',
    ...overrides,
  };
}

function page(records, pageInfo = { hasNextPage: false, nextCursor: null }) {
  return { records, dropped: 0, total: records.length, pageInfo };
}

function resetStore() {
  mockStoredCache = null;
  mockLatest = { records: [], dropped: 0, total: 0 };
  mockHistory = page([]);
  useResultsStore.setState({
    records: [],
    isLoaded: false,
    isRefreshing: false,
    isLoadingMore: false,
    hasMore: false,
    nextCursor: null,
    lastSyncAt: null,
    error: null,
  });
}

beforeEach(resetStore);

describe('load', () => {
  it('hydrates cached records once', async () => {
    mockStoredCache = {
      records: [makeRecord('cached-1')],
      nextCursor: 'cursor-1',
      hasMore: true,
      lastSyncAt: '2026-11-25T00:00:00.000Z',
    };

    await useResultsStore.getState().load();
    await useResultsStore.getState().load();

    expect(useResultsStore.getState().records).toHaveLength(1);
    expect(useResultsStore.getState().nextCursor).toBe('cursor-1');
    expect(useResultsStore.getState().hasMore).toBe(true);
  });
});

describe('refresh', () => {
  it('merges latest and history and persists the result', async () => {
    mockLatest = { records: [makeRecord('latest-1', { sources: ['latest'] })], dropped: 0, total: 1 };
    mockHistory = page([makeRecord('history-1')], { hasNextPage: true, nextCursor: 'c2' });

    await useResultsStore.getState().load();
    const result = await useResultsStore.getState().refresh();

    expect(result.success).toBe(true);
    const state = useResultsStore.getState();
    expect(state.records.map((record) => record.id).sort()).toEqual([
      'history-1',
      'latest-1',
    ]);
    expect(state.records).toHaveLength(2);
    expect(state.nextCursor).toBe('c2');
    expect(state.hasMore).toBe(true);
    expect(state.lastSyncAt).toBeTruthy();
    expect(state.error).toBeNull();
    expect(mockStoredCache.records).toHaveLength(2);
  });

  it('keeps cached records when both endpoints fail', async () => {
    mockStoredCache = {
      records: [makeRecord('cached-1')],
      nextCursor: null,
      hasMore: false,
      lastSyncAt: '2026-11-25T00:00:00.000Z',
    };
    await useResultsStore.getState().load();

    mockLatest = new Error('Request failed (502)');
    mockHistory = new Error('Request failed (502)');
    const result = await useResultsStore.getState().refresh();

    expect(result.success).toBe(false);
    const state = useResultsStore.getState();
    expect(state.records).toHaveLength(1);
    expect(state.error).toContain('saved results');
    // Never leak raw status text like "Request failed (502)" to the UI.
    expect(state.error).not.toContain('502');
    expect(state.error).not.toContain('Request failed');
    expect(state.lastSyncAt).toBe('2026-11-25T00:00:00.000Z');
  });

  it('persists fetched records after every successful fetch', async () => {
    const { saveDrawResults } = require('@/services/lottery-storage');
    saveDrawResults.mockClear();

    mockLatest = page([makeRecord('latest-1')], { hasNextPage: false, nextCursor: null });
    mockHistory = page([makeRecord('history-1')], { hasNextPage: false, nextCursor: null });
    await useResultsStore.getState().refresh();

    expect(saveDrawResults).toHaveBeenCalledTimes(1);
    expect(mockStoredCache.records).toHaveLength(2);
  });

  it('shows partial failure when only one endpoint succeeds', async () => {
    mockLatest = new Error('Request failed (502)');
    mockHistory = page([makeRecord('history-1')], { hasNextPage: false, nextCursor: null });

    const result = await useResultsStore.getState().refresh();

    expect(result.success).toBe(true);
    expect(useResultsStore.getState().records).toHaveLength(1);
    expect(useResultsStore.getState().error).toContain('saved results');
  });

  it('ignores overlapping refresh calls', async () => {
    useResultsStore.setState({ isRefreshing: true });
    const result = await useResultsStore.getState().refresh();
    expect(result.success).toBe(false);
  });
});

describe('loadOlder', () => {
  it('requests the next page with the stored cursor and merges it', async () => {
    useResultsStore.setState({
      isLoaded: true,
      records: [makeRecord('newer', { drawDate: '2026-11-24' })],
      hasMore: true,
      nextCursor: 'cursor-1',
    });
    mockHistory = (cursor) => {
      expect(cursor).toBe('cursor-1');
      return page([makeRecord('older', { drawDate: '2026-11-20' })], {
        hasNextPage: false,
        nextCursor: null,
      });
    };

    const result = await useResultsStore.getState().loadOlder();

    expect(result.success).toBe(true);
    const state = useResultsStore.getState();
    expect(state.records.map((record) => record.id)).toEqual(['newer', 'older']);
    expect(state.hasMore).toBe(false);
    expect(state.nextCursor).toBeNull();
    expect(mockStoredCache.records).toHaveLength(2);
  });

  it('does nothing without a cursor or while already loading', async () => {
    useResultsStore.setState({ isLoaded: true, hasMore: true, nextCursor: null });
    expect((await useResultsStore.getState().loadOlder()).success).toBe(false);

    useResultsStore.setState({ nextCursor: 'c1', isLoadingMore: true });
    expect((await useResultsStore.getState().loadOlder()).success).toBe(false);
  });

  it('keeps records when the older page fails', async () => {
    useResultsStore.setState({
      isLoaded: true,
      records: [makeRecord('kept')],
      hasMore: true,
      nextCursor: 'c1',
    });
    mockHistory = new Error('Request failed (502)');

    const result = await useResultsStore.getState().loadOlder();

    expect(result.success).toBe(false);
    expect(useResultsStore.getState().records).toHaveLength(1);
    expect(useResultsStore.getState().nextCursor).toBe('c1');
    expect(useResultsStore.getState().error).toBeTruthy();
  });
});
