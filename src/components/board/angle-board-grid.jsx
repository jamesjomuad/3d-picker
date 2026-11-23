import { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

import { AngleBoardCell } from './angle-board-cell';

import { useTheme } from '@/hooks/use-theme';
import { getDragHighlights, getSelectedRowsAndCols, getTouchZone, touchToCell } from '@/utils/selection';
import { useBoardStore } from '@/store/boardStore';

const HEADER_WIDTH = 28;
const HEADER_HEIGHT = 24;
const DEFAULT_CELL_SIZE = 35;

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
  // Created once via useRef so the gesture handler is stable across renders.
  // The callbacks close over stable values:
  //   - totalRows/totalCols are derived from static board data (never change)
  //   - Zustand store actions (selectCell, selectRect, etc.) are stable references
  //   - cellSizeRef holds the current cell size, accessed only inside gesture callbacks
  // The React 19 lint rule flags ref access patterns that are safe here
  // (refs are only read inside gesture callbacks, never during render).
  /* eslint-disable react-hooks/refs */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const zone = getTouchZone(locationX, locationY, HEADER_WIDTH, HEADER_HEIGHT);

        if (zone === 'corner') return;

        const cs = cellSizeRef.current;
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

        clearSelection();

        setDragState({
          startRow: cell.row,
          startCol: cell.col,
          endRow: cell.row,
          endCol: cell.col,
          mode: zone,
        });
      },

      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;

        setDragState((prev) => {
          if (!prev) return prev;

          const cs = cellSizeRef.current;

          if (prev.mode === 'row') {
            const gridY = locationY - HEADER_HEIGHT;
            if (gridY < 0) return prev;
            const row = Math.max(0, Math.min(totalRows - 1, Math.floor(gridY / cs)));
            return { ...prev, endRow: row };
          }

          if (prev.mode === 'col') {
            const gridX = locationX - HEADER_WIDTH;
            if (gridX < 0) return prev;
            const col = Math.max(0, Math.min(totalCols - 1, Math.floor(gridX / cs)));
            return { ...prev, endCol: col };
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
          if (!cell) return prev;
          return { ...prev, endRow: cell.row, endCol: cell.col };
        });
      },

      onPanResponderRelease: () => {
        setDragState((prev) => {
          if (!prev) return prev;

          const { startRow, startCol, endRow, endCol, mode } = prev;

          if (mode === 'row') {
            selectRows(startRow, endRow, totalRows, totalCols);
          } else if (mode === 'col') {
            selectCols(startCol, endCol, totalRows, totalCols);
          } else if (startRow === endRow && startCol === endCol) {
            selectCell(startRow, startCol);
          } else {
            selectRect(startRow, startCol, endRow, endCol, totalRows, totalCols);
          }

          return null;
        });
      },

      onPanResponderTerminationRequest: () => false,
    })
  ).current;
  /* eslint-enable react-hooks/refs */

  const handleLayout = useCallback(
    (e) => {
      const { width } = e.nativeEvent.layout;
      const available = width - HEADER_WIDTH;
      if (available <= 0) return;
      const calculated = Math.floor(available / totalCols);
      const size = Math.max(24, Math.min(calculated, 50));
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
    <View
      style={[styles.container, { borderColor: theme.textSecondary + '20' }]}
      onLayout={handleLayout}
      // eslint-disable-next-line react-hooks/refs
      {...panResponder.panHandlers}>
      {/* Column headers */}
      <View style={[styles.headerRow, { height: HEADER_HEIGHT }]}>
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
              <Text style={[styles.headerText, { color: isHighlighted ? headerHighlightText : headerText }]}>
                {colIndex}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Grid rows with row headers */}
      {board.grid.map((row, rowIndex) => {
        const isRowHighlighted = activeRowHighlights.has(rowIndex);
        return (
          <View key={`row-${rowIndex}`} style={styles.dataRow}>
            <View
              style={[
                styles.rowHeader,
                {
                  width: HEADER_WIDTH,
                  height: cellSize,
                  backgroundColor: isRowHighlighted ? headerHighlightBg : headerBg,
                },
              ]}>
              <Text style={[styles.headerText, { color: isRowHighlighted ? headerHighlightText : headerText }]}>
                {rowIndex}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
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
