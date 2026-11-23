import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Individual cell in the Angle Board grid
 * Displays a single digit (0-9)
 * Display-only: gesture handling is managed by the parent grid
 *
 * @param {Object} props
 * @param {number} props.value - The digit value (0-9)
 * @param {boolean} props.isSelected - Whether the cell is selected
 * @param {'match'|'active'|null} [props.highlight] - search-result layer:
 *   'match' marks a cell some result passes through, 'active' the cell of the
 *   result being emphasised. Selection wins over both.
 * @param {number} props.cellSize - Size of the cell in pixels
 */
export const AngleBoardCell = memo(function AngleBoardCell({
  value,
  isSelected = false,
  highlight = null,
  cellSize,
}) {
  const theme = useTheme();

  let backgroundColor = isSelected ? theme.backgroundSelected : theme.backgroundElement;
  let textColor = isSelected ? theme.text : theme.textSecondary;
  if (!isSelected && highlight === 'match') {
    backgroundColor = theme.primary + '30';
  } else if (!isSelected && highlight === 'active') {
    backgroundColor = theme.primary;
    textColor = theme.primaryText;
  }

  return (
    <View
      style={[
        styles.cell,
        {
          width: cellSize,
          height: cellSize,
          backgroundColor,
          borderColor: theme.textSecondary + '20',
        },
      ]}>
      <Text style={[styles.cellText, { color: textColor }]}>{value}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
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
});
