import { StyleSheet, Text, TextInput as RNTextInput, View } from 'react-native';

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
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 16,
    minHeight: 44,
  },
  error: {
    fontSize: 13,
    marginTop: Spacing.one,
    fontWeight: '500',
  },
});
