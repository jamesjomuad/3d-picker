import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Combination search field for the Picker screen.
 *
 * Digit combinations separated by commas ("123, 456"): the engine caps the
 * work, not the query. The screen owns the text, debounces it, and decides
 * when a submission settles early; this component just reports typing,
 * submitting and clearing.
 *
 * @param {Object} props
 * @param {string} props.value - current text
 * @param {(text: string) => void} props.onChangeText
 * @param {() => void} props.onSubmit - keyboard search pressed
 * @param {() => void} props.onClear - the × button
 * @param {string} [props.error] - shown under the field, tints the border
 * @param {Object} [props.style]
 */
export function CombinationSearchBar({ value, onChangeText, onSubmit, onClear, error, style }) {
  const theme = useTheme();

  return (
    <View style={style}>
      <ThemedText themeColor="textSecondary" style={styles.label}>
        Combination search
      </ThemedText>

      <View style={styles.fieldRow}>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: error ? theme.destructive : theme.border,
              backgroundColor: theme.background,
              color: theme.text,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder="e.g. 123, 456"
          placeholderTextColor={theme.disabledText}
          // iOS has a digits-and-punctuation pad; Android's number pad has no
          // comma key, so it gets the normal keyboard and types commas there.
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
          returnKeyType="search"
          maxLength={60}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {value.length > 0 && <TextInputClear theme={theme} onPress={onClear} />}
      </View>

      {error ? (
        <ThemedText themeColor="destructive" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * The × sits over the field's right end, big enough for a thumb, with the
 * text given room so a digit never hides under it.
 */
function TextInputClear({ theme, onPress }) {
  return (
    <ThemedText
      type="linkPrimary"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Clear search"
      style={[styles.clear, { color: theme.textSecondary }]}>
      ×
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: Spacing.one,
  },
  fieldRow: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.two,
    // Room for the clear button at the right end.
    paddingRight: Spacing.four + Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 18,
    fontFamily: Fonts.mono,
    minHeight: 44,
  },
  clear: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: 44,
    paddingHorizontal: Spacing.three,
    fontSize: 22,
    lineHeight: 44,
  },
  error: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: Spacing.one,
  },
});
