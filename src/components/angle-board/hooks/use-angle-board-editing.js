import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { parseDigit } from '@/utils/board-validation';

/**
 * Cell editing state for a board in editable mode.
 *
 * Which cell is open and what has been typed into it are pure interaction state:
 * nothing outside this board cares, and two boards on screen must not share one
 * editor. So they live here, in component state, not in a store.
 *
 * Validation goes through `parseDigit`, the same digit rule `validateGrid` uses,
 * so a committed edit can never put an off-board value into the grid.
 *
 * @param {Object} options
 * @param {(changes: Object<string, number>) => void} [options.onCellChange] -
 *   receives the same map of `"row,col" -> digit` a fill does, so one edit and a
 *   hundred look the same to the owner
 * @returns {{ editingCell: {row: number, col: number}|null, editValue: string, setEditValue: Function, beginEdit: Function, commitEdit: Function, cancelEdit: Function }}
 */
export function useAngleBoardEditing({ onCellChange }) {
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  // Both the field and the screen can commit the same edit. Guard against a
  // stale blur handler writing an already-finished edit a second time.
  const committed = useRef(true);

  const closeEditor = useCallback(() => {
    committed.current = true;
    setEditingCell(null);
    setEditValue('');
  }, []);

  /**
   * Open an empty field on a cell so typing replaces the current digit.
   * @param {number} row
   * @param {number} col
   */
  const beginEdit = useCallback((row, col) => {
    committed.current = false;
    setEditingCell({ row, col });
    setEditValue('');
  }, []);

  /**
   * Write the typed digit, or reject it. Invalid input alerts and closes without
   * touching the grid, so the old digit stays.
   */
  const commitEdit = useCallback(() => {
    if (!editingCell || committed.current) return;
    committed.current = true;

    const digit = parseDigit(editValue);
    if (digit === null) {
      Alert.alert('Invalid Value', 'Please enter a digit from 0 to 9');
    } else {
      // Same shape a fill produces: a map of "row,col" -> digit.
      onCellChange?.({ [`${editingCell.row},${editingCell.col}`]: digit });
    }

    closeEditor();
  }, [editingCell, editValue, onCellChange, closeEditor]);

  return { editingCell, editValue, setEditValue, beginEdit, commitEdit, cancelEdit: closeEditor };
}
