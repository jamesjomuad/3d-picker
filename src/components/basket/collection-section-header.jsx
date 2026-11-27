import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, Typography } from '@/constants/theme';

/**
 * Always-expanded date header for a Collection group card.
 *
 * No disclosure control: every group stays open, so the header only presents
 * the local date label and how many combinations it holds. It sits outside
 * the card; the card below is the group's only surface.
 *
 * @param {Object} props
 * @param {string} props.title - Today, Yesterday, or full local date
 * @param {number} props.count - combinations saved on that date
 * @param {number} [props.width] - centred column width
 */
export function CollectionSectionHeader({ title, count, width }) {
  return (
    <View style={[styles.header, { width }]} accessibilityRole="header">
      <ThemedText type="smallBold" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.count}>
        {count} {count === 1 ? 'combination' : 'combinations'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: Typography.size.bodyLarge,
    fontWeight: Typography.weight.semibold,
    lineHeight: Typography.lineHeight.bodyLarge,
  },
  count: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    fontVariant: ['tabular-nums'],
  },
});
