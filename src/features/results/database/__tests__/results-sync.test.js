import { __database, __resetSqliteMock } from '../../../../../test/expo-sqlite-mock';

import {
  fetchGameCodes,
  fetchHistoryBundle,
  fetchLatestResults,
} from '@/services/lottery-api';

import {
  getResultsPage,
  getSyncMetadata,
  persistSyncResult,
} from '../results-repository';
import {
  syncLoadOlder,
  syncRefresh,
} from '../results-sync';
import {
  RESULTS_METADATA_KEYS,
} from '../results-schema';
import { resetResultsDatabaseForTests } from '../results-database';

jest.mock('@/services/lottery-api', () => ({
  fetchGameCodes: jest.fn(),
  fetchLatestResults: jest.fn(),
  fetchHistoryBundle: jest.fn(),
}));

function makeRecord(overrides = {}) {
  return {
    id: 'v2-source-1001',
    sourceId: '1001',
    gameCode: '3d_lotto_2pm',
    gameName: '3D Lotto 2PM',
    drawDate: '2026-11-27',
    drawTime: '14:00:00',
    slot: '2PM',
    result: ['0', '3', '7'],
    lottery: '3DL',
    sources: ['latest'],
    conflictSnapshots: [],
    fetchedAt: '2026-11-27T06:30:00.000Z',
    winnersStatus: 'final',
    ...overrides,
  };
}

beforeEach(() => {
  __resetSqliteMock();
  resetResultsDatabaseForTests();
  fetchGameCodes.mockReset();
  fetchLatestResults.mockReset();
  fetchHistoryBundle.mockReset();

  fetchGameCodes.mockResolvedValue(['3d_lotto_2pm', '3d_lotto_5pm', '3d_lotto_9pm']);
  fetchLatestResults.mockResolvedValue({ records: [makeRecord()] });
  fetchHistoryBundle.mockResolvedValue({
    records: [makeRecord({ sourceId: 'history-1', id: 'v2-source-history-1' })],
    cursors: {
      '3d_lotto_2pm': 'cursor-2pm-2',
      '3d_lotto_5pm': 'cursor-5pm-2',
      '3d_lotto_9pm': 'cursor-9pm-2',
    },
    hasMore: true,
    failedCodes: [],
  });
});

describe('syncRefresh', () => {
  it('persists latest and newest history, then saves advanced cursors', async () => {
    const result = await syncRefresh({
      gameCodes: ['3d_lotto_2pm'],
      historyCursors: { '3d_lotto_2pm': 'cursor-2pm-1' },
      hasMore: true,
    });

    expect(result.success).toBe(true);
    expect(result.reason).toBeNull();
    expect(fetchHistoryBundle).toHaveBeenCalledWith({
      gameCodes: ['3d_lotto_2pm', '3d_lotto_5pm', '3d_lotto_9pm'],
      cursors: { '3d_lotto_2pm': 'cursor-2pm-1' },
    });
    expect(await getRecordCountIfAvailable()).toBe(2);

    const metadata = await getSyncMetadata();
    expect(JSON.parse(metadata[RESULTS_METADATA_KEYS.GAME_CODES])).toHaveLength(3);
    expect(JSON.parse(metadata[RESULTS_METADATA_KEYS.HISTORY_CURSORS]))
      .toEqual(expect.objectContaining({ '3d_lotto_2pm': 'cursor-2pm-2' }));
    expect(metadata[RESULTS_METADATA_KEYS.HAS_MORE]).toBe('1');
    expect(metadata[RESULTS_METADATA_KEYS.LAST_SYNC_AT]).toBeTruthy();
  });

  it('keeps cached results and cursors when every request fails', async () => {
    await persistSyncResult({
      records: [makeRecord()],
      metadata: {
        [RESULTS_METADATA_KEYS.HISTORY_CURSORS]: { '3d_lotto_2pm': 'cursor-keep' },
      },
    });

    fetchLatestResults.mockRejectedValueOnce(new Error('HTTP 503'));
    fetchGameCodes.mockRejectedValueOnce(new Error('HTTP 503'));
    fetchHistoryBundle.mockRejectedValueOnce(new Error('HTTP 503'));

    const result = await syncRefresh({
      gameCodes: ['3d_lotto_2pm'],
      historyCursors: { '3d_lotto_2pm': 'cursor-keep' },
      hasMore: true,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('network');
    expect(await getResultsPage()).toHaveLength(1);
    const metadata = await getSyncMetadata();
    expect(JSON.parse(metadata[RESULTS_METADATA_KEYS.HISTORY_CURSORS]))
      .toEqual({ '3d_lotto_2pm': 'cursor-keep' });
  });

  it('uses cached codes when discovery fails and reports partial success', async () => {
    fetchGameCodes.mockRejectedValueOnce(new Error('discovery unavailable'));

    const result = await syncRefresh({
      gameCodes: ['3d_lotto_2pm'],
      historyCursors: {},
      hasMore: false,
    });

    expect(result.success).toBe(true);
    expect(result.reason).toBe('partial');
    expect(fetchHistoryBundle).toHaveBeenCalledWith({
      gameCodes: ['3d_lotto_2pm'],
      cursors: {},
    });
  });

  it('does not advance cursors when the database write fails', async () => {
    await persistSyncResult({
      records: [],
      metadata: {
        [RESULTS_METADATA_KEYS.HISTORY_CURSORS]: { '3d_lotto_2pm': 'cursor-keep' },
      },
    });
    const originalRun = __database.runAsync.getMockImplementation();
    __database.runAsync.mockImplementation(async (sql, params) => {
      if (/INSERT INTO lotto_results/i.test(sql)) throw new Error('sqlite locked');
      return originalRun(sql, params);
    });

    const result = await syncRefresh({
      gameCodes: ['3d_lotto_2pm'],
      historyCursors: { '3d_lotto_2pm': 'cursor-keep' },
      hasMore: true,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('database');
    const metadata = await getSyncMetadata();
    expect(JSON.parse(metadata[RESULTS_METADATA_KEYS.HISTORY_CURSORS]))
      .toEqual({ '3d_lotto_2pm': 'cursor-keep' });
  });

  it('passes the advanced cursor into the next refresh', async () => {
    await syncRefresh({ gameCodes: [], historyCursors: {}, hasMore: true });
    expect(fetchHistoryBundle).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursors: {} })
    );

    const metadata = await getSyncMetadata();
    fetchHistoryBundle.mockClear();

    await syncRefresh({
      gameCodes: JSON.parse(metadata[RESULTS_METADATA_KEYS.GAME_CODES]),
      historyCursors: JSON.parse(metadata[RESULTS_METADATA_KEYS.HISTORY_CURSORS]),
      hasMore: true,
    });
    expect(fetchHistoryBundle).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cursors: expect.objectContaining({ '3d_lotto_2pm': 'cursor-2pm-2' }),
      })
    );
  });
});

describe('syncLoadOlder', () => {
  it('does not fetch when no active cursor exists', async () => {
    const result = await syncLoadOlder({
      gameCodes: ['3d_lotto_2pm'],
      historyCursors: {},
    });

    expect(result).toEqual({ success: false, reason: 'no-cursors' });
    expect(fetchHistoryBundle).not.toHaveBeenCalled();
  });

  it('persists the next page and advances only active cursors', async () => {
    const result = await syncLoadOlder({
      gameCodes: ['3d_lotto_2pm', '3d_lotto_5pm'],
      historyCursors: { '3d_lotto_2pm': 'cursor-2pm-1' },
    });

    expect(result.success).toBe(true);
    expect(fetchHistoryBundle).toHaveBeenCalledWith({
      gameCodes: ['3d_lotto_2pm'],
      cursors: { '3d_lotto_2pm': 'cursor-2pm-1' },
    });
    const metadata = await getSyncMetadata();
    expect(JSON.parse(metadata[RESULTS_METADATA_KEYS.HISTORY_CURSORS]))
      .toEqual(expect.objectContaining({ '3d_lotto_2pm': 'cursor-2pm-2' }));
  });

  it('keeps cursors when a network request fails', async () => {
    await persistSyncResult({
      records: [],
      metadata: {
        [RESULTS_METADATA_KEYS.HISTORY_CURSORS]: { '3d_lotto_2pm': 'cursor-keep' },
      },
    });
    fetchHistoryBundle.mockRejectedValueOnce(new Error('offline'));

    const result = await syncLoadOlder({
      gameCodes: ['3d_lotto_2pm'],
      historyCursors: { '3d_lotto_2pm': 'cursor-keep' },
    });

    expect(result).toEqual({ success: false, reason: 'network' });
    const metadata = await getSyncMetadata();
    expect(JSON.parse(metadata[RESULTS_METADATA_KEYS.HISTORY_CURSORS]))
      .toEqual({ '3d_lotto_2pm': 'cursor-keep' });
  });

  it('keeps cursors when a database write fails', async () => {
    await persistSyncResult({
      records: [],
      metadata: {
        [RESULTS_METADATA_KEYS.HISTORY_CURSORS]: { '3d_lotto_2pm': 'cursor-keep' },
      },
    });
    const originalRun = __database.runAsync.getMockImplementation();
    __database.runAsync.mockImplementation(async (sql, params) => {
      if (/INSERT INTO lotto_results/i.test(sql)) throw new Error('write failed');
      return originalRun(sql, params);
    });

    const result = await syncLoadOlder({
      gameCodes: ['3d_lotto_2pm'],
      historyCursors: { '3d_lotto_2pm': 'cursor-keep' },
    });

    expect(result).toEqual({ success: false, reason: 'database' });
    const metadata = await getSyncMetadata();
    expect(JSON.parse(metadata[RESULTS_METADATA_KEYS.HISTORY_CURSORS]))
      .toEqual({ '3d_lotto_2pm': 'cursor-keep' });
  });
});

async function getRecordCountIfAvailable() {
  const records = await getResultsPage();
  return records.length;
}
