import { SymbolView } from 'expo-symbols';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Option picker bottom sheet
 *
 * A radio-style choice presented as a real Modal anchored to the bottom:
 * the dim backdrop dismisses on an outside tap, the Android back gesture
 * arrives through onRequestClose, and taps inside the sheet are captured
 * so they never fall through. One row per option, a checkmark on the
 * current value, Cancel at the end. Choosing closes the sheet first, then
 * reports the value, so the caller's state update never races the
 * animation. Long lists scroll inside a capped sheet.
 *
 * @param {Object} props
 * @param {boolean} props.visible
 * @param {string} props.title - Sheet header (the setting's name)
 * @param {Array<{ value: string, label: string }>} props.options
 * @param {string} props.value - Currently selected option value
 * @param {(value: string) => void} props.onSelect
 * @param {() => void} props.onClose
 */
export function OptionSheet({ visible, title, options, value, onSelect, onClose }) {
  const theme = useTheme();

  const pick = (option) => () => {
    onClose();
    if (option.value !== value) onSelect(option.value);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={`Dismiss ${title} options`}>
        <View
          style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}
          // Bubble phase, not capture: a capture handler here would claim the
          // touch before any row beneath it and leave the whole sheet inert.
          onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.headerTitle}>
              {title}
            </ThemedText>
          </View>

          <ScrollView style={styles.list} bounces={false}>
            {options.map((option, index) => (
              <View key={option.value}>
                {index > 0 && (
                  <View style={[styles.rowSeparator, { backgroundColor: theme.border }]} />
                )}
                <Pressable
                  onPress={pick(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: option.value === value }}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                  <ThemedText
                    style={styles.rowLabel}
                    themeColor={option.value === value ? 'primary' : 'text'}
                    numberOfLines={1}>
                    {option.label}
                  </ThemedText>
                  {option.value === value && (
                    <SymbolView
                      name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                      size={16}
                      weight="semibold"
                      tintColor={theme.primary}
                    />
                  )}
                </Pressable>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, styles.cancelRow, pressed && styles.pressed]}>
            <ThemedText style={[styles.rowLabel, styles.cancelLabel]} themeColor="textSecondary">
              Cancel
            </ThemedText>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    paddingHorizontal: Spacing.two,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerTitle: {
    fontSize: Typography.size.body,
    opacity: 0.7,
  },
  list: {
    maxHeight: 340,
  },
  row: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.md,
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.three,
    marginRight: Spacing.three,
  },
  rowLabel: {
    fontSize: Typography.size.bodyLarge,
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.one,
  },
  cancelRow: {
    justifyContent: 'center',
  },
  cancelLabel: {
    fontWeight: Typography.weight.semibold,
  },
});
