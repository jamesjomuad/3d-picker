import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FoldableCard } from '@/components/ui/foldable-card';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Foldable "Coming Soon" card
 *
 * The honest placeholder for features that do not exist yet: collapsed it
 * shows the planned feature's title and a Coming Soon badge; expanded it
 * explains the plan in one or two lines. It deliberately contains no
 * switches, pickers or buttons — nothing on it may imply the feature
 * already works. Built on the existing FoldableCard so the expand
 * interaction matches the rest of the app.
 *
 * @param {Object} props
 * @param {string} props.title - Planned feature name
 * @param {React.ReactNode} props.children - Short description when expanded
 */
export function ComingSoonCard({ title, children }) {
  const theme = useTheme();

  return (
    <FoldableCard
      title={title}
      defaultExpanded={false}
      trailing={
        <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText themeColor="textSecondary" style={styles.badgeText}>
            COMING SOON
          </ThemedText>
        </View>
      }>
      <ThemedText themeColor="textSecondary" style={styles.description}>
        {children}
      </ThemedText>
    </FoldableCard>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
});
