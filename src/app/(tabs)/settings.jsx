import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FoldableCard } from '@/components/ui/foldable-card';
import { Spacing } from '@/constants/theme';
import { useScreenInsets } from '@/hooks/use-screen-insets';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const { contentPadding, contentWidth } = useScreenInsets();

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, contentPadding]}>
      <View style={[styles.innerContainer, { width: contentWidth }]}>
        <ThemedView style={styles.headerContainer}>
          <ThemedText type="subtitle">Settings</ThemedText>
        </ThemedView>

        <FoldableCard title="Preferences" subtitle="Application preferences" defaultExpanded={false}>
          <ThemedText themeColor="textSecondary">Coming soon</ThemedText>
        </FoldableCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
    flexGrow: 1,
  },
  innerContainer: {
    flexShrink: 1,
  },
  headerContainer: {
    gap: Spacing.half,
    marginBottom: Spacing.three,
  },
});
