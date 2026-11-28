import {
  getResultsPage,
  getResultsSnapshot,
  setDisplayLimit,
} from '@/features/results/database/results-repository';
import {
  syncLoadOlder,
  syncRefresh,
} from '@/features/results/database/results-sync';
import {
  cancelResultsRequests,
  resetResultsRequestStateForTests,
  useResultsStore,
} from '@/store/resultsStore';

jest.mock('@/features/results/database/results-repository', () => ({
  getResultsPage: jest.fn(),
  getResultsSnapshot: jest.fn(),
  setDisplayLimit: jest.fn(),
}));

jest.mock('@/features/results/database/results-sync', () => ({
  syncRefresh: jest.fn(),
  syncLoadOlder: jest.fn(),
}));

const record = (sourceId, drawDate) => ({
  id: `v2-${sourceId}`,
  sourceId,
  drawDate,
  gameCode: '3d_lotto_2pm',
  result: ['0', '3', '7'],
  sources: ['history'],
  conflictSnapshots: [],
});

const snapshot = {
  records: [record('1', '2026-11-27')],
  drawDates: ['2026-11-27'],
  drawMonths: ['2026-11'],
  totalCount: 1,
  gameCodes: ['3d_lotto_2pm'],
  historyCursors: { '3d_lotto_2pm': 'cursor-1' },
  nextCursor: 'cursor-1',
  displayLimit: 400,
  hasMore: true,
  lastSyncAt: '2026-11-27T07:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  resetResultsRequestStateForTests();
  useResultsStore.setState({
    records: [],
    drawDates: [],
    drawMonths: [],
    dateFilter: 'all',
    monthFilter: 'all',
    searchQuery: '',
    isLoaded: false,
    isRefreshing: false,
    isLoadingMore: false,
    hasMore: false,
    nextCursor: null,
    gameCodes: [],
    historyCursors: {},
    displayLimit: 200,
    lastSyncAt: null,
    totalCount: 0,
    error: null,
    olderError: null,
    emptyOlderPage: false,
  });

  getResultsSnapshot.mockResolvedValue(snapshot);
  getResultsPage.mockResolvedValue(snapshot.records);
  setDisplayLimit.mockResolvedValue(400);
  syncRefresh.mockResolvedValue({ success: true, reason: null });
  syncLoadOlder.mockResolvedValue({ success: true, reason: null });
});

describe('useResultsStore.load', () => {
  it('loads cached SQLite data once with the persisted display limit', async () => {
    await useResultsStore.getState().load();
    await useResultsStore.getState().load();

    expect(getResultsSnapshot).toHaveBeenCalledTimes(1);
    expect(useResultsStore.getState()).toMatchObject({
      records: snapshot.records,
      drawDates: snapshot.drawDates,
      gameCodes: snapshot.gameCodes,
      historyCursors: snapshot.historyCursors,
      displayLimit: 400,
      hasMore: true,
      lastSyncAt: snapshot.lastSyncAt,
      isLoaded: true,
    });
  });

  it('still marks loading complete when SQLite cannot be read', async () => {
    getResultsSnapshot.mockRejectedValueOnce(new Error('sqlite unavailable'));
    await useResultsStore.getState().load();

    expect(useResultsStore.getState().isLoaded).toBe(true);
    expect(useResultsStore.getState().records).toEqual([]);
  });
});

describe('useResultsStore.setDateFilter', () => {
  it('queries SQLite for the selected date and clears the filter', async () => {
    useResultsStore.setState({ olderError: 'stale', emptyOlderPage: true });
    await useResultsStore.getState().setDateFilter('2026-11-27');
    expect(getResultsPage).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-11-27' })
    );
    expect(useResultsStore.getState()).toMatchObject({
      dateFilter: '2026-11-27',
      olderError: null,
      emptyOlderPage: false,
    });

    getResultsPage.mockResolvedValueOnce(snapshot.records);
    await useResultsStore.getState().setDateFilter('all');
    expect(getResultsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ date: null })
    );
    expect(useResultsStore.getState().dateFilter).toBe('all');
  });
});

describe('useResultsStore.refresh', () => {
  it('refreshes then reloads the active page from SQLite', async () => {
    useResultsStore.setState({ isLoaded: true });
    await useResultsStore.getState().refresh();

    expect(syncRefresh).toHaveBeenCalledWith({
      gameCodes: [],
      historyCursors: {},
      hasMore: false,
      displayLimit: 200,
      signal: expect.any(AbortSignal),
    });
    expect(getResultsSnapshot).toHaveBeenCalledTimes(1);
    expect(useResultsStore.getState()).toMatchObject({
      isRefreshing: false,
      error: null,
      records: snapshot.records,
    });
  });

  it('keeps cached records and cursors after a network failure', async () => {
    useResultsStore.setState({
      isLoaded: true,
      records: snapshot.records,
      drawDates: snapshot.drawDates,
      historyCursors: snapshot.historyCursors,
    });
    syncRefresh.mockResolvedValueOnce({ success: false, reason: 'network' });

    await useResultsStore.getState().refresh();

    expect(getResultsSnapshot).not.toHaveBeenCalled();
    expect(useResultsStore.getState()).toMatchObject({
      isRefreshing: false,
      records: snapshot.records,
      historyCursors: snapshot.historyCursors,
      error: 'Could not refresh. Showing saved results.',
    });
  });

  it('shows a distinct message when SQLite persistence fails', async () => {
    useResultsStore.setState({ isLoaded: true, records: snapshot.records });
    syncRefresh.mockResolvedValueOnce({ success: false, reason: 'database' });

    await useResultsStore.getState().refresh();

    expect(useResultsStore.getState().error)
      .toBe('Could not save new results locally. Showing saved results.');
  });

  it('ignores overlapping refreshes', async () => {
    useResultsStore.setState({ isRefreshing: true });
    await useResultsStore.getState().refresh();

    expect(syncRefresh).not.toHaveBeenCalled();
  });

  it('ignores a cancelled refresh response', async () => {
    let resolveRefresh;
    syncRefresh.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRefresh = resolve;
    }));

    const refreshPromise = useResultsStore.getState().refresh();
    cancelResultsRequests();
    resolveRefresh({ success: true, reason: null });
    await refreshPromise;

    expect(getResultsSnapshot).not.toHaveBeenCalled();
    expect(useResultsStore.getState()).toMatchObject({
      isRefreshing: false,
      error: null,
    });
  });
});

describe('useResultsStore.loadOlder', () => {
  it('does not fetch without a cursor', async () => {
    await useResultsStore.getState().loadOlder();
    expect(syncLoadOlder).not.toHaveBeenCalled();
  });

  it('persists then reloads the next page', async () => {
    useResultsStore.setState({ hasMore: true });
    await useResultsStore.getState().loadOlder();

    expect(syncLoadOlder).toHaveBeenCalledWith({
      gameCodes: [],
      historyCursors: {},
      displayLimit: 200,
      seenCursors: expect.any(Set),
      signal: expect.any(AbortSignal),
    });
    expect(getResultsSnapshot).toHaveBeenCalledTimes(1);
    expect(useResultsStore.getState()).toMatchObject({
      isLoadingMore: false,
      olderError: null,
      emptyOlderPage: false,
      records: snapshot.records,
    });
  });

  it('keeps results and cursors when loading older results fails', async () => {
    useResultsStore.setState({
      hasMore: true,
      records: snapshot.records,
      historyCursors: snapshot.historyCursors,
    });
    syncLoadOlder.mockResolvedValueOnce({ success: false, reason: 'network' });

    await useResultsStore.getState().loadOlder();

    expect(getResultsSnapshot).not.toHaveBeenCalled();
    expect(useResultsStore.getState()).toMatchObject({
      isLoadingMore: false,
      records: snapshot.records,
      historyCursors: snapshot.historyCursors,
      olderError: 'Could not load older results. Saved results are unchanged.',
      error: null,
    });
  });

  it('allows a retry after a failed older page', async () => {
    useResultsStore.setState({ hasMore: true });
    syncLoadOlder
      .mockResolvedValueOnce({ success: false, reason: 'network' })
      .mockResolvedValueOnce({ success: true, reason: null });

    await useResultsStore.getState().loadOlder();
    expect(useResultsStore.getState().olderError).toBeTruthy();

    await useResultsStore.getState().loadOlder();
    expect(syncLoadOlder).toHaveBeenCalledTimes(2);
    expect(useResultsStore.getState().olderError).toBeNull();
  });

  it('flags an empty page when more pages remain', async () => {
    useResultsStore.setState({ hasMore: true });
    syncLoadOlder.mockResolvedValueOnce({
      success: true,
      reason: null,
      persistedCount: 0,
      hasMore: true,
    });

    await useResultsStore.getState().loadOlder();
    expect(useResultsStore.getState().emptyOlderPage).toBe(true);
  });

  it('does not let a cancelled page overwrite newer state', async () => {
    useResultsStore.setState({ hasMore: true });
    let resolveOlder;
    syncLoadOlder.mockImplementationOnce(() => new Promise((resolve) => {
      resolveOlder = resolve;
    }));

    const first = useResultsStore.getState().loadOlder();
    cancelResultsRequests();

    syncLoadOlder.mockResolvedValueOnce({
      success: true,
      reason: null,
      persistedCount: 2,
      hasMore: false,
    });
    getResultsSnapshot.mockResolvedValueOnce({ ...snapshot, hasMore: false });
    await useResultsStore.getState().loadOlder();

    resolveOlder({
      success: true,
      reason: null,
      persistedCount: 99,
      hasMore: true,
    });
    await first;

    expect(useResultsStore.getState()).toMatchObject({
      hasMore: false,
      emptyOlderPage: false,
      isLoadingMore: false,
    });
  });
});

describe('useResultsStore.showMoreLocal', () => {
  it('reveals cached rows after API cursors end', async () => {
    const localRecords = [
      record('1', '2026-11-27'),
      record('2', '2026-11-26'),
      record('3', '2026-11-25'),
    ];
    useResultsStore.setState({
      isLoaded: true,
      hasMore: false,
      displayLimit: 200,
      totalCount: 600,
    });
    getResultsSnapshot.mockResolvedValueOnce({
      ...snapshot,
      records: localRecords,
      displayLimit: 400,
      hasMore: false,
      totalCount: 600,
    });

    const result = await useResultsStore.getState().showMoreLocal();

    expect(result).toEqual({ success: true });
    expect(setDisplayLimit).toHaveBeenCalledWith(400);
    expect(syncLoadOlder).not.toHaveBeenCalled();
    expect(useResultsStore.getState()).toMatchObject({
      records: localRecords,
      displayLimit: 400,
      totalCount: 600,
      isLoadingMore: false,
      olderError: null,
      emptyOlderPage: false,
    });
  });

  it('does nothing when every cached row is already visible', async () => {
    useResultsStore.setState({
      isLoaded: true,
      hasMore: false,
      records: snapshot.records,
      totalCount: 1,
    });

    await expect(useResultsStore.getState().showMoreLocal())
      .resolves.toEqual({ success: false });
    expect(setDisplayLimit).not.toHaveBeenCalled();
    expect(getResultsSnapshot).not.toHaveBeenCalled();
  });

  it('ignores a cancelled local reveal', async () => {
    useResultsStore.setState({
      isLoaded: true,
      hasMore: false,
      records: snapshot.records,
      totalCount: 600,
    });
    let resolveLimit;
    setDisplayLimit.mockImplementationOnce(() => new Promise((resolve) => {
      resolveLimit = resolve;
    }));

    const pending = useResultsStore.getState().showMoreLocal();
    cancelResultsRequests();
    resolveLimit(400);
    await pending;

    expect(getResultsSnapshot).not.toHaveBeenCalled();
    expect(useResultsStore.getState().isLoadingMore).toBe(false);
  });
});

describe('useResultsStore month and search filters', () => {
  it('filters the cached snapshot by month and drops the exact date', async () => {
    useResultsStore.setState({ dateFilter: '2026-11-27' });

    await useResultsStore.getState().setMonthFilter('2026-11');

    expect(getResultsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ date: null, month: '2026-11', query: null })
    );
    expect(useResultsStore.getState()).toMatchObject({
      monthFilter: '2026-11',
      dateFilter: 'all',
      records: snapshot.records,
      drawDates: snapshot.drawDates,
      drawMonths: snapshot.drawMonths,
      totalCount: snapshot.totalCount,
    });
  });

  it('clears the month filter when All months is chosen', async () => {
    useResultsStore.setState({ monthFilter: '2026-11' });

    await useResultsStore.getState().setMonthFilter('all');

    expect(getResultsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ month: null })
    );
    expect(useResultsStore.getState().monthFilter).toBe('all');
  });

  it('rejects an invalid month without querying SQLite', async () => {
    await useResultsStore.getState().setMonthFilter('not-a-month');

    expect(getResultsSnapshot).not.toHaveBeenCalled();
    expect(useResultsStore.getState().monthFilter).toBe('all');
  });

  it('searches cached draws and trims the query', async () => {
    await useResultsStore.getState().setSearchQuery('  037  ');

    expect(getResultsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ query: '037' })
    );
    expect(useResultsStore.getState().searchQuery).toBe('037');
  });

  it('treats an empty search as no query', async () => {
    useResultsStore.setState({ searchQuery: '037' });

    await useResultsStore.getState().setSearchQuery('   ');

    expect(getResultsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ query: null })
    );
    expect(useResultsStore.getState().searchQuery).toBe('');
  });

  it('clears every filter together', async () => {
    useResultsStore.setState({
      dateFilter: '2026-11-27',
      monthFilter: '2026-11',
      searchQuery: '037',
    });

    await useResultsStore.getState().clearFilters();

    expect(getResultsSnapshot).toHaveBeenCalledWith();
    expect(useResultsStore.getState()).toMatchObject({
      dateFilter: 'all',
      monthFilter: 'all',
      searchQuery: '',
      records: snapshot.records,
      drawDates: snapshot.drawDates,
      drawMonths: snapshot.drawMonths,
      totalCount: snapshot.totalCount,
    });
  });

  it('preserves active filters when refresh reloads SQLite', async () => {
    useResultsStore.setState({
      isLoaded: true,
      dateFilter: '2026-11-27',
      monthFilter: '2026-11',
      searchQuery: '037',
    });

    await useResultsStore.getState().refresh();

    expect(getResultsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-11-27',
        month: '2026-11',
        query: '037',
      })
    );
  });

  it('blocks server paging while a month or search filter is active', async () => {
    useResultsStore.setState({ hasMore: true, monthFilter: '2026-11' });
    await expect(useResultsStore.getState().loadOlder())
      .resolves.toEqual({ success: false });
    expect(syncLoadOlder).not.toHaveBeenCalled();

    useResultsStore.setState({ monthFilter: 'all', searchQuery: '037' });
    await expect(useResultsStore.getState().loadOlder())
      .resolves.toEqual({ success: false });
    expect(syncLoadOlder).not.toHaveBeenCalled();
  });

  it('blocks local reveal while a month or search filter is active', async () => {
    useResultsStore.setState({
      isLoaded: true,
      hasMore: false,
      totalCount: 600,
      monthFilter: '2026-11',
    });
    await expect(useResultsStore.getState().showMoreLocal())
      .resolves.toEqual({ success: false });
    expect(setDisplayLimit).not.toHaveBeenCalled();

    useResultsStore.setState({ monthFilter: 'all', searchQuery: '037' });
    await expect(useResultsStore.getState().showMoreLocal())
      .resolves.toEqual({ success: false });
    expect(setDisplayLimit).not.toHaveBeenCalled();
    expect(getResultsSnapshot).not.toHaveBeenCalled();
  });
});
