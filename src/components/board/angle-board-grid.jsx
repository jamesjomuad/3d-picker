import { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

import { AngleBoardCell } from './angle-board-cell';

import { useTheme } from '@/hooks/use-theme';
import { getColumnLetter } from '@/utils/cell-reference';
import { getDragHighlights, getSelectedRowsAndCols, touchToCell, touchToDragState } from '@/utils/selection';
import { useBoardStore } from '@/store/boardStore';

const HEADER_WIDTH = 28;
const HEADER_HEIGHT = 24;
const DEFAULT_CELL_SIZE = 35;
const MIN_CELL_SIZE = 24;
const MAX_CELL_SIZE = 50;

/**
 * Angle Board grid component with drag selection
 * Renders column headers, row headers, and the 2D digit grid
 *
 * Supports:
 * - Single-cell tap selection
 * - Rectangular drag selection
 * - Row-header selection (drag across row headers)
 * - Column-header selection (drag across column headers)
 *
 * @param {Object} props
 * @param {Object} props.board - The board object with name and grid
 */
export function AngleBoardGrid({ board }) {
  const theme = useTheme();
  const totalRows = board.grid.length;
  const totalCols = board.grid[0].length;

  const selectedCells = useBoardStore((state) => state.selectedCells);
  const selectCell = useBoardStore((state) => state.selectCell);
  const selectRect = useBoardStore((state) => state.selectRect);
  const selectRows = useBoardStore((state) => state.selectRows);
  const selectCols = useBoardStore((state) => state.selectCols);
  const clearSelection = useBoardStore((state) => state.clearSelection);

  const [cellSize, setCellSize] = useState(DEFAULT_CELL_SIZE);
  const cellSizeRef = useRef(DEFAULT_CELL_SIZE);

  const [dragState, setDragState] = useState(null);
  // Mirror of dragState, readable synchronously inside gesture callbacks.
  // The PanResponder is created once, so it cannot close over state.
  const dragStateRef = useRef(null);

  // Track committed selection's row/col highlights
  const committedHighlights = useMemo(
    () => getSelectedRowsAndCols(selectedCells),
    [selectedCells]
  );

  // Track drag highlights
  const dragHighlights = useMemo(
    () => getDragHighlights(dragState, totalRows, totalCols),
    [dragState, totalRows, totalCols]
  );

  // Active highlights: prefer drag during gesture, committed otherwise
  const activeRowHighlights = dragState ? dragHighlights.rows : committedHighlights.rows;
  const activeColHighlights = dragState ? dragHighlights.cols : committedHighlights.cols;

  // PanResponder for drag selection.
  //
  // COORDINATE CONTRACT — do not remove the `pointerEvents="none"` props from
  // the container's children below.
  // React Native reports `locationX`/`locationY` relative to the deepest view
  // that was touched, NOT relative to the view that owns the responder
  // (BaseTouch.cpp on Fabric, RCTTouchHandler on iOS, TouchesHelper on Android).
  // Without the pointerEvents props, the touched view is a single cell, so
  // locationX/Y arrive as ~0..cellSize, `x - HEADER_WIDTH` underflows, and
  // touchToCell() returns null: no selection can ever start. Marking every
  // child `pointerEvents="none"` makes the container itself the touch target,
  // which is what puts locationX/Y back into container space.
  //
  // The PanResponder is created once and only reads refs plus stable store
  // actions, so it can never hold a stale closure.
  /* eslint-disable react-hooks/refs */
  const panResponder = useRef(
    (() => {
      const updateDrag = (next) => {
        dragStateRef.current = next;
        setDragState(next);
      };

      // Commit on release/terminate. Reads the gesture from the ref instead of
      // inside a setState updater: updaters run during render, and calling a
      // store action from there updates subscribers mid-render.
      const finishDrag = () => {
        const drag = dragStateRef.current;
        updateDrag(null);
        if (!drag) return;

        const { startRow, startCol, endRow, endCol, mode } = drag;

        if (mode === 'row') {
          selectRows(startRow, endRow, totalRows, totalCols);
        } else if (mode === 'col') {
          selectCols(startCol, endCol, totalRows, totalCols);
        } else if (startRow === endRow && startCol === endCol) {
          selectCell(startRow, startCol);
        } else {
          selectRect(startRow, startCol, endRow, endCol, totalRows, totalCols);
        }
      };

      return PanResponder.create({
        // Capture phase: claim touches BEFORE ScrollView can intercept
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,

        // Bubble phase fallback
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const drag = touchToDragState(
            locationX,
            locationY,
            HEADER_WIDTH,
            HEADER_HEIGHT,
            cellSizeRef.current,
            totalRows,
            totalCols
          );
          if (!drag) return;

          clearSelection();
          updateDrag(drag);
        },

        onPanResponderMove: (evt) => {
          const drag = dragStateRef.current;
          if (!drag) return;

          const { locationX, locationY } = evt.nativeEvent;
          const cs = cellSizeRef.current;

          if (drag.mode === 'row') {
            const gridY = locationY - HEADER_HEIGHT;
            if (gridY < 0) return;
            const row = Math.max(0, Math.min(totalRows - 1, Math.floor(gridY / cs)));
            updateDrag({ ...drag, endRow: row });
            return;
          }

          if (drag.mode === 'col') {
            const gridX = locationX - HEADER_WIDTH;
            if (gridX < 0) return;
            const col = Math.max(0, Math.min(totalCols - 1, Math.floor(gridX / cs)));
            updateDrag({ ...drag, endCol: col });
            return;
          }

          const cell = touchToCell(
            locationX,
            locationY,
            HEADER_WIDTH,
            HEADER_HEIGHT,
            cs,
            totalRows,
            totalCols
          );
          if (!cell) return;
          updateDrag({ ...drag, endRow: cell.row, endCol: cell.col });
        },

        onPanResponderRelease: () => finishDrag(),

        // A forced termination (parent navigator, native modal) must not leave
        // the gesture stuck in a half-finished state.
        onPanResponderTerminate: () => finishDrag(),

        // Prevent ScrollView from terminating our gesture
        onPanResponderTerminationRequest: () => false,
      });
    })()
  ).current;
  /* eslint-enable react-hooks/refs */

  // Measures the available width (the wrapper stretches to the screen's
  // content width) so the board always fits instead of overflowing on narrow
  // devices. The container itself is only as wide as its children, so
  // measuring it would just report the size we already chose.
  const handleLayout = useCallback(
    (e) => {
      const { width } = e.nativeEvent.layout;
      const available = width - HEADER_WIDTH;
      if (available <= 0) return;
      const calculated = Math.floor(available / totalCols);
      const size = Math.max(MIN_CELL_SIZE, Math.min(calculated, MAX_CELL_SIZE));
      setCellSize(size);
      cellSizeRef.current = size;
    },
    [totalCols]
  );

  // Calculate overlay position during drag
  const overlayStyle = useMemo(() => {
    if (!dragState) return null;

    const { startRow, startCol, endRow, endCol, mode } = dragState;

    let top, left, width, height;

    if (mode === 'row') {
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      top = HEADER_HEIGHT + minRow * cellSize;
      left = HEADER_WIDTH;
      width = totalCols * cellSize;
      height = (maxRow - minRow + 1) * cellSize;
    } else if (mode === 'col') {
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      top = HEADER_HEIGHT;
      left = HEADER_WIDTH + minCol * cellSize;
      width = (maxCol - minCol + 1) * cellSize;
      height = totalRows * cellSize;
    } else {
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);
      top = HEADER_HEIGHT + minRow * cellSize;
      left = HEADER_WIDTH + minCol * cellSize;
      width = (maxCol - minCol + 1) * cellSize;
      height = (maxRow - minRow + 1) * cellSize;
    }

    return { top, left, width, height };
  }, [dragState, cellSize, totalRows, totalCols]);

  const headerBg = theme.backgroundElement;
  const headerHighlightBg = theme.backgroundSelected;
  const headerText = theme.textSecondary;
  const headerHighlightText = theme.text;

  return (
    <View style={styles.wrapper} onLayout={handleLayout}>
      <View
        style={styles.container}
        // eslint-disable-next-line react-hooks/refs
        {...panResponder.panHandlers}>
        {/* Column headers, labelled A–J like a spreadsheet. The labels are
            display-only: the gesture mapping below stays zero-based indexes.
            pointerEvents="none" keeps the touch target on the container so
            locationX/Y stay container-relative (see the contract above). */}
        <View style={[styles.headerRow, { height: HEADER_HEIGHT }]} pointerEvents="none">
          <View
            style={[
              styles.cornerCell,
              { width: HEADER_WIDTH, height: HEADER_HEIGHT, backgroundColor: headerBg },
            ]}
          />
          {Array.from({ length: totalCols }, (_, colIndex) => {
            const isHighlighted = activeColHighlights.has(colIndex);
            return (
              <View
                key={`col-${colIndex}`}
                style={[
                  styles.headerCell,
                  {
                    width: cellSize,
                    height: HEADER_HEIGHT,
                    backgroundColor: isHighlighted ? headerHighlightBg : headerBg,
                  },
                ]}>
                <Text
                  style={[
                    styles.headerText,
                    { color: isHighlighted ? headerHighlightText : headerText },
                  ]}>
                  {getColumnLetter(colIndex)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Grid rows with row headers — also pointerEvents="none" */}
        {board.grid.map((row, rowIndex) => {
          const isRowHighlighted = activeRowHighlights.has(rowIndex);
          return (
            <View key={`row-${rowIndex}`} style={styles.dataRow} pointerEvents="none">
              <View
                style={[
                  styles.rowHeader,
                  {
                    width: HEADER_WIDTH,
                    height: cellSize,
                    backgroundColor: isRowHighlighted ? headerHighlightBg : headerBg,
                  },
                ]}>
                <Text
                  style={[
                    styles.headerText,
                    { color: isRowHighlighted ? headerHighlightText : headerText },
                  ]}>
                  {rowIndex + 1}
                </Text>
              </View>
              {row.map((value, colIndex) => (
                <AngleBoardCell
                  key={`${rowIndex},${colIndex}`}
                  value={value}
                  isSelected={selectedCells.has(`${rowIndex},${colIndex}`)}
                  cellSize={cellSize}
                />
              ))}
            </View>
          );
        })}

        {/* Selection overlay during drag */}
        {overlayStyle && <View style={[styles.overlay, overlayStyle]} pointerEvents="none" />}

        {/* Outer frame, drawn as an overlay so the container has no border.
            A border would offset layout children by 1px while locationX starts
            at the border's outer edge, skewing the coordinate mapping. */}
        <View
          pointerEvents="none"
          style={[styles.frame, { borderColor: theme.textSecondary + '20' }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  container: {
    alignSelf: 'center',
  },
  frame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
  },
  cornerCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowHeader: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  dataRow: {
    flexDirection: 'row',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  overlay: {
    position: 'absolute',
    backgroundColor: 'rgba(60, 135, 247, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(60, 135, 247, 0.5)',
  },
});
