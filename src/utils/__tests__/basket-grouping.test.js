/**
 * Tests for date grouping on the Collection screen
 */

import { UNAVAILABLE_KEY, formatGroupTitle, groupBasketEntries } from '@/utils/basket-grouping';

const localStamp = (year, month, day, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).toISOString();

const entry = (digits, addedAt) => ({ digits, path: [{ row: 0, column: 0 }], addedAt });

describe('formatGroupTitle', () => {
  const now = new Date(2026, 10, 25, 12, 0);

  it('uses Today and Yesterday for adjacent local dates', () => {
    expect(formatGroupTitle(new Date(2026, 10, 25, 0, 30), now)).toBe('Today');
    expect(formatGroupTitle(new Date(2026, 10, 24, 23, 30), now)).toBe('Yesterday');
  });

  it('uses the full month name for older dates', () => {
    expect(formatGroupTitle(new Date(2026, 10, 23, 9, 0), now)).toBe('November 23, 2026');
  });

  it('handles the month and year boundary using local dates', () => {
    const newYear = new Date(2027, 0, 1, 12, 0);
    expect(formatGroupTitle(new Date(2026, 11, 31, 23, 30), newYear)).toBe('Yesterday');
    expect(formatGroupTitle(new Date(2027, 0, 1, 0, 30), newYear)).toBe('Today');
  });
});

describe('groupBasketEntries', () => {
  const now = new Date(2026, 10, 25, 12, 0);

  it('groups by local date, newest first inside and between groups', () => {
    const entries = [
      entry('111', localStamp(2026, 11, 23, 8, 0)),
      entry('333', localStamp(2026, 11, 25, 7, 0)),
      entry('222', localStamp(2026, 11, 24, 9, 0)),
      entry('444', localStamp(2026, 11, 25, 19, 30)),
      entry('555', localStamp(2026, 11, 25, 13, 15)),
    ];

    const sections = groupBasketEntries(entries, now);

    expect(sections.map((section) => section.title)).toEqual([
      'Today',
      'Yesterday',
      'November 23, 2026',
    ]);
    expect(sections.map((section) => section.count)).toEqual([3, 1, 1]);
    expect(sections.map((section) => section.index)).toEqual([0, 1, 2]);
    expect(sections[0].data.map((item) => item.digits)).toEqual(['444', '555', '333']);
    expect(entries.map((item) => item.digits)).toEqual(['111', '333', '222', '444', '555']);
  });

  it('places missing and invalid timestamps last in original order', () => {
    const entries = [
      { digits: 'old', path: [] },
      entry('today', localStamp(2026, 11, 25, 18, 0)),
      { digits: 'bad', path: [], addedAt: 'not a date' },
      { digits: 'empty', path: [], addedAt: '' },
    ];

    const sections = groupBasketEntries(entries, now);

    expect(sections[0].title).toBe('Today');
    expect(sections[1].key).toBe(UNAVAILABLE_KEY);
    expect(sections[1].title).toBe('Date unavailable');
    expect(sections[1].data.map((item) => item.digits)).toEqual(['old', 'bad', 'empty']);
    expect(entries[0]).toBe(sections[1].data[0]);
  });

  it('does not add fields to entries or change their timestamps', () => {
    const first = entry('074', localStamp(2026, 11, 25, 20, 35));
    const entries = [first];
    const before = JSON.stringify(entries);

    const sections = groupBasketEntries(entries, now);

    expect(sections[0].data[0]).toBe(first);
    expect(first).toEqual({ digits: '074', path: [{ row: 0, column: 0 }], addedAt: first.addedAt });
    expect(JSON.stringify(entries)).toBe(before);
    expect(Object.keys(sections[0]).sort()).toEqual(['count', 'data', 'index', 'key', 'title']);
  });

  it('returns no sections for an empty or missing list', () => {
    expect(groupBasketEntries([], now)).toEqual([]);
    expect(groupBasketEntries(null, now)).toEqual([]);
  });
});
