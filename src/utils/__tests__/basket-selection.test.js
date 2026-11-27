/**
 * Tests for temporary Collection selection helpers.
 */

import {
  areAllVisibleSelected,
  pruneSelectedIds,
  removeSelectedIds,
  selectVisibleIds,
  toggleSelectedId,
} from '@/utils/basket-selection';

describe('basket selection helpers', () => {
  it('toggles one digit without mutating the original Set', () => {
    const original = new Set(['074', '638']);

    const added = toggleSelectedId(original, '129');
    expect([...added]).toEqual(['074', '638', '129']);
    expect([...original]).toEqual(['074', '638']);

    const removed = toggleSelectedId(added, '074');
    expect([...removed]).toEqual(['638', '129']);
    expect([...added]).toEqual(['074', '638', '129']);
  });

  it('ignores a missing digit when toggling', () => {
    const selected = new Set(['074']);
    expect([...toggleSelectedId(selected, null)]).toEqual(['074']);
    expect([...toggleSelectedId(selected, undefined)]).toEqual(['074']);
  });

  it('removes only the requested digit IDs', () => {
    const selected = new Set(['074', '638', '129']);
    const next = removeSelectedIds(selected, ['638', 'missing']);

    expect([...next]).toEqual(['074', '129']);
    expect([...selected]).toEqual(['074', '638', '129']);
  });

  it('selects visible IDs while keeping hidden selections and avoiding duplicates', () => {
    const selected = new Set(['074', 'hidden']);
    const next = selectVisibleIds(selected, ['074', '638', '638']);

    expect([...next]).toEqual(['074', 'hidden', '638']);
    expect([...selected]).toEqual(['074', 'hidden']);
  });

  it('prunes IDs that are no longer available', () => {
    const selected = new Set(['074', '638', 'missing']);
    const next = pruneSelectedIds(selected, ['074', '129']);

    expect([...next]).toEqual(['074']);
    expect([...selected]).toEqual(['074', '638', 'missing']);
  });

  it('reports whether every visible ID is selected', () => {
    expect(areAllVisibleSelected(new Set(['074', '638']), ['074', '638'])).toBe(true);
    expect(areAllVisibleSelected(new Set(['074']), ['074', '638'])).toBe(false);
    expect(areAllVisibleSelected(new Set(['074']), [])).toBe(false);
  });
});
