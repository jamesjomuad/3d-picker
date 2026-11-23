/**
 * Tests for the Selection Basket display/share formatting
 */

import { buildBasketShareText, formatAddedAt } from '@/utils/basket-format';

describe('formatAddedAt', () => {
  it('formats an ISO timestamp in local time', () => {
    // Built from local parts so the expectation holds in any time zone.
    const stamp = new Date(2026, 10, 23, 20, 35).toISOString();
    expect(formatAddedAt(stamp)).toBe('Nov 23, 2026 · 8:35 PM');
  });

  it('accepts an epoch number', () => {
    expect(formatAddedAt(new Date(2026, 10, 23, 20, 5).getTime())).toBe(
      'Nov 23, 2026 · 8:05 PM'
    );
  });

  it('renders midnight and noon as 12 AM / 12 PM', () => {
    expect(formatAddedAt(new Date(2026, 0, 1, 0, 0).toISOString())).toBe('Jan 1, 2026 · 12:00 AM');
    expect(formatAddedAt(new Date(2026, 6, 4, 12, 0).toISOString())).toBe('Jul 4, 2026 · 12:00 PM');
  });

  it('pads single-digit minutes but not the day', () => {
    expect(formatAddedAt(new Date(2026, 8, 9, 9, 7).toISOString())).toBe('Sep 9, 2026 · 9:07 AM');
  });

  it('returns an empty string for missing or unparseable values', () => {
    expect(formatAddedAt(null)).toBe('');
    expect(formatAddedAt(undefined)).toBe('');
    expect(formatAddedAt('')).toBe('');
    expect(formatAddedAt('not a date')).toBe('');
    expect(formatAddedAt({})).toBe('');
  });
});

describe('buildBasketShareText', () => {
  const first = new Date(2026, 10, 23, 20, 35).toISOString();
  const second = new Date(2026, 10, 24, 9, 7).toISOString();

  it('builds the full numbered list with coordinates and Added lines', () => {
    const text = buildBasketShareText([
      {
        digits: '074',
        path: [
          { row: 1, column: 1 },
          { row: 2, column: 3 },
          { row: 3, column: 5 },
        ],
        addedAt: first,
      },
      {
        digits: '638',
        path: [
          { row: 0, column: 0 },
          { row: 0, column: 2 },
          { row: 2, column: 2 },
        ],
        addedAt: second,
      },
    ]);

    expect(text).toBe(
      [
        '3D Picker – Selection Basket',
        '',
        'Total Picks: 2',
        '',
        '1. 074 (B2 → D3 → F4)',
        '   Added: Nov 23, 2026 · 8:35 PM',
        '',
        '2. 638 (A1 → C1 → C3)',
        '   Added: Nov 24, 2026 · 9:07 AM',
        '',
        'Generated using 3D Picker.',
      ].join('\n')
    );
  });

  it('omits the Added line for legacy entries without a timestamp', () => {
    const text = buildBasketShareText([{ digits: '952', path: [{ row: 9, column: 9 }] }]);

    expect(text).toContain('1. 952 (J10)');
    expect(text).not.toContain('Added');
  });
});
