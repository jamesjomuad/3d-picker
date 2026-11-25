import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Button component with variants and sizes
 * Provides consistent interactive button with press feedback
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Button content
 * @param {() => void} [props.onPress] - Press handler
 * @param {boolean} [props.disabled] - Disabled state
 * @param {boolean} [props.loading] - Loading state (shows spinner)
 * @param {'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'} [props.variant='primary'] - Visual variant
 * @param {'sm' | 'md' | 'lg'} [props.size='md'] - Size variant
 * @param {Object} [props.style] - Additional container styles
 */
export function Button({
  children,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  style,
}) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const colors = getVariantColors(variant, theme);
  const sizeStyles = getSizeStyles(size);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        sizeStyles,
        { backgroundColor: colors.bg, borderColor: colors.border },
        isDisabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <Text style={[styles.text, sizeStyles.text, { color: colors.text }]}>{children}</Text>
      )}
    </Pressable>
  );
}

function getVariantColors(variant, theme) {
  switch (variant) {
    case 'primary':
      return { bg: theme.primary, text: theme.primaryText, border: 'transparent' };
    case 'secondary':
      return { bg: theme.backgroundElement, text: theme.text, border: 'transparent' };
    case 'outline':
      return { bg: 'transparent', text: theme.text, border: theme.border };
    case 'ghost':
      return { bg: 'transparent', text: theme.text, border: 'transparent' };
    case 'destructive':
      return { bg: theme.destructive, text: theme.primaryText, border: 'transparent' };
    default:
      return { bg: theme.primary, text: theme.primaryText, border: 'transparent' };
  }
}

function getSizeStyles(size) {
  switch (size) {
    case 'sm':
      return {
        paddingHorizontal: Spacing.two,
        paddingVertical: Spacing.one,
        minHeight: 32,
        text: { fontSize: Typography.size.body, lineHeight: Typography.lineHeight.body },
      };
    case 'lg':
      return {
        paddingHorizontal: Spacing.four,
        paddingVertical: Spacing.three,
        minHeight: 52,
        text: { fontSize: Typography.size.bodyLarge, lineHeight: Typography.lineHeight.bodyLarge },
      };
    case 'md':
    default:
      return {
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        minHeight: 44,
        text: { fontSize: Typography.size.bodyLarge, lineHeight: Typography.lineHeight.body },
      };
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    fontWeight: Typography.weight.semibold,
    textAlign: 'center',
  },
});
