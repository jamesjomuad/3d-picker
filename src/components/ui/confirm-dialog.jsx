import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Simple modal dialog for confirmations
 * Renders as an overlay with a card
 *
 * @param {Object} props
 * @param {boolean} props.visible - Whether the dialog is visible
 * @param {string} props.title - Dialog title
 * @param {string} [props.message] - Dialog message
 * @param {React.ReactNode} [props.children] - Additional content (e.g., input field)
 * @param {string} [props.confirmLabel='Confirm'] - Confirm button label
 * @param {string} [props.cancelLabel='Cancel'] - Cancel button label
 * @param {'primary' | 'destructive'} [props.confirmVariant='primary'] - Confirm button variant
 * @param {() => void} props.onConfirm - Confirm handler
 * @param {() => void} props.onCancel - Cancel handler
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}) {
  const theme = useTheme();

  if (!visible) return null;

  const confirmBg =
    confirmVariant === 'destructive' ? theme.destructive : theme.primary;

  return (
    <View style={styles.overlay}>
      <View
        style={[
          styles.dialog,
          {
            backgroundColor: theme.background,
            borderColor: theme.border,
          },
        ]}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {message && (
          <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
        )}
        {children}
        <View style={styles.actions}>
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.buttonText, { color: theme.text }]}>{cancelLabel}</Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: confirmBg },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.buttonText, { color: theme.primaryText }]}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: Spacing.four,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  button: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
