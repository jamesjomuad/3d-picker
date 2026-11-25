import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The × button that empties a text field.
 *
 * Absolutely positioned against the field's right end by design: the parent
 * keeps the field and this button in a relative wrapper and leaves matching
 * right padding on the input, so a digit never hides under the tap target.
 * Shared so every text field in the app clears the same way.
 *
 * @param {Object} props
 * @param {() => void} props.onPress - Empties the field
 * @param {string} [props.accessibilityLabel] - What is being cleared
 * @param {Object} [props.style] - Position tweaks for unusually tall fields
 */
export function InputClearButton({ onPress, accessibilityLabel = 'Clear text', style }) {
  const theme = useTheme();

  return (
    <ThemedText
      type="linkPrimary"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.clear, { color: theme.textSecondary }, style]}>
      ×
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  clear: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: 44,
    paddingHorizontal: Spacing.three,
    fontSize: Typography.size.title,
    lineHeight: Typography.lineHeight.headline,
  },
});
