/**
 * Fun Pick result filters
 *
 * Filter buttons are checkboxes: options inside one group OR together,
 * groups AND together, and an empty group leaves the batch unrestricted.
 * Search ANDs with all groups. Every function here is a pure view over the
 * generated batch; nothing mutates or regenerates combinations.
 */

import {
  applyDistinct,
  applyFilter,
  applyFilters,
  applyFunPickView,
  clearFilterSelection,
  createFilterSelection,
  getFilterCounts,
  getPathDirection,
  getPathMovement,
  hasActiveFilters,
  parseSequenceQuery,
  toggleFilterSelection,
} from '../fun-pick-utils';

const combo = (digits, path) => ({ digits, path });

const BATCH = [
  // With 0/1/2, orthogonal, shaped Г, contains "01" and "12".
  combo('012', [
    { row: 0, column: 2 },
    { row: 0, column: 1 },
    { row: 1, column: 1 },
  ]),
  // With 2/3/4, diagonal, contains "34".
  combo('234', [
    { row: 0, column: 0 },
    { row: 1, column: 1 },
    { row: 2, column: 2 },
  ]),
  // With 6, orthogonal, no L shape.
  combo('678', [
    { row: 0, column: 3 },
    { row: 0, column: 4 },
    { row: 0, column: 5 },
  ]),
  // With 0/1/9, orthogonal, shaped L, contains "90".
  combo('901', [
    { row: 1, column: 0 },
    { row: 2, column: 0 },
    { row: 2, column: 1 },
  ]),
];

const digitsOf = (combinations) => combinations.map((item) => item.digits);

describe('checkbox filter state', () => {
  it('starts with every selectable option inactive', () => {
    const selection = createFilterSelection();
    expect(Object.values(selection).every((value) => value === false)).toBe(true);
    expect(hasActiveFilters(selection)).toBe(false);
  });

  it('toggles one option without resetting any other', () => {
    const first = toggleFilterSelection(createFilterSelection(), 'with-0');
    const second = toggleFilterSelection(first, 'direction-diagonal');

    expect(second['with-0']).toBe(true);
    expect(second['direction-diagonal']).toBe(true);

    const third = toggleFilterSelection(second, 'with-0');
    expect(third['with-0']).toBe(false);
    expect(third['direction-diagonal']).toBe(true);
  });

  it('ignores unknown values and clears all options together', () => {
    const selection = toggleFilterSelection(createFilterSelection(), 'distinct');
    expect(toggleFilterSelection(selection, 'not-a-filter')).toBe(selection);

    const cleared = clearFilterSelection();
    expect(hasActiveFilters(cleared)).toBe(false);
    expect(Object.values(cleared).every((value) => value === false)).toBe(true);
    expect(applyFilters(BATCH, cleared)).toBe(BATCH);
  });
});

describe('filter groups', () => {
  it('ORs multiple digit filters inside the digit group', () => {
    const selection = { 'with-0': true, 'with-2': true };
    expect(digitsOf(applyFilters(BATCH, selection))).toEqual(['012', '234', '901']);
  });

  it('ORs multiple direction filters inside the direction group', () => {
    const selection = {
      'direction-horizontal': true,
      'direction-vertical': true,
      'direction-diagonal': true,
      'direction-orthogonal': true,
    };
    expect(digitsOf(applyFilters(BATCH, selection))).toEqual(['012', '234', '678', '901']);
    expect(digitsOf(applyFilters(BATCH, { 'direction-horizontal': true }))).toEqual(['012', '678']);
    expect(digitsOf(applyFilters(BATCH, { 'direction-vertical': true }))).toEqual(['901']);
  });

  it('ORs multiple L-pattern filters inside the shape group', () => {
    const selection = { 'l-gamma': true, 'l-el': true };
    expect(digitsOf(applyFilters(BATCH, selection))).toEqual(['012', '901']);
  });

  it('ANDs active groups together', () => {
    const selection = {
      'with-0': true,
      'direction-orthogonal': true,
      'l-gamma': true,
    };
    expect(digitsOf(applyFilters(BATCH, selection))).toEqual(['012']);
  });

  it('classifies horizontal, vertical, and diagonal paths from coordinates', () => {
    expect(getPathMovement(BATCH[0].path)).toBe('horizontal');
    expect(getPathMovement(BATCH[1].path)).toBe('diagonal');
    expect(getPathMovement(BATCH[3].path)).toBe('vertical');
    expect(getPathDirection(BATCH[0].path)).toBe('orthogonal');
    expect(getPathDirection(BATCH[1].path)).toBe('diagonal');
    expect(getPathDirection([])).toBeNull();
  });

  it('counts every chip on the searched batch, including Distinct', () => {
    const counts = getFilterCounts(BATCH);
    expect(counts.find((option) => option.value === 'with-0').count).toBe(2);
    expect(counts.find((option) => option.value === 'direction-horizontal').count).toBe(2);
    expect(counts.find((option) => option.value === 'direction-vertical').count).toBe(1);
    expect(counts.find((option) => option.value === 'direction-diagonal').count).toBe(1);
    expect(counts.find((option) => option.value === 'direction-orthogonal').count).toBe(3);
    expect(counts.find((option) => option.value === 'distinct').count).toBe(4);
  });
});

describe('Distinct', () => {
  it('keeps one representative per sorted-digit group', () => {
    const batch = [
      combo('312', []),
      combo('231', []),
      combo('123', []),
      combo('112', []),
      combo('121', []),
      combo('211', []),
      combo('077', []),
      combo('707', []),
      combo('770', []),
    ];
    expect(digitsOf(applyDistinct(batch))).toEqual(['123', '112', '077']);
  });

  it('prefers a generated canonical group even when it appears later', () => {
    expect(digitsOf(applyDistinct([combo('312', []), combo('231', []), combo('123', [])]))).toEqual([
      '123',
    ]);
  });

  it('falls back to the first generated representative and never invents digits', () => {
    const batch = [combo('312', []), combo('213', [])];
    expect(digitsOf(applyDistinct(batch))).toEqual(['312']);
  });

  it('preserves multiplicity and leading zeros in the sorted key', () => {
    const batch = [combo('07', []), combo('70', []), combo('007', []), combo('070', [])];
    // "07" and "70" share one zero; "007" and "070" share two.
    expect(digitsOf(applyDistinct(batch))).toEqual(['07', '007']);
  });

  it('applies after the other filter groups', () => {
    const batch = [combo('123', []), combo('231', []), combo('077', []), combo('707', [])];
    const selection = { 'with-0': true, distinct: true };
    expect(digitsOf(applyFilters(batch, selection))).toEqual(['077']);
    expect(digitsOf(applyFilter(batch, 'distinct'))).toEqual(['123', '077']);
  });
});

describe('search and filters together', () => {
  it('requires every parsed sequence and ANDs with active filters', () => {
    const selection = { 'with-2': true, 'direction-orthogonal': true };
    expect(digitsOf(applyFunPickView(BATCH, selection, ['01', '12']))).toEqual(['012']);
    expect(digitsOf(applyFunPickView(BATCH, selection, ['01', '12', '90']))).toEqual([]);
  });

  it('keeps the existing sequence query rules', () => {
    expect(parseSequenceQuery(' 12, ,12 , 90 ')).toEqual({
      valid: true,
      sequences: ['12', '90'],
    });
    expect(parseSequenceQuery('12a')).toEqual({ valid: false, sequences: [] });
  });

  it('never mutates the generated batch', () => {
    const before = JSON.stringify(BATCH);
    applyFunPickView(BATCH, { distinct: true, 'with-0': true }, ['0']);
    applyFilters(BATCH, { 'direction-diagonal': true });
    expect(JSON.stringify(BATCH)).toBe(before);
  });
});
