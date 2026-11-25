import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Alpha suffix for a match segment: a tint, so the digit stays readable. */
const SEGMENT_ALPHA = '59';

/** Alpha suffix for a Replace-tool match tint: subtle, distinct from a selection. */
const MATCH_ALPHA = '33';

/** Alpha suffix for a plotted basket pick: a wash, not a solid selection. */
const PLOT_ALPHA = '1F';

/**
 * Individual cell in the Angle Board grid
 * Displays a single digit (0-9)
 * Display-only: gesture handling is managed by the parent grid
 *
 * @param {Object} props
 * @param {number} props.value - The digit value (0-9)
 * @param {boolean} props.isSelected - Whether the cell is selected
 * @param {{ colors: string[], activeColor: string|null }|null} [props.search] -
 *   search-result layer: `colors` are the palette colours of every matching
 *   path crossing this cell (drawn as vertical segments when several overlap),
 *   `activeColor` solid-fills the cell when the emphasised path passes through.
 *   Selection wins over both.
 * @param {string} [props.searchActiveText] - digit colour on a solid-filled
 *   active cell, chosen by the palette for contrast
 * @param {boolean} [props.isMatch] - a Replace-tool match found in the original
 *   board snapshot; tinted, but weaker than a selection or a search result
 * @param {boolean} [props.isPlotted] - temporary plotted basket-pick cell: a
 *   light wash plus a primary-coloured outline, distinct from a solid selection
 * @param {number} props.cellSize - Size of the cell in pixels
 */
export const AngleBoardCell = memo(function AngleBoardCell({
  value,
  isSelected = false,
  search = null,
  searchActiveText,
  isMatch = false,
  isPlotted = false,
  cellSize,
}) {
  const theme = useTheme();

  let backgroundColor = isMatch ? theme.match + MATCH_ALPHA : theme.backgroundElement;
  let textColor = isMatch ? theme.text : theme.textSecondary;
  if (isPlotted && !isSelected && !search?.activeColor) {
    backgroundColor = theme.primary + PLOT_ALPHA;
    textColor = theme.text;
  }
  if (!isSelected && search?.activeColor) {
    backgroundColor = search.activeColor;
    textColor = searchActiveText ?? theme.primaryText;
  }
  if (isSelected) {
    backgroundColor = theme.primary;
    textColor = theme.primaryText;
  }

  // A plain match shows its path colours as segments; an active cell is one
  // solid colour already, and selection covers the cell entirely.
  const segments = !isSelected && !search?.activeColor ? (search?.colors ?? null) : null;

  return (
    <View
      style={[
        styles.cell,
        {
          width: cellSize,
          height: cellSize,
          backgroundColor,
          borderColor: isPlotted ? theme.primary : theme.textSecondary + '20',
          borderWidth: isPlotted ? 2 : 1,
        },
      ]}>
      {segments?.map((color, index) => (
        <View
          key={`${index}-${color}`}
          pointerEvents="none"
          // Fractional left/width so overlapping paths each get their own
          // stripe of the cell; rounding never drops a segment out of view.
          style={[
            styles.segment,
            {
              left: `${(index * 100) / segments.length}%`,
              width: `${100 / segments.length}%`,
              backgroundColor: color + SEGMENT_ALPHA,
            },
          ]}
        />
      ))}
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
  segment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  cellText: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Fonts.mono,
  },
});
