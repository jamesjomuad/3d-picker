import { mergeRecords } from '../lottery-merge';
import { normalizeDrawRecord } from '../lottery-normalize';

function record(overrides = {}, source = 'history') {
  return normalizeDrawRecord(
    {
      id: '3DLS0002220',
      lottery: '3DL',
      result: ['0', '3', '7'],
      drawDate: '2026-11-24',
      drawTime: '21:00:00+08',
      jackpot: '4500.0000',
      ...overrides,
    },
    source
  );
}

describe('mergeRecords', () => {
  it('adds new records and sorts newest first', () => {
    const existing = [record({ id: 'older', drawDate: '2026-11-23' })];
    const incoming = [record({ id: 'newer', drawDate: '2026-11-25' })];

    const merged = mergeRecords(existing, incoming);

    expect(merged.added).toBe(1);
    expect(merged.records.map((item) => item.id)).toEqual(['newer', 'older']);
  });

  it('stores a record once when both endpoints report it, unioning sources', () => {
    const fromHistory = record({}, 'history');
    const fromLatest = record({}, 'latest');

    const merged = mergeRecords([fromHistory], [fromLatest]);

    expect(merged.records).toHaveLength(1);
    expect(merged.records[0].sources.sort()).toEqual(['history', 'latest']);
    expect(merged.conflicts).toBe(0);
  });

  it('flags a result conflict and keeps the first-seen combination', () => {
    const stored = record({}, 'history');
    const disagreeing = record({ result: ['9', '9', '9'], jackpot: '100' }, 'latest');

    const merged = mergeRecords([stored], [disagreeing]);

    expect(merged.conflicts).toBe(1);
    expect(merged.records[0].conflict).toBe(true);
    expect(merged.records[0].result).toEqual(['0', '3', '7']);
    expect(merged.records[0].conflictSnapshots).toHaveLength(2);
    const snapshotResults = merged.records[0].conflictSnapshots.map((snapshot) =>
      snapshot.result.join('')
    );
    expect(snapshotResults).toContain('999');
  });

  it('does not double-count an already flagged conflict', () => {
    const first = mergeRecords([record()], [record({ result: ['1', '1', '1'] }, 'latest')]);
    const again = mergeRecords(first.records, [record({ result: ['2', '2', '2'] }, 'latest')]);

    expect(again.conflicts).toBe(0);
    expect(again.records[0].conflict).toBe(true);
    expect(again.records[0].result).toEqual(['0', '3', '7']);
  });

  it('merges metadata from a second source without conflict', () => {
    const sparse = record({ jackpot: undefined, provisional: undefined }, 'history');
    const rich = record({ totalWinners: '27', provisional: false }, 'latest');

    const merged = mergeRecords([sparse], [rich]);

    expect(merged.records[0].totalWinners).toBe('27');
    expect(merged.records[0].provisional).toBe(false);
    expect(merged.records[0].jackpot).toBe('4500.0000');
    expect(merged.records[0].conflict).toBe(false);
  });
});
