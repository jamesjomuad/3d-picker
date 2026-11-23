import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { HEADER_HEIGHT, HEADER_WIDTH } from '@/utils/board-layout';
import { getColumnLetter } from '@/utils/cell-reference';

/**
 * Fixed-size header chrome: the corner cell plus the A–J column labels, and a
 * single 1–10 row label.
 *
 * Column labels are display-only. The gesture mapping stays zero-based indexes
 * (`@/utils/cell-reference` owns the conversion), so highlighting column C means
 * `colHighlights.has(2)`.
 *
 * A header is "highlighted" when its row or column is part of the selection or
 * the drag in progress — the same trick Excel uses to show what a range covers.
 */

/**
 * Top row: corner cell + one label per column.
 *
 * @param {Object} props
 * @param {number} props.totalCols
 * @param {number} props.cellSize
 * @param {Set<number>} props.colHighlights - column indexes to highlight
 */
export function AngleBoardColumnHeaders({ totalCols, cellSize, colHighlights }) {
  const theme = useTheme();

  return (
    <View style={styles.headerRow} pointerEvents="none">
      <View
        style={[
          styles.headerCell,
          { width: HEADER_WIDTH, height: HEADER_HEIGHT, backgroundColor: theme.backgroundElement },
        ]}
      />
      {Array.from({ length: totalCols }, (_, colIndex) => (
        <AngleBoardHeaderCell
          key={`col-${colIndex}`}
          label={getColumnLetter(colIndex)}
          width={cellSize}
          height={HEADER_HEIGHT}
          highlighted={colHighlights.has(colIndex)}
        />
      ))}
    </View>
  );
}

/**
 * Left cell of a data row.
 *
 * @param {Object} props
 * @param {number} props.rowIndex - zero-based, rendered 1-based
 * @param {number} props.cellSize
 * @param {boolean} props.highlighted
 */
export function AngleBoardRowHeader({ rowIndex, cellSize, highlighted }) {
  return (
    <AngleBoardHeaderCell
      label={rowIndex + 1}
      width={HEADER_WIDTH}
      height={cellSize}
      highlighted={highlighted}
    />
  );
}

/**
 * One header box, shared by both axes so their colours and type never drift.
 *
 * @param {Object} props
 * @param {string|number} props.label
 * @param {number} props.width
 * @param {number} props.height
 * @param {boolean} props.highlighted
 */
function AngleBoardHeaderCell({ label, width, height, highlighted }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.headerCell,
        {
          width,
          height,
          backgroundColor: highlighted ? theme.primary : theme.backgroundElement,
        },
      ]}>
      <Text
        style={[styles.headerText, { color: highlighted ? theme.primaryText : theme.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
  },
  headerCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
