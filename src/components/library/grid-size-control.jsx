import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { BorderRadius, Spacing, TouchTarget, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  MAX_BOARD_COLUMNS,
  MAX_BOARD_ROWS,
  MIN_BOARD_DIMENSION,
} from '@/utils/board-resize';

/**
 * Grid size steppers for the visual board editor.
 *
 * Dimensions stay derived from the grid. This control only asks the owner to
 * resize the grid, then reads the new row and column counts back from it.
 *
 * @param {Object} props
 * @param {number} props.rows
 * @param {number} props.columns
 * @param {(rows: number, columns: number) => void} props.onChange
 */
export function GridSizeControl({ rows, columns, onChange }) {
  const theme = useTheme();

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.container, { borderColor: theme.border }]}>
      <View style={styles.intro}>
        <ThemedText type="smallBold">Board size</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.helper}>
          {`${MIN_BOARD_DIMENSION}–${MAX_BOARD_ROWS} rows, ${MIN_BOARD_DIMENSION}–${MAX_BOARD_COLUMNS} columns. New cells start at 0; removed cells are deleted.`}
        </ThemedText>
      </View>

      <View style={styles.steppers}>
        <SizeStepper
          label="Rows"
          value={rows}
          max={MAX_BOARD_ROWS}
          onDecrease={() => onChange(rows - 1, columns)}
          onIncrease={() => onChange(rows + 1, columns)}
        />
        <SizeStepper
          label="Columns"
          value={columns}
          max={MAX_BOARD_COLUMNS}
          onDecrease={() => onChange(rows, columns - 1)}
          onIncrease={() => onChange(rows, columns + 1)}
        />
      </View>
    </ThemedView>
  );
}

function SizeStepper({ label, value, max, onDecrease, onIncrease }) {
  const lowerLabel = label.toLowerCase();

  return (
    <View style={styles.row}>
      <ThemedText type="smallBold" style={styles.label}>
        {label}
      </ThemedText>
      <View style={styles.controls}>
        <Button
          size="sm"
          variant="outline"
          icon="minus"
          disabled={value <= MIN_BOARD_DIMENSION}
          onPress={onDecrease}
          style={styles.stepButton}
          accessibilityLabel={`Decrease ${lowerLabel}`}
          accessibilityHint={`Removes one ${lowerLabel === 'rows' ? 'row' : 'column'} from the board.`}
        />
        <ThemedText
          accessibilityRole="text"
          accessibilityLabel={`${label}: ${value}`}
          style={styles.value}>
          {String(value).padStart(2, '0')}
        </ThemedText>
        <Button
          size="sm"
          variant="outline"
          icon="plus"
          disabled={value >= max}
          onPress={onIncrease}
          style={styles.stepButton}
          accessibilityLabel={`Increase ${lowerLabel}`}
          accessibilityHint={`Adds one ${lowerLabel === 'rows' ? 'row' : 'column'} to the board.`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  intro: {
    gap: Spacing.half,
  },
  helper: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
  },
  steppers: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  label: {
    flexShrink: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  stepButton: {
    width: TouchTarget,
    paddingHorizontal: 0,
  },
  value: {
    minWidth: TouchTarget,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
