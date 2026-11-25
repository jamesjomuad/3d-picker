import {
  formatCombination,
  getRecordStatus,
  normalizeDrawRecord,
  normalizeHistoryPayload,
  normalizeLatestPayload,
  normalizePageInfo,
  sortRecordsNewestFirst,
} from '../lottery-normalize';

const SUPPORTED = ['3DL'];

function raw(overrides = {}) {
  return {
    id: '3DLS0002220',
    lottery: '3DL',
    drawNumber: 'S0002220',
    result: ['0', '3', '7'],
    drawDate: '2026-11-24',
    drawTime: '21:00:00+08',
    jackpot: '4500.0000',
    totalWinners: '27',
    provisional: true,
    collectedAt: '2026-11-24T13:05:00Z',
    ...overrides,
  };
}

describe('normalizeDrawRecord', () => {
  it('keeps winning digits as strings, leading zero intact', () => {
    const record = normalizeDrawRecord(raw(), 'history');

    expect(record.result).toEqual(['0', '3', '7']);
    expect(formatCombination(record.result)).toBe('037');
    expect(record.result.every((digit) => typeof digit === 'string')).toBe(true);
  });

  it('accepts single-digit integers from an alternate payload shape', () => {
    const record = normalizeDrawRecord(raw({ result: [0, 3, 7] }), 'latest');
    expect(record.result).toEqual(['0', '3', '7']);
  });

  it('rejects records without an id, lottery, date or result', () => {
    expect(normalizeDrawRecord(null, 'history')).toBeNull();
    expect(normalizeDrawRecord(raw({ id: '' }), 'history')).toBeNull();
    expect(normalizeDrawRecord(raw({ lottery: null }), 'history')).toBeNull();
    expect(normalizeDrawRecord(raw({ drawDate: '' }), 'history')).toBeNull();
    expect(normalizeDrawRecord(raw({ result: [] }), 'history')).toBeNull();
    expect(normalizeDrawRecord(raw({ result: ['12'] }), 'history')).toBeNull();
    expect(normalizeDrawRecord(raw({ result: ['a'] }), 'history')).toBeNull();
  });

  it('records the source endpoint', () => {
    expect(normalizeDrawRecord(raw(), 'latest').sources).toEqual(['latest']);
  });

  it('keeps optional metadata null when absent', () => {
    const record = normalizeDrawRecord(raw({ jackpot: undefined, provisional: undefined }), 'history');
    expect(record.jackpot).toBeNull();
    expect(record.provisional).toBeNull();
    expect(record.lastVerifiedAt).toBeNull();
  });
});

describe('normalizeLatestPayload', () => {
  it('keeps only supported lotteries and counts dropped items', () => {
    const payload = [raw(), raw({ id: '6DL-1', lottery: '6DL' }), raw({ id: 'bad', result: ['x'] })];

    const result = normalizeLatestPayload(payload, SUPPORTED);

    expect(result.records).toHaveLength(1);
    expect(result.records[0].id).toBe('3DLS0002220');
    expect(result.dropped).toBe(1);
    expect(result.total).toBe(3);
  });

  it('tolerates a non-array payload', () => {
    expect(normalizeLatestPayload({ error: true }, SUPPORTED).records).toEqual([]);
  });
});

describe('normalizeHistoryPayload', () => {
  it('reads items and pageInfo', () => {
    const payload = { items: [raw()], pageInfo: { hasNextPage: true, nextCursor: 'abc' } };

    const result = normalizeHistoryPayload(payload, SUPPORTED);

    expect(result.records).toHaveLength(1);
    expect(result.pageInfo).toEqual({ hasNextPage: true, nextCursor: 'abc' });
  });

  it('returns an empty page for a malformed payload', () => {
    const result = normalizeHistoryPayload(null, SUPPORTED);
    expect(result.records).toEqual([]);
    expect(result.pageInfo.hasNextPage).toBe(false);
  });
});

describe('normalizePageInfo', () => {
  it('honors hasNextPage only when a cursor exists', () => {
    expect(normalizePageInfo({ hasNextPage: true, nextCursor: 'x' }).hasNextPage).toBe(true);
    expect(normalizePageInfo({ hasNextPage: true, nextCursor: null }).hasNextPage).toBe(false);
    expect(normalizePageInfo({ hasNextPage: false, nextCursor: 'x' }).hasNextPage).toBe(false);
    expect(normalizePageInfo(undefined).nextCursor).toBeNull();
  });
});

describe('sortRecordsNewestFirst', () => {
  it('orders by drawDate then drawTime, newest first', () => {
    const older = normalizeDrawRecord(raw({ id: 'a', drawDate: '2026-11-23' }), 'history');
    const newer = normalizeDrawRecord(raw({ id: 'b', drawDate: '2026-11-24' }), 'history');
    const sameDayEarlier = normalizeDrawRecord(
      raw({ id: 'c', drawDate: '2026-11-24', drawTime: '14:00:00+08' }),
      'history'
    );

    const sorted = sortRecordsNewestFirst([older, sameDayEarlier, newer]);

    expect(sorted.map((record) => record.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('getRecordStatus', () => {
  it('maps metadata to the four statuses', () => {
    expect(getRecordStatus({ conflict: true, provisional: false })).toBe('Conflicting');
    expect(getRecordStatus({ conflict: false, provisional: true })).toBe('Provisional');
    expect(getRecordStatus({ conflict: false, provisional: false, lastVerifiedAt: 'x' })).toBe(
      'Verified'
    );
    expect(getRecordStatus({ conflict: false, provisional: false, lastVerifiedAt: null })).toBe(
      'Pending verification'
    );
  });

  it('does not treat provisional:false alone as verified', () => {
    expect(getRecordStatus({ conflict: false, provisional: false })).toBe(
      'Pending verification'
    );
  });
});
