import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Card container component
 * Groups related content with visual separation
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Card content
 * @param {string} [props.title] - Optional card title
 * @param {React.ReactNode} [props.header] - Optional custom header content
 * @param {React.ReactNode} [props.footer] - Optional footer content
 * @param {Object} [props.style] - Additional container styles
 */
export function Card({ children, title, header, footer, style }) {
  const theme = useTheme();

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: theme.border }, style]}>
      {(title || header) && (
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          {header || <ThemedText type="default">{title}</ThemedText>}
        </View>
      )}

      <View style={styles.content}>{children}</View>

      {footer && (
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          {footer}
        </View>
      )}
    </ThemedView>
  );
}

/**
 * Card row for list-like content
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Row content
 * @param {boolean} [props.last] - Remove bottom border for last row
 */
export function CardRow({ children, last = false }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: theme.border },
        last && styles.rowLast,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    padding: Spacing.three,
  },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
});
