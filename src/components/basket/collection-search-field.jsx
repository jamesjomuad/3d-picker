import { StyleSheet, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { InputClearButton } from '@/components/ui/input-clear-button';
import { BorderRadius, Spacing, TouchTarget, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Compact Collection search field.
 *
 * The screen owns the query and filters in memory on every keystroke. This
 * field stays in the fixed header so it remains reachable while the grouped
 * list scrolls, and its clear button is a full-size sibling tap target.
 * Digits and cell references share one default keyboard; neither needs a
 * numeric-only pad that would hide the letters used by coordinates.
 *
 * @param {Object} props
 * @param {string} props.value
 * @param {(text: string) => void} props.onChangeText
 * @param {() => void} props.onClear
 * @param {Object} [props.style]
 */
export function CollectionSearchField({ value, onChangeText, onClear, style }) {
  const theme = useTheme();

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.fieldRow}>
        <View style={styles.searchIcon} pointerEvents="none">
          <AppIcon name="magnifyingglass" size="small" tone="textSecondary" />
        </View>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder="Search digits or cells"
          placeholderTextColor={theme.disabledText}
          accessibilityLabel="Search saved combinations"
          accessibilityHint="Type digits or cell references such as A1"
          returnKeyType="search"
          maxLength={80}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {value.length > 0 ? (
          <InputClearButton onPress={onClear} accessibilityLabel="Clear collection search" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: Spacing.two,
  },
  fieldRow: {
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: Spacing.two,
    top: 0,
    height: TouchTarget,
    justifyContent: 'center',
  },
  input: {
    minHeight: TouchTarget,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
    paddingLeft: Spacing.four,
    paddingRight: Spacing.four + Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
  },
});
