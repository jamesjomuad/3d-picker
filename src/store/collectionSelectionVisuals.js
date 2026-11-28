import { makeMutable } from 'react-native-reanimated';

/**
 * Native-only channel for Collection selection mode.
 *
 * SelectionMode changes used to re-render every row so each checkbox could
 * flip from hidden to visible. Rows now style themselves from these shared
 * values. The mode change animates on the UI thread and does not re-render the
 * list, while row-level `checked` subscriptions stay in React for exact,
 * isolated toggles.
 */

/** 0 = browse mode, 1 = selection mode. */
export const selectionModeProgress = makeMutable(0);

/** Sync native visuals after any selection-mode state change. */
export function setSelectionModeVisual(active) {
  selectionModeProgress.set(Boolean(active) ? 1 : 0);
}
