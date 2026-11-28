import {
  getResultsPage,
  getResultsSnapshot,
} from '@/features/results/database/results-repository';
import {
  syncLoadOlder,
  syncRefresh,
} from '@/features/results/database/results-sync';
import { useResultsStore } from '@/store/resultsStore';

jest.mock('@/features/results/database/results-repository', () => ({
  getResultsPage: jest.fn(),
  getResultsSnapshot: jest.fn(),
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
  totalCount: 1,
  gameCodes: ['3d_lotto_2pm'],
  historyCursors: { '3d_lotto_2pm': 'cursor-1' },
  nextCursor: 'cursor-1',
  hasMore: true,
  lastSyncAt: '2026-11-27T07:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  useResultsStore.setState({
    records: [],
    drawDates: [],
    dateFilter: 'all',
    isLoaded: false,
    isRefreshing: false,
    isLoadingMore: false,
    hasMore: false,
    nextCursor: null,
    gameCodes: [],
    historyCursors: {},
    lastSyncAt: null,
    totalCount: 0,
    error: null,
  });

  getResultsSnapshot.mockResolvedValue(snapshot);
  getResultsPage.mockResolvedValue(snapshot.records);
  syncRefresh.mockResolvedValue({ success: true, reason: null });
  syncLoadOlder.mockResolvedValue({ success: true, reason: null });
});

describe('useResultsStore.load', () => {
  it('loads cached SQLite data once', async () => {
    await useResultsStore.getState().load();
    await useResultsStore.getState().load();

    expect(getResultsSnapshot).toHaveBeenCalledTimes(1);
    expect(useResultsStore.getState()).toMatchObject({
      records: snapshot.records,
      drawDates: snapshot.drawDates,
      gameCodes: snapshot.gameCodes,
      historyCursors: snapshot.historyCursors,
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
    await useResultsStore.getState().setDateFilter('2026-11-27');
    expect(getResultsPage).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-11-27' })
    );
    expect(useResultsStore.getState().dateFilter).toBe('2026-11-27');

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
    });
    expect(getResultsSnapshot).toHaveBeenCalledTimes(1);
    expect(useResultsStore.getState()).toMatchObject({
      isLoadingMore: false,
      error: null,
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
      error: 'Could not load older results. Saved results are unchanged.',
    });
  });
});
