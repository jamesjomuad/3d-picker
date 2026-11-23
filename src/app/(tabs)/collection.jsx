import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useScreenInsets } from '@/hooks/use-screen-insets';
import { useTheme } from '@/hooks/use-theme';
import { useBasketStore } from '@/store/basketStore';
import { buildBasketShareText, formatAddedAt } from '@/utils/basket-format';
import { getPathReference } from '@/utils/cell-reference';

/**
 * Collection tab — the Selection Basket
 *
 * The dedicated collection view for the picks saved from Fun Pick: every
 * combination with its board reference and the local date and time it was
 * added, a per-row Remove, header Share, and a confirm-to-clear action.
 * It reads and writes only the basket store, so nothing here — sharing,
 * clearing, switching tabs — touches Fun Pick's generation, search or
 * filter state, and the counts on both sides update from the same source.
 *
 * It lives in the tab group, reached from the Collection tab (badged with
 * the saved count).
 */
export default function CollectionScreen() {
  const theme = useTheme();
  const { contentPadding, contentWidth } = useScreenInsets();

  const entries = useBasketStore((state) => state.entries);
  const isLoaded = useBasketStore((state) => state.isLoaded);
  const load = useBasketStore((state) => state.load);
  const remove = useBasketStore((state) => state.remove);
  const clear = useBasketStore((state) => state.clear);

  const [showClearDialog, setShowClearDialog] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  const handleShare = async () => {
    if (entries.length === 0) return;
    try {
      await Share.share({
        title: '3D Picker – Selection Basket',
        message: buildBasketShareText(entries),
      });
    } catch (error) {
      // The Android sheet can reject when dismissed; the collection is
      // intact either way, and sharing never clears or modifies it.
      console.warn('Share dismissed or failed:', error);
    }
  };

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, contentPadding]}>
      <View style={[styles.innerContainer, { width: contentWidth }]}>
        {/* Header */}
        <ThemedView style={styles.headerContainer}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitle}>
              <ThemedText type="subtitle">Collection</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.countText}>
                {entries.length} {entries.length === 1 ? 'pick' : 'picks'} saved
              </ThemedText>
            </View>
            {entries.length > 0 && (
              <Button size="sm" onPress={handleShare}>
                Share
              </Button>
            )}
          </View>
        </ThemedView>

        {entries.length === 0 ? (
          isLoaded ? (
            <ThemedView style={styles.emptyState}>
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                The basket is empty. Generate combinations in Fun Pick and tap Add on the
                ones worth keeping — they collect here and stay saved.
              </ThemedText>
              <Button size="sm" onPress={() => router.navigate('/')}>
                Go to Fun Pick
              </Button>
            </ThemedView>
          ) : null
        ) : (
          <>
            <View style={styles.list}>
              {entries.map((entry, index) => (
                <View key={entry.digits} style={styles.row}>
                  <View style={styles.rowText}>
                    <ThemedText type="smallBold" style={styles.digits}>
                      {index + 1}. {entry.digits}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.metaText}>
                      {getPathReference(entry.path)}
                    </ThemedText>
                    {formatAddedAt(entry.addedAt) ? (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.metaText}>
                        Added {formatAddedAt(entry.addedAt)}
                      </ThemedText>
                    ) : null}
                  </View>
                  <Button
                    size="sm"
                    variant="outline"
                    accessibilityLabel={`Remove ${entry.digits} from basket`}
                    onPress={() => remove(entry.digits)}>
                    Remove
                  </Button>
                </View>
              ))}
            </View>

            <View style={styles.actions}>
              <Button size="sm" variant="outline" onPress={() => setShowClearDialog(true)}>
                Clear All
              </Button>
            </View>
          </>
        )}
      </View>

      <ConfirmDialog
        visible={showClearDialog}
        title="Clear Basket"
        message={`Remove all ${entries.length} picks from the basket? This cannot be undone.`}
        confirmLabel="Clear"
        confirmVariant="destructive"
        onCancel={() => setShowClearDialog(false)}
        onConfirm={() => {
          clear();
          setShowClearDialog(false);
        }}
      />
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
    width: '100%',
  },
  headerContainer: {
    marginBottom: Spacing.three,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  headerTitle: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  countText: {
    fontSize: 14,
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  rowText: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
  },
  digits: {
    fontSize: 17,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
  },
  actions: {
    marginTop: Spacing.three,
  },
  emptyState: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: BorderRadius.md,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
});
