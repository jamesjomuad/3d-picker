import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Compact settings row
 *
 * One line inside a SettingsSection panel: leading glyph, label, current
 * value, and either a custom trailing control (a value display already
 * counts) or a chevron disclosure when the row navigates or opens a
 * sheet. Rows without `onPress` render as static text and never look
 * tappable. Touch target is 52dp, above the 44dp floor.
 *
 * @param {Object} props
 * @param {{ ios: string, android: string, web: string }} [props.icon] - SymbolView name set
 * @param {string} props.label - Row title
 * @param {string} [props.value] - Current value, right-aligned before the control
 * @param {() => void} [props.onPress] - Makes the row interactive
 * @param {React.ReactNode} [props.trailing] - Replaces the default disclosure
 * @param {boolean} [props.destructive] - Tints icon, label and chevron red
 * @param {string} [props.accessibilityLabel] - Overrides the default label
 */
export function SettingsRow({
  icon,
  label,
  value,
  onPress,
  trailing,
  destructive = false,
  accessibilityLabel,
}) {
  const theme = useTheme();
  const tint = destructive ? theme.destructive : theme.textSecondary;

  const content = (
    <>
      {icon ? <SymbolView name={icon} size={18} tintColor={tint} /> : null}
      <ThemedText
        themeColor={destructive ? 'destructive' : 'text'}
        style={styles.label}
        numberOfLines={1}>
        {label}
      </ThemedText>
      {value ? (
        <ThemedText themeColor="textSecondary" style={styles.value} numberOfLines={1}>
          {value}
        </ThemedText>
      ) : null}
      {trailing !== undefined
        ? trailing
        : onPress && (
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={13}
              weight="semibold"
              tintColor={tint}
              style={styles.chevron}
            />
          )}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (value ? `${label}, ${value}` : label)
      }
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  label: {
    flex: 1,
    fontSize: 16,
  },
  value: {
    fontSize: 15,
    flexShrink: 1,
  },
  chevron: {
    opacity: 0.7,
    marginLeft: Spacing.half,
  },
});
