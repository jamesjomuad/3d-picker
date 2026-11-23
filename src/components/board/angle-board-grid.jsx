import { StyleSheet, View } from 'react-native';

import { AngleBoardCell } from './angle-board-cell';

import { Spacing } from '@/constants/theme';

/**
 * Angle Board grid component
 * Renders the 2D digit grid
 *
 * @param {Object} props
 * @param {Object} props.board - The board object with name and grid
 * @param {Set<string>} props.selectedCells - Set of selected cell keys (format: "row,col")
 * @param {Function} props.onCellPress - Handler for cell press, receives (rowIndex, colIndex)
 */
export function AngleBoardGrid({ board, selectedCells = new Set(), onCellPress }) {
  return (
    <View style={styles.container}>
      {board.grid.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((value, colIndex) => {
            const cellKey = `${rowIndex},${colIndex}`;
            const isSelected = selectedCells.has(cellKey);

            return (
              <AngleBoardCell
                key={cellKey}
                value={value}
                rowIndex={rowIndex}
                colIndex={colIndex}
                isSelected={isSelected}
                onPress={onCellPress ? () => onCellPress(rowIndex, colIndex) : undefined}
                cellSize={35}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  row: {
    flexDirection: 'row',
  },
});
