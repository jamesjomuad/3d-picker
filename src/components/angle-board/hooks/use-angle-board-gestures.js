import { useCallback, useEffect, useState } from 'react';
import { PanResponder } from 'react-native';

import {
  DEFAULT_CELL_SIZE,
  HEADER_HEIGHT,
  HEADER_WIDTH,
  calculateCellSize,
} from '@/utils/board-layout';
import { getDragCells, getFillSource } from '@/utils/board-fill';
import {
  calculateColSelection,
  calculateRectSelection,
  calculateRowSelection,
  clamp,
  touchToCell,
  touchToDragState,
} from '@/utils/selection';

/**
 * What a finished drag means, given how the board is being used.
 *
 * - Read-only: the drag commits a selection, exactly as a spreadsheet cursor does.
 * - Editable: a drag across more than one cell fills digits (the fill handle); a
 *   drag that never left its starting cell is a tap, which opens that cell's field.
 *
 * Pure, so the rule is testable without a touch screen.
 *
 * @param {Object} options
 * @param {number[][]} options.grid
 * @param {Set<string>} [options.selection] - selection as it stands when the drag ends
 * @param {Object|null} options.drag - the finished drag state
 * @param {boolean} options.editable
 * @returns {{ type: 'selection', cells: Set<string> }|{ type: 'fill', source: Object, target: Object }|{ type: 'tap', cell: { row: number, col: number } }|null}
 */
export function getGestureOutcome({ grid, selection, drag, editable }) {
  if (!drag || !grid || !grid.length) return null;

  const totalRows = grid.length;
  const totalCols = grid[0].length;
  const { startRow, startCol, endRow, endCol, mode } = drag;

  if (editable) {
    const target = { startRow, startCol, endRow, endCol, mode };
    const cells = getDragCells(target, totalRows, totalCols);

    if (mode === 'cell' && cells.length === 1) {
      return { type: 'tap', cell: cells[0] };
    }
    return { type: 'fill', source: getFillSource(grid, selection, target), target };
  }

  // A single-cell tap is just a one-cell rectangle, so it needs no special case
  // beyond what the engine already does.
  const cells =
    mode === 'row'
      ? calculateRowSelection(startRow, endRow, totalRows, totalCols)
      : mode === 'col'
        ? calculateColSelection(startCol, endCol, totalRows, totalCols)
        : calculateRectSelection(startRow, startCol, endRow, endCol, totalRows, totalCols);

  return { type: 'selection', cells };
}

/**
 * The pieces a drag needs that must survive a render without becoming React
 * state. The PanResponder is created once (a new responder per render would
 * re-attach native responders and interrupt a drag in progress), so instead of
 * closing over first-render props it reads them from this object, which is
 * re-bound after every render.
 *
 * COORDINATE CONTRACT — the caller must keep `pointerEvents="none"` on every
 * child of the view that receives `panHandlers`.
 *
 * React Native reports `locationX`/`locationY` relative to the deepest view that
 * was touched, NOT relative to the view that owns the responder (BaseTouch.cpp on
 * Fabric, RCTTouchHandler on iOS, TouchesHelper on Android). Without the
 * pointerEvents props the touched view is a single cell, so locationX/Y arrive as
 * ~0..cellSize, `x - HEADER_WIDTH` underflows, and `touchToCell()` returns null:
 * no selection can ever start. Marking the children `pointerEvents="none"` makes
 * the container itself the touch target, which puts locationX/Y back in container
 * space. This is the bug documented in
 * `docs/reports/Drag Selection - Root Cause and Fix.md`.
 *
 * The contract holds in editable mode too, which is why taps and fills are read
 * from the gesture rather than from a touch handler on each cell.
 */
function createAngleBoardGesture() {
  /** Latest props and measurements, as of the most recent commit. */
  const latest = {
    grid: [],
    selection: null,
    editable: false,
    onSelectionChange: undefined,
    onFill: undefined,
    onTap: undefined,
    cellSize: DEFAULT_CELL_SIZE,
    drag: null,
    setDragState: () => {},
  };

  /** Board dimensions as of the current touch, never a stale snapshot. */
  const getDimensions = () => getGridDimensions(latest.grid);

  const setDrag = (next) => {
    latest.drag = next;
    latest.setDragState(next);
  };

  /**
   * Report the finished drag. Runs from the event handler, not inside a setState
   * updater: updaters run during render, and notifying a parent there updates its
   * subscribers mid-render.
   */
  const finishDrag = () => {
    const drag = latest.drag;
    setDrag(null);
    if (!drag) return;

    const outcome = getGestureOutcome({
      grid: latest.grid,
      selection: latest.selection,
      drag,
      editable: latest.editable,
    });
    if (!outcome) return;

    if (outcome.type === 'fill') latest.onFill?.(outcome);
    else if (outcome.type === 'tap') latest.onTap?.(outcome.cell);
    else latest.onSelectionChange?.(outcome.cells);
  };

  const panResponder = PanResponder.create({
    // Capture phase: claim touches BEFORE a ScrollView can intercept them.
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: () => true,

    // Bubble phase fallback.
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,

    onPanResponderGrant: (evt) => {
      const { totalRows, totalCols } = getDimensions();
      const { locationX, locationY } = evt.nativeEvent;
      const drag = touchToDragState(
        locationX,
        locationY,
        HEADER_WIDTH,
        HEADER_HEIGHT,
        latest.cellSize,
        totalRows,
        totalCols
      );
      if (!drag) return;

      if (!latest.editable) {
        // Excel-like: a new gesture replaces the previous selection. The drag
        // preview is what the user sees until it commits, so clearing here is what
        // keeps the old selection from flashing back on release. Editing keeps its
        // selection instead: that block is the pattern the fill copies.
        latest.onSelectionChange?.(new Set());
      }
      setDrag(drag);
    },

    onPanResponderMove: (evt) => {
      const drag = latest.drag;
      if (!drag) return;

      const { totalRows, totalCols } = getDimensions();
      const { locationX, locationY } = evt.nativeEvent;
      const size = latest.cellSize;

      if (drag.mode === 'row') {
        const gridY = locationY - HEADER_HEIGHT;
        if (gridY < 0) return;
        setDrag({ ...drag, endRow: clamp(Math.floor(gridY / size), 0, totalRows - 1) });
        return;
      }

      if (drag.mode === 'col') {
        const gridX = locationX - HEADER_WIDTH;
        if (gridX < 0) return;
        setDrag({ ...drag, endCol: clamp(Math.floor(gridX / size), 0, totalCols - 1) });
        return;
      }

      const cell = touchToCell(
        locationX,
        locationY,
        HEADER_WIDTH,
        HEADER_HEIGHT,
        size,
        totalRows,
        totalCols
      );
      if (!cell) return;
      setDrag({ ...drag, endRow: cell.row, endCol: cell.col });
    },

    onPanResponderRelease: () => finishDrag(),

    // A forced termination (parent navigator, native modal) must not leave the
    // gesture stuck in a half-finished state.
    onPanResponderTerminate: () => finishDrag(),

    // Prevent ScrollView from terminating our gesture.
    onPanResponderTerminationRequest: () => false,
  });

  return {
    panHandlers: panResponder.panHandlers,
    /**
     * Folds the board's current props into what the handlers read. Encapsulated
     * here so the hook never mutates a value React handed it.
     * @param {Object} next
     */
    bind: (next) => {
      Object.assign(latest, next);
    },
  };
}

/**
 * Drag selection for the Angle Board: measures the board, tracks the gesture,
 * and reports what the drag meant — a new selection, a fill, or a tap.
 *
 * Nothing here is store- or screen-aware. The transient bits (`cellSize`,
 * `dragState`) stay component state on purpose — they only matter while a finger
 * is down, and putting them in a store would make every board on screen react to
 * someone else's drag.
 *
 * @param {Object} options
 * @param {number[][]} options.grid - board being dragged on, read at touch time
 * @param {Set<string>} [options.selection] - current selection, read at touch time
 * @param {boolean} [options.editable] - drags fill instead of selecting
 * @param {(cells: Set<string>) => void} [options.onSelectionChange]
 * @param {(fill: { source: Object, target: Object }) => void} [options.onFill]
 * @param {(cell: { row: number, col: number }) => void} [options.onTap]
 * @returns {{ cellSize: number, dragState: Object|null, handleLayout: Function, panHandlers: Object }}
 */
export function useAngleBoardGestures({
  grid,
  selection,
  editable = false,
  onSelectionChange,
  onFill,
  onTap,
}) {
  // Created once per board; it holds what the gesture reads between renders.
  const [gesture] = useState(createAngleBoardGesture);
  const [cellSize, setCellSize] = useState(DEFAULT_CELL_SIZE);
  const [dragState, setDragState] = useState(null);

  // Keep the gesture in step with what the board currently looks like. Effect
  // timing is fine: a touch always lands after the render that placed it.
  useEffect(() => {
    gesture.bind({
      grid,
      selection,
      editable,
      onSelectionChange,
      onFill,
      onTap,
      cellSize,
      setDragState,
    });
  }, [gesture, grid, selection, editable, onSelectionChange, onFill, onTap, cellSize]);

  /**
   * Measures the available width (the wrapper stretches to the screen's content
   * width) so the board always fits instead of overflowing on narrow devices. The
   * container itself is only as wide as its children, so measuring it would just
   * report the size we already chose.
   */
  const handleLayout = useCallback(
    (e) => {
      const { width } = e.nativeEvent.layout;
      const available = width - HEADER_WIDTH;
      if (available <= 0) return;

      const { totalCols } = getGridDimensions(grid);
      const size = calculateCellSize(available, totalCols);
      gesture.bind({ cellSize: size });
      setCellSize(size);
    },
    [gesture, grid]
  );

  return { cellSize, dragState, handleLayout, panHandlers: gesture.panHandlers };
}

/** Row/column counts of a grid, tolerating an empty one. */
function getGridDimensions(grid) {
  return { totalRows: grid.length, totalCols: grid[0]?.length ?? 0 };
}
