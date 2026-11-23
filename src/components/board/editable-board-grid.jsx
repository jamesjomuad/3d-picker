import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getColumnLetter } from '@/utils/cell-reference';

const HEADER_WIDTH = 28;
const HEADER_HEIGHT = 24;
const DEFAULT_CELL_SIZE = 35;

/**
 * Editable Angle Board grid component
 * Users can tap a cell to change its digit value (0-9)
 *
 * @param {Object} props
 * @param {number[][]} props.grid - The board grid data
 * @param {(row: number, col: number, value: number) => void} props.onCellChange - Cell change handler
 * @param {boolean} [props.editable=true] - Whether cells are editable
 */
export function EditableBoardGrid({ grid, onCellChange, editable = true }) {
  const theme = useTheme();
  const totalCols = grid[0]?.length ?? 0;

  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleCellPress = useCallback(
    (row, col) => {
      if (!editable) return;
      setEditingCell({ row, col });
      setEditValue(String(grid[row][col]));
    },
    [editable, grid]
  );

  const handleEditSubmit = useCallback(() => {
    if (!editingCell) return;

    const numValue = parseInt(editValue, 10);
    if (isNaN(numValue) || numValue < 0 || numValue > 9) {
      Alert.alert('Invalid Value', 'Please enter a digit from 0 to 9');
      setEditingCell(null);
      return;
    }

    onCellChange(editingCell.row, editingCell.col, numValue);
    setEditingCell(null);
  }, [editingCell, editValue, onCellChange]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {/* Column headers */}
        <View style={[styles.headerRow, { height: HEADER_HEIGHT }]} pointerEvents="none">
          <View
            style={[
              styles.cornerCell,
              { width: HEADER_WIDTH, height: HEADER_HEIGHT, backgroundColor: theme.backgroundElement },
            ]}
          />
          {Array.from({ length: totalCols }, (_, colIndex) => (
            <View
              key={`col-${colIndex}`}
              style={[
                styles.headerCell,
                {
                  width: DEFAULT_CELL_SIZE,
                  height: HEADER_HEIGHT,
                  backgroundColor: theme.backgroundElement,
                },
              ]}>
              <Text style={[styles.headerText, { color: theme.textSecondary }]}>
                {getColumnLetter(colIndex)}
              </Text>
            </View>
          ))}
        </View>

        {/* Grid rows */}
        {grid.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.dataRow}>
            <View
              style={[
                styles.rowHeader,
                {
                  width: HEADER_WIDTH,
                  height: DEFAULT_CELL_SIZE,
                  backgroundColor: theme.backgroundElement,
                },
              ]}>
              <Text style={[styles.headerText, { color: theme.textSecondary }]}>
                {rowIndex + 1}
              </Text>
            </View>
            {row.map((value, colIndex) => {
              const isEditing =
                editingCell && editingCell.row === rowIndex && editingCell.col === colIndex;

              return (
                <Pressable
                  key={`${rowIndex},${colIndex}`}
                  onPress={() => handleCellPress(rowIndex, colIndex)}
                  disabled={!editable}
                  style={[
                    styles.cell,
                    {
                      width: DEFAULT_CELL_SIZE,
                      height: DEFAULT_CELL_SIZE,
                      backgroundColor: isEditing
                        ? theme.backgroundSelected
                        : theme.backgroundElement,
                      borderColor: theme.textSecondary + '20',
                    },
                  ]}>
                  {isEditing ? (
                    <TextInput
                      style={[styles.cellInput, { color: theme.text }]}
                      value={editValue}
                      onChangeText={setEditValue}
                      keyboardType="number-pad"
                      maxLength={1}
                      autoFocus
                      onSubmitEditing={handleEditSubmit}
                      onBlur={handleEditSubmit}
                    />
                  ) : (
                    <Text style={[styles.cellText, { color: theme.text }]}>
                      {value}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}

        {/* Frame */}
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
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  cellText: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Fonts.mono,
  },
  cellInput: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Fonts.mono,
    textAlign: 'center',
    width: '100%',
    height: '100%',
    padding: 0,
  },
});
