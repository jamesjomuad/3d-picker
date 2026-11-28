import { __database, __dbState, __resetSqliteMock } from '../../../../../test/expo-sqlite-mock';

import {
  getCollectionSnapshot,
  resetCollectionMigrationForTests,
  saveCollectionEntries,
} from '@/features/collection/database/collection-repository';
import {
  getDrawDates,
  getRecordCount,
  getResultsPage,
  getResultsSnapshot,
  getStorageIdentity,
  getSyncMetadata,
  importLegacyCacheIfEmpty,
  persistSyncResult,
  searchResults,
  setDisplayLimit,
  upsertRecords,
} from '../results-repository';
import {
  getResultsDatabase,
  resetResultsDatabaseForTests,
} from '../results-database';
import { RESULTS_METADATA_KEYS } from '../results-schema';

jest.mock('@/services/lottery-storage', () => ({
  loadDrawResults: jest.fn(async () => ({ records: [] })),
}));

const { loadDrawResults } = jest.requireMock('@/services/lottery-storage');

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
    drawNumber: '2PM',
    jackpot: '150000',
    currency: 'PHP',
    totalWinners: 4,
    winnersStatus: 'final',
    provisional: false,
    lastVerifiedAt: '2026-11-27T06:30:00.000Z',
    lastSuccessfulCaptureAt: '2026-11-27T06:30:00.000Z',
    collectedAt: '2026-11-27T06:30:00.000Z',
    serverTime: '2026-11-27T06:30:00.000Z',
    fetchedAt: '2026-11-27T06:30:00.000Z',
    sources: ['latest'],
    conflict: false,
    conflictSnapshots: [],
    timezone: 'Asia/Manila',
    ...overrides,
  };
}

beforeEach(() => {
  __resetSqliteMock();
  resetResultsDatabaseForTests();
  resetCollectionMigrationForTests();
  loadDrawResults.mockReset();
  loadDrawResults.mockResolvedValue({ records: [] });
});

describe('results database initialization', () => {
  it('creates tables, indexes and a schema version once', async () => {
    const db = await getResultsDatabase();
    expect(db).toBe(__database);

    const sql = __database.execAsync.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS lotto_results');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS results_sync_metadata');
    expect(sql).toContain('idx_results_draw_date');
    expect(sql).toContain('idx_results_game_code');
    expect(sql).toContain('idx_results_slot');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_results_source_id');
    expect(__dbState.userVersion).toBe(2);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS collection_items');
    expect(sql).toContain('idx_collection_favorite_added_at');

    await getResultsDatabase();
    expect(__dbState.openedNames).toHaveLength(1);
  });

  it('does not downgrade a newer schema', async () => {
    __dbState.userVersion = 3;
    await getResultsDatabase();

    const sql = __database.execAsync.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).not.toContain('CREATE TABLE IF NOT EXISTS lotto_results');
    expect(__dbState.userVersion).toBe(3);
  });
});

describe('results repository', () => {
  it('keeps leading zeros and queries by date and session in descending order', async () => {
    await upsertRecords([
      makeRecord(),
      makeRecord({
        sourceId: '1002',
        id: 'v2-source-1002',
        drawDate: '2026-11-28',
        gameCode: '3d_lotto_9pm',
        slot: '9PM',
        drawTime: '21:00:00',
        result: ['0', '0', '5'],
      }),
    ]);

    const all = await getResultsPage();
    expect(all.map((record) => record.drawDate)).toEqual(['2026-11-28', '2026-11-27']);
    expect(all[1].result).toEqual(['0', '3', '7']);

    const filtered = await getResultsPage({ date: '2026-11-27' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].gameCode).toBe('3d_lotto_2pm');
    expect(await getDrawDates()).toEqual(['2026-11-28', '2026-11-27']);
    expect(await searchResults('005')).toHaveLength(1);
    expect(await getRecordCount()).toBe(2);
  });

  it('uses sourceId as stable identity and preserves history missing from latest', async () => {
    await upsertRecords([
      makeRecord({ sources: ['history'] }),
      makeRecord({
        sourceId: 'older',
        id: 'v2-source-older',
        drawDate: '2026-11-20',
        sources: ['history'],
      }),
    ]);

    await upsertRecords([
      makeRecord({
        sources: ['latest'],
        winnersStatus: 'final',
        jackpot: '200000',
      }),
    ]);

    const page = await getResultsPage();
    expect(page).toHaveLength(2);
    const refreshed = page.find((record) => record.sourceId === '1001');
    expect(refreshed.sources).toEqual(expect.arrayContaining(['history', 'latest']));
    expect(refreshed.jackpot).toBe('200000');
    expect(page.some((record) => record.sourceId === 'older')).toBe(true);
  });

  it('derives a stable composite identity without winning digits', async () => {
    const pending = makeRecord({
      sourceId: undefined,
      id: 'v2-3d_lotto_5pm-2026-11-27-17-00-00',
      gameCode: '3d_lotto_5pm',
      drawDate: '2026-11-27',
      drawTime: '17:00:00',
      slot: '5PM',
      result: [],
      winnersStatus: 'pending',
    });
    const final = {
      ...pending,
      result: ['1', '2', '3'],
      winnersStatus: 'final',
    };

    expect(getStorageIdentity(pending)).toBe(getStorageIdentity(final));
    await upsertRecords([pending, final]);

    const page = await getResultsPage();
    expect(page).toHaveLength(1);
    expect(page[0].result).toEqual(['1', '2', '3']);
    expect(page[0].winnersStatus).toBe('final');
  });

  it('never silently overwrites conflicting winning numbers', async () => {
    await upsertRecords([makeRecord({ sources: ['first'] })]);
    await upsertRecords([
      makeRecord({
        result: ['9', '8', '7'],
        sources: ['second'],
      }),
    ]);

    const [record] = await getResultsPage();
    expect(record.result).toEqual(['0', '3', '7']);
    expect(record.conflict).toBe(true);
    expect(record.sources).toEqual(expect.arrayContaining(['first', 'second']));
    expect(record.conflictSnapshots.length).toBeGreaterThan(0);
  });

  it('rolls back a failed batch without deleting cached records', async () => {
    await upsertRecords([makeRecord()]);

    __database.runAsync.mockImplementationOnce(async () => {
      throw new Error('disk full');
    });

    await expect(
      persistSyncResult({
        records: [makeRecord({ sourceId: '2002', id: 'v2-source-2002' })],
        metadata: { [RESULTS_METADATA_KEYS.GAME_CODES]: ['3d_lotto_2pm'] },
      })
    ).rejects.toThrow('disk full');

    const page = await getResultsPage();
    expect(page).toHaveLength(1);
    expect(page[0].sourceId).toBe('1001');
    const metadata = await getSyncMetadata();
    expect(metadata[RESULTS_METADATA_KEYS.GAME_CODES]).toBeUndefined();
  });

  it('runs Results and Collection writes concurrently without nested transactions', async () => {
    await getResultsDatabase();
    __database.withTransactionAsync.mockClear();
    __database.withExclusiveTransactionAsync.mockClear();

    await Promise.all([
      upsertRecords([makeRecord()]),
      saveCollectionEntries([{ digits: '037', path: [{ row: 4, column: 3 }] }]),
    ]);

    expect(__database.withTransactionAsync).not.toHaveBeenCalled();
    expect(__database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(2);
    expect(await getRecordCount()).toBe(1);
    expect((await getCollectionSnapshot()).entries).toHaveLength(1);
  });

  it('reads a bounded snapshot with parsed sync metadata', async () => {
    await persistSyncResult({
      records: [makeRecord()],
      metadata: {
        [RESULTS_METADATA_KEYS.GAME_CODES]: ['3d_lotto_2pm'],
        [RESULTS_METADATA_KEYS.HISTORY_CURSORS]: { '3d_lotto_2pm': 'cursor-1' },
        [RESULTS_METADATA_KEYS.HAS_MORE]: true,
        [RESULTS_METADATA_KEYS.LAST_SYNC_AT]: '2026-11-27T07:00:00.000Z',
      },
    });

    const snapshot = await getResultsSnapshot({ limit: 10 });
    expect(snapshot.records).toHaveLength(1);
    expect(snapshot.drawDates).toEqual(['2026-11-27']);
    expect(snapshot.totalCount).toBe(1);
    expect(snapshot.gameCodes).toEqual(['3d_lotto_2pm']);
    expect(snapshot.historyCursors).toEqual({ '3d_lotto_2pm': 'cursor-1' });
    expect(snapshot.hasMore).toBe(true);
    expect(snapshot.lastSyncAt).toBe('2026-11-27T07:00:00.000Z');
  });

  it('uses the persisted display limit for snapshots', async () => {
    await persistSyncResult({
      records: [
        makeRecord(),
        makeRecord({
          sourceId: '1002',
          id: 'v2-source-1002',
          drawDate: '2026-11-26',
        }),
      ],
      metadata: {
        [RESULTS_METADATA_KEYS.DISPLAY_LIMIT]: 400,
      },
    });

    const snapshot = await getResultsSnapshot();
    expect(snapshot.displayLimit).toBe(400);
    expect(snapshot.records).toHaveLength(2);
    expect(snapshot.records.map((record) => record.drawDate)).toEqual([
      '2026-11-27',
      '2026-11-26',
    ]);

    const bounded = await getResultsSnapshot({ limit: 1 });
    expect(bounded.records).toHaveLength(1);
    expect(bounded.displayLimit).toBe(400);
  });

  it('persists a rounded display limit for cached paging', async () => {
    await upsertRecords([makeRecord()]);

    await expect(setDisplayLimit(650)).resolves.toBe(600);
    expect(await getSyncMetadata()).toMatchObject({
      [RESULTS_METADATA_KEYS.DISPLAY_LIMIT]: '600',
    });
    expect((await getResultsSnapshot()).displayLimit).toBe(600);
  });

  it('imports the legacy AsyncStorage cache once when SQLite is empty', async () => {
    loadDrawResults.mockResolvedValueOnce({
      records: [makeRecord({ sourceId: 'legacy', id: 'v2-source-legacy' })],
      gameCodes: ['3d_lotto_2pm'],
      historyCursors: { '3d_lotto_2pm': 'legacy-cursor' },
      hasMore: true,
      lastSyncAt: '2026-11-26T07:00:00.000Z',
    });

    await expect(importLegacyCacheIfEmpty()).resolves.toBe(true);
    expect(await getRecordCount()).toBe(1);
    await expect(importLegacyCacheIfEmpty()).resolves.toBe(false);

    const snapshot = await getResultsSnapshot();
    expect(snapshot.gameCodes).toEqual(['3d_lotto_2pm']);
    expect(snapshot.historyCursors).toEqual({ '3d_lotto_2pm': 'legacy-cursor' });
    expect(loadDrawResults).toHaveBeenCalledTimes(1);
  });
});
