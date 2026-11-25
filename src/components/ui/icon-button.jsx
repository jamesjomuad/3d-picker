import { Pressable, StyleSheet } from 'react-native';

import { BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AppIcon } from './app-icon';

/**
 * Icon-only circular button
 * Uses expo-symbols for cross-platform icon rendering
 *
 * @param {Object} props
 * @param {string} props.symbol - Key from SYMBOL_NAMES (auto-mapped per platform)
 * @param {() => void} [props.onPress] - Press handler
 * @param {boolean} [props.disabled] - Disabled state
 * @param {'filled' | 'outline'} [props.variant='filled'] - Visual variant
 * @param {'sm' | 'md' | 'lg'} [props.size='md'] - Size variant
 * @param {string} [props.accessibilityLabel] - Required for accessibility
 */
export function IconButton({
  symbol,
  onPress,
  disabled = false,
  variant = 'filled',
  size = 'md',
  accessibilityLabel,
}) {
  const theme = useTheme();
  const sizeValue = getSizeValue(size);

  const isOutline = variant === 'outline';
  const backgroundColor = isOutline ? 'transparent' : theme.backgroundElement;
  const borderColor = isOutline ? theme.border : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        {
          width: sizeValue,
          height: sizeValue,
          backgroundColor,
          borderColor,
        },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <AppIcon name={symbol} size={Math.round(sizeValue * 0.45)} tone="text" />
    </Pressable>
  );
}

function getSizeValue(size) {
  switch (size) {
    case 'sm':
      return 36;
    case 'lg':
      return 52;
    case 'md':
    default:
      return 44;
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
