import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Compact row of digit buttons (0–9) for choosing a single digit.
 *
 * @param {Object} props
 * @param {number|null} props.value - currently selected digit, or null
 * @param {(digit: number) => void} props.onSelect - called when the user taps a digit
 * @param {string} [props.label] - optional label shown above the row
 */
export function DigitSelector({ value, onSelect, label }) {
  const theme = useTheme();

  return (
    <View>
      {label ? (
        <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      ) : null}
      <View style={styles.row}>
        {Array.from({ length: 10 }, (_, digit) => {
          const isSelected = value === digit;
          return (
            <Pressable
              key={digit}
              onPress={() => onSelect(digit)}
              style={({ pressed }) => [
                styles.digit,
                {
                  backgroundColor: isSelected
                    ? theme.primary
                    : pressed
                      ? theme.backgroundSelected
                      : theme.backgroundElement,
                },
              ]}>
              <Text
                style={[
                  styles.digitText,
                  { color: isSelected ? theme.primaryText : theme.text },
                ]}>
                {digit}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    marginBottom: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  digit: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitText: {
    fontSize: Typography.size.bodyLarge,
    fontWeight: Typography.weight.semibold,
  },
});
