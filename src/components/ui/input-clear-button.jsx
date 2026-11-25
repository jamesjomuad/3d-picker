import { Pressable, StyleSheet } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { Spacing } from '@/constants/theme';

/**
 * The clear button that empties a text field.
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.clear, style]}>
      <AppIcon name="xmark" size="small" tone="textSecondary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  clear: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
});
