/**
 * Tests for temporary Collection selection state.
 */

import { useCollectionSelectionStore } from '@/store/collectionSelectionStore';
import { selectionModeProgress } from '@/store/collectionSelectionVisuals';

function resetStore() {
  useCollectionSelectionStore.setState({ selectionMode: false, selectedIds: new Set() });
}

describe('collectionSelectionStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('syncs native visuals without re-rendering rows', () => {
    expect(selectionModeProgress.get()).toBe(0);

    useCollectionSelectionStore.getState().startSelection();
    expect(selectionModeProgress.get()).toBe(1);

    useCollectionSelectionStore.getState().cancelSelection();
    expect(selectionModeProgress.get()).toBe(0);
  });

  it('starts and cancels selection mode with a clean Set', () => {
    useCollectionSelectionStore.getState().startSelection();
    expect(useCollectionSelectionStore.getState().selectionMode).toBe(true);
    expect([...useCollectionSelectionStore.getState().selectedIds]).toEqual([]);

    useCollectionSelectionStore.getState().toggleSelected('074');
    useCollectionSelectionStore.getState().cancelSelection();

    expect(useCollectionSelectionStore.getState().selectionMode).toBe(false);
    expect([...useCollectionSelectionStore.getState().selectedIds]).toEqual([]);
  });

  it('ignores toggles outside selection mode or without an ID', () => {
    const before = useCollectionSelectionStore.getState().selectedIds;

    useCollectionSelectionStore.getState().toggleSelected('074');
    useCollectionSelectionStore.getState().toggleSelected(null);
    expect(useCollectionSelectionStore.getState().selectedIds).toBe(before);

    useCollectionSelectionStore.getState().startSelection();
    const empty = useCollectionSelectionStore.getState().selectedIds;
    useCollectionSelectionStore.getState().toggleSelected(undefined);
    expect(useCollectionSelectionStore.getState().selectedIds).toBe(empty);
  });

  it('toggles one digit without mutating the previous Set', () => {
    useCollectionSelectionStore.getState().startSelection();
    useCollectionSelectionStore.getState().toggleSelected('074');
    const once = useCollectionSelectionStore.getState().selectedIds;
    expect([...once]).toEqual(['074']);

    useCollectionSelectionStore.getState().toggleSelected('638');
    expect([...useCollectionSelectionStore.getState().selectedIds]).toEqual([
      '074',
      '638',
    ]);
    expect([...once]).toEqual(['074']);

    useCollectionSelectionStore.getState().toggleSelected('074');
    expect([...useCollectionSelectionStore.getState().selectedIds]).toEqual(['638']);
  });

  it('selects visible IDs while retaining hidden selections', () => {
    useCollectionSelectionStore.getState().startSelection();
    useCollectionSelectionStore.getState().toggleSelected('hidden');
    useCollectionSelectionStore.getState().selectVisible(['074', '638', '638']);

    expect([...useCollectionSelectionStore.getState().selectedIds]).toEqual([
      'hidden',
      '074',
      '638',
    ]);
  });

  it('does not replace the Set when every visible ID is already selected', () => {
    useCollectionSelectionStore.getState().startSelection();
    useCollectionSelectionStore.getState().selectVisible(['074', '638']);
    const before = useCollectionSelectionStore.getState().selectedIds;

    useCollectionSelectionStore.getState().selectVisible(['074', '638']);
    expect(useCollectionSelectionStore.getState().selectedIds).toBe(before);
  });

  it('ignores an empty visible list', () => {
    useCollectionSelectionStore.getState().startSelection();
    const before = useCollectionSelectionStore.getState().selectedIds;

    useCollectionSelectionStore.getState().selectVisible([]);
    expect(useCollectionSelectionStore.getState().selectedIds).toBe(before);
  });

  it('prunes only IDs that are no longer available', () => {
    useCollectionSelectionStore.getState().startSelection();
    useCollectionSelectionStore.getState().selectVisible(['074', '638', 'missing']);
    useCollectionSelectionStore.getState().pruneAvailable(['074', '129']);

    expect([...useCollectionSelectionStore.getState().selectedIds]).toEqual(['074']);
  });

  it('does not replace the Set when pruning removes nothing', () => {
    useCollectionSelectionStore.getState().startSelection();
    useCollectionSelectionStore.getState().selectVisible(['074', '638']);
    const before = useCollectionSelectionStore.getState().selectedIds;

    useCollectionSelectionStore.getState().pruneAvailable(['074', '638', '129']);
    expect(useCollectionSelectionStore.getState().selectedIds).toBe(before);
  });

  it('removes only the requested IDs from the temporary selection', () => {
    useCollectionSelectionStore.getState().startSelection();
    useCollectionSelectionStore.getState().selectVisible(['074', '638', '129']);
    useCollectionSelectionStore.getState().removeSelected(['638', 'missing']);

    expect([...useCollectionSelectionStore.getState().selectedIds]).toEqual([
      '074',
      '129',
    ]);
  });

  it('does not replace the Set when removal changes nothing', () => {
    useCollectionSelectionStore.getState().startSelection();
    useCollectionSelectionStore.getState().selectVisible(['074']);
    const before = useCollectionSelectionStore.getState().selectedIds;

    useCollectionSelectionStore.getState().removeSelected(['missing']);
    expect(useCollectionSelectionStore.getState().selectedIds).toBe(before);
  });

  it('clears the Set without leaving selection mode and no-ops when empty', () => {
    useCollectionSelectionStore.getState().startSelection();
    useCollectionSelectionStore.getState().selectVisible(['074']);
    useCollectionSelectionStore.getState().clearSelection();

    expect(useCollectionSelectionStore.getState().selectionMode).toBe(true);
    expect([...useCollectionSelectionStore.getState().selectedIds]).toEqual([]);

    const before = useCollectionSelectionStore.getState().selectedIds;
    useCollectionSelectionStore.getState().clearSelection();
    expect(useCollectionSelectionStore.getState().selectedIds).toBe(before);
  });
});
