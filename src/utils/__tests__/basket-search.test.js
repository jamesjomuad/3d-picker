/**
 * Tests for Collection search
 */

import { filterBasketEntries } from '@/utils/basket-search';

const makeEntry = (digits, path) => ({ digits, path, addedAt: '2026-11-25T12:00:00.000Z' });

describe('filterBasketEntries', () => {
  const entries = [
    makeEntry('074', [
      { row: 0, column: 0 },
      { row: 3, column: 1 },
    ]),
    makeEntry('740', [{ row: 1, column: 2 }]),
    makeEntry('638', [
      { row: 4, column: 3 },
      { row: 9, column: 9 },
    ]),
  ];

  it('returns the untouched list for an empty query', () => {
    expect(filterBasketEntries(entries, '')).toBe(entries);
    expect(filterBasketEntries(entries, '   ')).toBe(entries);
    expect(filterBasketEntries(entries, null)).toBe(entries);
  });

  it('matches partial digit sequences and keeps leading zeros', () => {
    expect(filterBasketEntries(entries, '74').map((item) => item.digits)).toEqual(['074', '740']);
    expect(filterBasketEntries(entries, '074').map((item) => item.digits)).toEqual(['074']);
    expect(filterBasketEntries(entries, '638').map((item) => item.digits)).toEqual(['638']);
  });

  it('matches a single coordinate with any case or separator', () => {
    expect(filterBasketEntries(entries, 'A1').map((item) => item.digits)).toEqual(['074']);
    expect(filterBasketEntries(entries, 'a1').map((item) => item.digits)).toEqual(['074']);
    expect(filterBasketEntries(entries, 'D5').map((item) => item.digits)).toEqual(['638']);
  });

  it('matches coordinate paths as a run or as separate tokens', () => {
    expect(filterBasketEntries(entries, 'A1B4').map((item) => item.digits)).toEqual(['074']);
    expect(filterBasketEntries(entries, 'a1,b4').map((item) => item.digits)).toEqual(['074']);
    expect(filterBasketEntries(entries, '  A1 → B4  ').map((item) => item.digits)).toEqual(['074']);
    expect(filterBasketEntries(entries, 'D5J10').map((item) => item.digits)).toEqual(['638']);
  });

  it('requires every token to match and never mutates entries', () => {
    const before = JSON.stringify(entries);
    expect(filterBasketEntries(entries, '74 B4').map((item) => item.digits)).toEqual(['074']);
    expect(filterBasketEntries(entries, '074 D5')).toEqual([]);
    expect(JSON.stringify(entries)).toBe(before);
  });

  it('handles invalid input safely', () => {
    expect(filterBasketEntries(null, '074')).toEqual([]);
    expect(filterBasketEntries(entries, undefined)).toBe(entries);
  });
});
