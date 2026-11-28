import { create } from 'zustand';

import { setSelectionModeVisual } from '@/store/collectionSelectionVisuals';
import {
  areAllVisibleSelected,
  pruneSelectedIds,
  removeSelectedIds,
  selectVisibleIds,
  toggleSelectedId,
} from '@/utils/basket-selection';

/**
 * Temporary Collection selection state.
 *
 * This store is deliberately not persisted and never touches the basket.
 * Selection uses stable digit IDs so hidden search results can stay selected
 * and bulk removal still targets exact entries. Keeping selection here lets
 * each row subscribe to its own checked flag; toggling one row does not change
 * props on every group card or row.
 */
const useCollectionSelectionStore = create((set, get) => ({
  /** @type {boolean} Whether checkbox selection UI is active */
  selectionMode: false,

  /** @type {Set<string>} Temporarily selected digit IDs */
  selectedIds: new Set(),

  /** Enter selection mode with a clean selection. */
  startSelection: () => set({ selectionMode: true, selectedIds: new Set() }),

  /** Leave selection mode and clear temporary state. */
  cancelSelection: () => set({ selectionMode: false, selectedIds: new Set() }),

  /**
   * Toggle one digit ID while selection mode is active.
   * @param {string} id
   */
  toggleSelected: (id) => {
    const { selectionMode, selectedIds } = get();
    if (!selectionMode || id === null || id === undefined) return;
    set({ selectedIds: toggleSelectedId(selectedIds, id) });
  },

  /**
   * Add visible digit IDs while keeping already-selected hidden IDs.
   * @param {Array<string>} visibleIds
   */
  selectVisible: (visibleIds) => {
    const { selectionMode, selectedIds } = get();
    if (!selectionMode || !Array.isArray(visibleIds) || visibleIds.length === 0) return;
    if (areAllVisibleSelected(selectedIds, visibleIds)) return;
    const next = selectVisibleIds(selectedIds, visibleIds);
    if (next.size === selectedIds.size) return;
    set({ selectedIds: next });
  },

  /**
   * Drop IDs that no longer exist in the basket.
   * @param {Array<string>} availableIds
   */
  pruneAvailable: (availableIds) => {
    const { selectedIds } = get();
    if (selectedIds.size === 0) return;
    const next = pruneSelectedIds(selectedIds, availableIds);
    if (next.size === selectedIds.size) return;
    set({ selectedIds: next });
  },

  /**
   * Remove digit IDs from the temporary selection.
   * @param {Array<string>} ids
   */
  removeSelected: (ids) => {
    const { selectedIds } = get();
    if (!Array.isArray(ids) || ids.length === 0 || selectedIds.size === 0) return;
    const next = removeSelectedIds(selectedIds, ids);
    if (next.size === selectedIds.size) return;
    set({ selectedIds: next });
  },

  /** Clear temporary selection without changing mode. */
  clearSelection: () => {
    if (get().selectedIds.size === 0) return;
    set({ selectedIds: new Set() });
  },
}));

// Mode changes drive native row visuals without re-rendering the list. Keep
// direct setState calls in tests in sync with the same channel.
useCollectionSelectionStore.subscribe((state, previous) => {
  if (state.selectionMode !== previous.selectionMode) {
    setSelectionModeVisual(state.selectionMode);
  }
});

export { useCollectionSelectionStore };
