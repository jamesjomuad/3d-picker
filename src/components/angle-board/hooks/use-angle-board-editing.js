import { useCallback, useEffect, useRef, useState } from 'react';
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
 * @param {number[][]} options.grid - read at press time to seed the field
 * @param {(changes: Object<string, number>) => void} [options.onCellChange] -
 *   receives the same map of `"row,col" -> digit` a fill does, so one edit and a
 *   hundred look the same to the owner
 * @returns {{ editingCell: {row: number, col: number}|null, editValue: string, setEditValue: Function, beginEdit: Function, commitEdit: Function, cancelEdit: Function }}
 */
export function useAngleBoardEditing({ grid, onCellChange }) {
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Read through a ref so `beginEdit` keeps a stable identity while the grid
  // object changes on every committed edit.
  const gridRef = useRef(grid);
  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  const closeEditor = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  /**
   * Open the field on a cell, seeded with its current digit.
   * @param {number} row
   * @param {number} col
   */
  const beginEdit = useCallback((row, col) => {
    setEditingCell({ row, col });
    setEditValue(String(gridRef.current[row][col]));
  }, []);

  /**
   * Write the typed digit, or reject it. Invalid input alerts and closes without
   * touching the grid, so the old digit stays.
   */
  const commitEdit = useCallback(() => {
    if (!editingCell) return;

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
