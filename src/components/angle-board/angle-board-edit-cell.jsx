import { memo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Fonts, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Alpha suffix for a Replace-tool match tint, matching the display cell. */
const MATCH_ALPHA = '33';

/**
 * Editable cell in the Angle Board: shows a digit, and while it is the cell the
 * user tapped it shows a single-digit field instead.
 *
 * Like the display cell, this is a pure view. It takes no touches of its own: the
 * board reads taps and drags from its gesture responder, because a cell that
 * receives a touch would move the gesture coordinate origin (see the contract in
 * `hooks/use-angle-board-gestures.js`).
 *
 * @param {Object} props
 * @param {number} props.value - digit in this cell
 * @param {number} props.cellSize
 * @param {boolean} [props.isEditing] - this cell holds the open field
 * @param {string} [props.editValue] - text typed so far
 * @param {boolean} [props.isMatch] - a Replace-tool match found in the original
 *   board snapshot, tinted while the replacement is being configured
 * @param {(text: string) => void} [props.onChangeText]
 * @param {() => void} props.onCommit - Enter or blur accepts the digit
 */
export const AngleBoardEditCell = memo(function AngleBoardEditCell({
  value,
  cellSize,
  isEditing = false,
  isMatch = false,
  editValue = '',
  onChangeText,
  onCommit,
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.cell,
        {
          width: cellSize,
          height: cellSize,
          backgroundColor: isEditing
            ? theme.backgroundSelected
            : isMatch
              ? theme.match + MATCH_ALPHA
              : theme.backgroundElement,
          borderColor: theme.textSecondary + '20',
        },
      ]}>
      {isEditing ? (
        <TextInput
          style={[styles.cellInput, { color: theme.text }]}
          value={editValue}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          maxLength={1}
          autoFocus
          onSubmitEditing={onCommit}
          onBlur={onCommit}
        />
      ) : (
        <Text style={[styles.cellText, { color: theme.text }]}>{value}</Text>
      )}
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
    fontSize: Typography.size.subtitle,
    fontWeight: Typography.weight.semibold,
    fontFamily: Fonts.mono,
  },
  cellInput: {
    fontSize: Typography.size.subtitle,
    fontWeight: Typography.weight.semibold,
    fontFamily: Fonts.mono,
    textAlign: 'center',
    width: '100%',
    height: '100%',
    padding: 0,
  },
});
