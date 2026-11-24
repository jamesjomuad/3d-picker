import { StyleSheet, Text, TextInput as RNTextInput, View } from 'react-native';

import { InputClearButton } from '@/components/ui/input-clear-button';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Text input component with label and theme support
 *
 * @param {Object} props
 * @param {string} [props.label] - Label text above input
 * @param {string} [props.placeholder] - Placeholder text
 * @param {string} [props.value] - Input value (controlled)
 * @param {(text: string) => void} [props.onChangeText] - Change handler
 * @param {() => void} [props.onClear] - Clear handler (defaults to onChangeText(''))
 * @param {boolean} [props.clearable] - Show the × while the field has text
 * @param {string} [props.error] - Error message (shows red border + message)
 * @param {boolean} [props.disabled] - Disabled state
 * @param {boolean} [props.secureTextEntry] - Password input
 * @param {boolean} [props.multiline] - Multi-line input
 * @param {number} [props.numberOfLines] - Number of visible lines (multiline)
 * @param {Object} [props.style] - Additional container styles
 * @param {Object} [props.inputStyle] - Additional input styles
 */
export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  onClear,
  clearable = true,
  error,
  disabled = false,
  secureTextEntry = false,
  multiline = false,
  numberOfLines = 4,
  style,
  inputStyle,
  ...rest
}) {
  const theme = useTheme();
  const hasError = !!error;

  const borderColor = hasError ? theme.destructive : theme.border;
  const backgroundColor = disabled ? theme.disabled : theme.background;
  const textColor = disabled ? theme.disabledText : theme.text;

  // A clear button on an empty or disabled field has nothing to do; the ×
  // appears only while there is text a user could remove.
  const showClear = clearable && !disabled && typeof value === 'string' && value.length > 0;
  const handleClear = onClear ?? (() => onChangeText?.(''));

  return (
    <View style={style}>
      {label && (
        <Text
          style={[
            styles.label,
            { color: hasError ? theme.destructive : theme.textSecondary },
          ]}>
          {label}
        </Text>
      )}

      <View style={styles.fieldRow}>
        <RNTextInput
          style={[
            styles.input,
            {
              borderColor,
              backgroundColor,
              color: textColor,
            },
            multiline && {
              minHeight: numberOfLines * 24,
              textAlignVertical: 'top',
            },
            inputStyle,
            // Guarantee room for the × even when a caller sets its own
            // horizontal padding.
            showClear && styles.inputWithClear,
          ]}
          placeholder={placeholder}
          placeholderTextColor={theme.disabledText}
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : undefined}
          {...rest}
        />

        {showClear && (
          <InputClearButton
            onPress={handleClear}
            accessibilityLabel={label ? `Clear ${label}` : 'Clear text'}
          />
        )}
      </View>

      {error && <Text style={[styles.error, { color: theme.destructive }]}>{error}</Text>}
    </View>
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
    paddingVertical: Spacing.two,
    fontSize: 16,
    minHeight: 44,
  },
  inputWithClear: {
    // Room for the clear button at the right end.
    paddingRight: Spacing.four + Spacing.three,
  },
  error: {
    fontSize: 13,
    marginTop: Spacing.one,
    fontWeight: '500',
  },
});
