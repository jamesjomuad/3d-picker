/**
 * Collection selection helpers
 *
 * Temporary multi-select state for the Collection screen. Digits are the
 * basket's stable identity, so every helper works with digit IDs, never row
 * indexes. Sets are copied before changes: selection is local UI state and
 * never mutates the persisted basket or another render's state.
 */

/**
 * Make a new Set from a Set or array without keeping the old reference.
 *
 * @param {Set<string>|Array<string>|null|undefined} ids
 * @returns {Set<string>}
 */
function copyIds(ids) {
  if (ids instanceof Set) return new Set(ids);
  return new Set(Array.isArray(ids) ? ids : []);
}

/**
 * Toggle one digit ID.
 *
 * @param {Set<string>|Array<string>} selectedIds
 * @param {string} id
 * @returns {Set<string>} a new Set
 */
export function toggleSelectedId(selectedIds, id) {
  const next = copyIds(selectedIds);
  if (id === null || id === undefined) return next;
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * Remove one or more digit IDs.
 *
 * @param {Set<string>|Array<string>} selectedIds
 * @param {Array<string>} ids
 * @returns {Set<string>} a new Set
 */
export function removeSelectedIds(selectedIds, ids) {
  const next = copyIds(selectedIds);
  if (!Array.isArray(ids)) return next;
  for (const id of ids) next.delete(id);
  return next;
}

/**
 * Add every currently visible digit ID. Hidden selections stay selected.
 *
 * @param {Set<string>|Array<string>} selectedIds
 * @param {Array<string>} visibleIds
 * @returns {Set<string>} a new Set
 */
export function selectVisibleIds(selectedIds, visibleIds) {
  const next = copyIds(selectedIds);
  if (!Array.isArray(visibleIds)) return next;
  for (const id of visibleIds) next.add(id);
  return next;
}

/**
 * Drop IDs no longer present in the basket.
 *
 * @param {Set<string>|Array<string>} selectedIds
 * @param {Array<string>} availableIds
 * @returns {Set<string>} a new Set
 */
export function pruneSelectedIds(selectedIds, availableIds) {
  const next = copyIds(selectedIds);
  const available = new Set(Array.isArray(availableIds) ? availableIds : []);
  for (const id of next) {
    if (!available.has(id)) next.delete(id);
  }
  return next;
}

/**
 * Whether every currently visible digit ID is selected.
 *
 * @param {Set<string>|Array<string>} selectedIds
 * @param {Array<string>} visibleIds
 * @returns {boolean}
 */
export function areAllVisibleSelected(selectedIds, visibleIds) {
  if (!Array.isArray(visibleIds) || visibleIds.length === 0) return false;
  const selected = copyIds(selectedIds);
  return visibleIds.every((id) => selected.has(id));
}
