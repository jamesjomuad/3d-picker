import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Modal confirmation / action dialog
 *
 * A centered popup in its own `Modal` window, so it always paints above the
 * page and any bottom sheet rather than being positioned inside the scroll
 * content. The backdrop dims what is behind it, and every dismissal route —
 * outside tap, Android back button, Cancel — runs `onCancel` only, never
 * `onConfirm`, so an accidental dismissal can never execute the action.
 * `confirmDisabled` lets a caller gate a destructive or invalid action
 * (an empty name) instead of letting it through and complaining after.
 *
 * @param {Object} props
 * @param {boolean} props.visible - Whether the dialog is visible
 * @param {string} props.title - Dialog title
 * @param {string} [props.message] - Dialog message
 * @param {React.ReactNode} [props.children] - Additional content (e.g., input field)
 * @param {string} [props.confirmLabel='Confirm'] - Confirm button label
 * @param {string} [props.cancelLabel='Cancel'] - Cancel button label
 * @param {'primary' | 'destructive'} [props.confirmVariant='primary'] - Confirm button variant
 * @param {boolean} [props.confirmDisabled=false] - Disables the confirm button
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
  confirmDisabled = false,
  onConfirm,
  onCancel,
}) {
  const theme = useTheme();

  const confirmBg =
    confirmVariant === 'destructive' ? theme.destructive : theme.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        {/* Bubble-phase guard, not capture: taps on the card's own padding
            stay put, while the buttons below it still get their own touch. */}
        <View
          style={[
            styles.dialog,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
            },
          ]}
          onStartShouldSetResponder={() => true}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          {message && (
            <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
          )}
          {children}
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.buttonText, { color: theme.text }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={confirmDisabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: confirmDisabled }}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: confirmBg },
                pressed && styles.pressed,
                confirmDisabled && styles.disabled,
              ]}>
              <Text style={[styles.buttonText, { color: theme.primaryText }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
