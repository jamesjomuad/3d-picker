import { StyleSheet, View } from 'react-native';

import { AngleBoardCell } from './angle-board-cell';
import { AngleBoardEditCell } from './angle-board-edit-cell';
import { AngleBoardColumnHeaders, AngleBoardRowHeader } from './angle-board-headers';

/**
 * The board's boxes: the header row, then one row per grid row.
 *
 * Presentational only — it holds no state, maps no touches, and computes no
 * selection. It is told the cell size, which cells are selected, which rows and
 * columns to highlight, and (in editable mode) which cell is open.
 *
 * Stable `row-${i}` / `row,col` keys keep React reconciling a 10×10 board as
 * updates instead of remounts while a drag repaints on every move event.
 *
 * @param {Object} props
 * @param {number[][]} props.grid
 * @param {number} props.cellSize
 * @param {Set<string>} props.selection - selected "row,col" keys
 * @param {Set<string>} [props.highlightCells] - search-result "row,col" keys
 * @param {Set<string>} [props.highlightActive] - subset of those for the one
 *   result being emphasised
 * @param {Set<number>} props.rowHighlights
 * @param {Set<number>} props.colHighlights
 * @param {boolean} props.editable
 * @param {{ editingCell: Object|null, editValue: string, setEditValue: Function, commitEdit: Function }} [props.editing]
 *   editing state, required in editable mode
 */

/**
 * Which non-selection highlight layer a cell sits in, or none.
 * The active result wins over the general match colour where they overlap;
 * selection still beats both, inside the cell itself.
 */
function cellHighlight(cells, active, key) {
  if (active?.has(key)) return 'active';
  if (cells?.has(key)) return 'match';
  return null;
}

export function AngleBoardGrid({
  grid,
  cellSize,
  selection,
  highlightCells,
  highlightActive,
  rowHighlights,
  colHighlights,
  editable = false,
  editing,
}) {
  return (
    <View>
      <AngleBoardColumnHeaders
        totalCols={grid[0]?.length ?? 0}
        cellSize={cellSize}
        colHighlights={colHighlights}
      />

      {grid.map((row, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          style={styles.row}
          // The board itself reads touches, in both modes: a cell that took the
          // touch would take the gesture origin too, and coordinates would stop
          // meaning "inside the board" (see the hook's contract).
          pointerEvents="none">
          <AngleBoardRowHeader
            rowIndex={rowIndex}
            cellSize={cellSize}
            highlighted={rowHighlights.has(rowIndex)}
          />
          {row.map((value, colIndex) =>
            editable ? (
              <AngleBoardEditCell
                key={`${rowIndex},${colIndex}`}
                value={value}
                cellSize={cellSize}
                isEditing={
                  editing?.editingCell?.row === rowIndex && editing?.editingCell?.col === colIndex
                }
                editValue={editing?.editValue ?? ''}
                onChangeText={editing?.setEditValue}
                onCommit={editing?.commitEdit}
              />
            ) : (
              <AngleBoardCell
                key={`${rowIndex},${colIndex}`}
                value={value}
                isSelected={selection.has(`${rowIndex},${colIndex}`)}
                highlight={cellHighlight(
                  highlightCells,
                  highlightActive,
                  `${rowIndex},${colIndex}`
                )}
                cellSize={cellSize}
              />
            )
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
});
