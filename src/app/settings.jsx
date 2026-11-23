import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const contentWidth = Math.min(width - Spacing.three * 2, MaxContentWidth);
  const paddingBottom = insets.bottom + BottomTabInset + Spacing.three;

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, { paddingBottom }]}
      contentInset={{
        top: insets.top,
        left: insets.left,
        right: insets.right,
      }}>
      <View style={[styles.innerContainer, { width: contentWidth }]}>
        <ThemedView style={styles.headerContainer}>
          <ThemedText type="subtitle">Settings</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitleText}>
            Application preferences — coming soon
          </ThemedText>
        </ThemedView>
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
    paddingTop: Spacing.three,
  },
  innerContainer: {
    flexShrink: 1,
  },
  headerContainer: {
    gap: Spacing.half,
    marginBottom: Spacing.three,
  },
  subtitleText: {
    fontSize: 14,
  },
});
