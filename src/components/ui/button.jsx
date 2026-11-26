import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Interaction, Spacing, TouchTarget, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AppIcon } from './app-icon';

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
 * @param {string} [props.icon] - Symbol name from app-icon, shown before the label
 * @param {string} [props.accessibilityLabel] - Overrides the spoken label
 * @param {string} [props.accessibilityHint] - Extra spoken context for the action
 */
export function Button({
  children,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  style,
  icon,
  accessibilityLabel,
  accessibilityHint,
}) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const label = accessibilityLabel ?? (typeof children === 'string' ? children : undefined);

  const colors = getVariantColors(variant, theme);
  const sizeStyles = getSizeStyles(size);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        sizeStyles,
        { backgroundColor: colors.bg, borderColor: colors.border },
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <AppIcon
              name={icon}
              size={size === 'sm' ? 'small' : 'action'}
              tone={colors.text}
            />
          ) : null}
          <Text style={[styles.text, sizeStyles.text, { color: colors.text }]}>{children}</Text>
        </View>
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
        minHeight: TouchTarget,
        text: { fontSize: Typography.size.body, lineHeight: Typography.lineHeight.body },
      };
    case 'lg':
      return {
        paddingHorizontal: Spacing.four,
        paddingVertical: Spacing.three,
        minHeight: TouchTarget + Spacing.one,
        text: { fontSize: Typography.size.bodyLarge, lineHeight: Typography.lineHeight.bodyLarge },
      };
    case 'md':
    default:
      return {
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        minHeight: TouchTarget,
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
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  disabled: {
    opacity: Interaction.disabledOpacity,
  },
  pressed: {
    opacity: Interaction.pressedOpacity,
  },
  text: {
    fontWeight: Typography.weight.semibold,
    textAlign: 'center',
  },
});
