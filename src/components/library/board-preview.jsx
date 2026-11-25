import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, BorderRadius, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Miniature read-only grid preview for board cards
 * Shows a small 10×10 digit grid
 *
 * @param {Object} props
 * @param {number[][]} props.grid - The board grid data
 * @param {number} [props.size=120] - Total size of the preview
 */
export const BoardPreview = memo(function BoardPreview({ grid, size = 120 }) {
  const theme = useTheme();

  if (!grid || grid.length === 0) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
          },
        ]}>
        <Text style={{ color: theme.textSecondary, fontSize: Typography.size.caption }}>Empty</Text>
      </View>
    );
  }

  const rows = grid.length;
  const cols = grid[0].length;
  const cellSize = Math.floor(size / Math.max(rows, cols));
  const actualSize = cellSize * cols;

  return (
    <View
      style={[
        styles.container,
        {
          width: actualSize,
          height: cellSize * rows,
          borderColor: theme.border,
        },
      ]}>
      {grid.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((value, colIndex) => (
            <View
              key={colIndex}
              style={[
                styles.cell,
                {
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border + '40',
                },
              ]}>
              <Text
                style={[
                  styles.cellText,
                  {
                    color: theme.textSecondary,
                    fontSize: Math.max(6, cellSize * 0.55),
                  },
                ]}>
                {value}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  cellText: {
    fontFamily: Fonts.mono,
    fontWeight: Typography.weight.semibold,
  },
});
