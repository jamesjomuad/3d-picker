import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Separator component
 * Thin line divider for visual separation
 *
 * @param {Object} props
 * @param {'horizontal' | 'vertical'} [props.orientation='horizontal'] - Line direction
 * @param {number} [props.spacing=Spacing.two] - Margin around the separator
 * @param {Object} [props.style] - Additional styles
 */
export function Separator({ orientation = 'horizontal', spacing = Spacing.two, style }) {
  const theme = useTheme();
  const isHorizontal = orientation === 'horizontal';

  return (
    <View
      style={[
        styles.base,
        isHorizontal ? styles.horizontal : styles.vertical,
        { backgroundColor: theme.border },
        isHorizontal
          ? { marginVertical: spacing }
          : { marginHorizontal: spacing },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    // Uses hairline width via StyleSheet.hairlineWidth on the appropriate dimension
  },
  horizontal: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  vertical: {
    width: StyleSheet.hairlineWidth,
    height: '100%',
  },
});
