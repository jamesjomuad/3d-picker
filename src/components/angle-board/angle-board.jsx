import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AngleBoardGrid } from './angle-board-grid';
import { AngleBoardFrame, AngleBoardSelectionOverlay } from './angle-board-selection';
import { useAngleBoardEditing } from './hooks/use-angle-board-editing';
import { useAngleBoardGestures } from './hooks/use-angle-board-gestures';

import { computeFill } from '@/utils/board-fill';
import { getDragHighlights, getSelectedRowsAndCols } from '@/utils/selection';

/** Identity-stable stand-in so a board with no owner selection stays memo-safe. */
const NO_SELECTION = new Set();

/** Identity-stable stand-ins for a board with no search highlights. */
const NO_HIGHLIGHTS = { cells: NO_SELECTION, active: NO_SELECTION };

/**
 * Angle Board — the digit grid with spreadsheet-style selection.
 *
 * The board is a component, not a screen: it reads no store, no route and no
 * screen around it. Selection is data the owner holds and gets back through
 * `onSelectionChange`; the board keeps only what dies with the gesture (drag
 * rectangle, measured cell size, open editor).
 *
 * Read-only (the default): tap a cell, or drag a rectangle, a row or a column the
 * way a spreadsheet does. `onSelectionChange` fires once when the gesture commits,
 * so a drag across ten cells is one update, not ten.
 *
 * Editable (`editable`): the same gestures mean something else. A drag that stays
 * on one cell opens that cell's single-digit field. A drag across a block is a
 * fill handle: it copies a pattern over the dragged area and reports the changed
 * cells through `onCellChange({ "row,col": digit })`. The pattern is the current
 * selection when the drag touches it, which is why an editable owner that wants
 * filling should also pass `selection` and `onSelectionChange` — select a block,
 * then drag past it.
 *
 * The grid must be rectangular digits 0–9 (`validateGrid` in
 * `@/utils/board-validation` checks a board before it gets here).
 *
 * @param {Object} props
 * @param {number[][]} props.grid - digits, e.g. `board.grid`
 * @param {Set<string>} [props.selection] - selected "row,col" keys, controlled
 * @param {(cells: Set<string>) => void} [props.onSelectionChange] - called with the
 *   new set on every commit, including the empty set when a new gesture starts
 * @param {boolean} [props.editable]
 * @param {(changes: Object<string, number>) => void} [props.onCellChange] -
 *   digits to write, as "row,col" -> digit, from a typed edit or a fill
 * @param {{ cells: Set<string>, active: Set<string> }} [props.highlights] -
 *   a non-selection highlight layer, "row,col" keys: `cells` marks every cell
 *   a search result passes through, `active` emphasises the one result the
 *   owner is showing. Selection always wins, so a highlighted cell that is
 *   also selected simply looks selected.
 * @param {Object} [props.style] - extra style for the outer wrapper
 */
export function AngleBoard({
  grid,
  selection,
  onSelectionChange,
  editable = false,
  onCellChange,
  highlights,
  style,
}) {
  const editing = useAngleBoardEditing({ grid, onCellChange });
  const { beginEdit, cancelEdit } = editing;

  // A fill writes digits, so any open field is finished first: its value would
  // otherwise be committed over the cell the fill just set.
  const handleFill = useCallback(
    ({ source, target }) => {
      cancelEdit();
      const changes = computeFill(grid, source, target);
      if (Object.keys(changes).length > 0) onCellChange?.(changes);
    },
    [cancelEdit, grid, onCellChange]
  );

  const handleTap = useCallback((cell) => beginEdit(cell.row, cell.col), [beginEdit]);

  const { cellSize, dragState, handleLayout, panHandlers } = useAngleBoardGestures({
    grid,
    selection,
    editable,
    onSelectionChange,
    onFill: handleFill,
    onTap: handleTap,
  });

  const totalRows = grid.length;
  const totalCols = grid[0]?.length ?? 0;
  const cells = selection ?? NO_SELECTION;
  const marks = highlights ?? NO_HIGHLIGHTS;

  // Which rows and columns the headers should mark: the drag in progress wins
  // while it lasts, then the committed selection keeps its own rows and columns
  // lit. Both come from the selection engine, never from the view tree.
  const headerMarks = useMemo(() => {
    if (dragState) return getDragHighlights(dragState, totalRows, totalCols);
    return getSelectedRowsAndCols(cells);
  }, [dragState, totalRows, totalCols, cells]);

  return (
    <View style={[styles.wrapper, style]} onLayout={handleLayout}>
      {/* The gesture serves both modes: selecting in read-only, filling and
          tapping in editable. Cells never own touches, so the board always gets
          container-relative coordinates. */}
      <View style={styles.container} {...panHandlers}>
        <AngleBoardGrid
          grid={grid}
          cellSize={cellSize}
          selection={cells}
          highlightCells={marks.cells}
          highlightActive={marks.active}
          rowHighlights={headerMarks.rows}
          colHighlights={headerMarks.cols}
          editable={editable}
          editing={editing}
        />

        <AngleBoardSelectionOverlay
          dragState={dragState}
          cellSize={cellSize}
          totalRows={totalRows}
          totalCols={totalCols}
        />

        <AngleBoardFrame />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Stretches to the screen's content width; measured to size the cells.
  wrapper: {
    alignItems: 'center',
  },
  // Only as wide as its cells, so it centres itself inside the wrapper.
  container: {
    alignSelf: 'center',
  },
});
