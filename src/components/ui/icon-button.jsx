import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Icon-only circular button
 * Uses expo-symbols for cross-platform icon rendering
 *
 * @param {Object} props
 * @param {string} props.symbol - SF Symbol name (auto-mapped per platform)
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
  const iconColor = theme.text;

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
      <SymbolView
        name={getSymbolName(symbol)}
        size={sizeValue * 0.45}
        weight="medium"
        tintColor={iconColor}
      />
    </Pressable>
  );
}

function getSymbolName(name) {
  // Map iOS SF Symbols to Android/Web equivalents
  const symbolMap = {
    'chevron.right': { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
    'chevron.left': { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
    'chevron.down': { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
    'chevron.up': { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' },
    'xmark': { ios: 'xmark', android: 'close', web: 'close' },
    'plus': { ios: 'plus', android: 'add', web: 'add' },
    'minus': { ios: 'minus', android: 'remove', web: 'remove' },
    'trash': { ios: 'trash', android: 'delete', web: 'delete' },
    'gearshape': { ios: 'gearshape', android: 'settings', web: 'settings' },
    'square.and.pencil': { ios: 'square.and.pencil', android: 'edit', web: 'edit' },
    'magnifyingglass': { ios: 'magnifyingglass', android: 'search', web: 'search' },
    'checkmark': { ios: 'checkmark', android: 'check', web: 'check' },
    'info.circle': { ios: 'info.circle', android: 'info', web: 'info' },
  };

  return symbolMap[name] || name;
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
