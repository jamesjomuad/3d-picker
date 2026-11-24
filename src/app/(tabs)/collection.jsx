import { router } from 'expo-router';
import { memo, useCallback, useEffect, useState } from 'react';
import { FlatList, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
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
 * The rows live in a FlatList rather than a ScrollView: "Add to Collection"
 * can save a whole generated batch at once, so the basket can grow far
 * beyond the number of rows it is sensible to mount at one time.
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

  // Zustand actions are stable, so this handler stays referentially stable
  // and memoised rows only re-render when their own entry or index changes.
  const handleRemove = useCallback((digits) => remove(digits), [remove]);

  const renderItem = useCallback(
    ({ item, index }) => (
      <BasketRow entry={item} index={index} width={contentWidth} onRemove={handleRemove} />
    ),
    [contentWidth, handleRemove]
  );

  const header = (
    <View style={[styles.column, styles.headerContainer, { width: contentWidth }]}>
      <View style={styles.headerTop}>
        <View style={styles.headerTitle}>
          <ThemedText type="default" style={styles.headerTitleText}>
            Collection
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.countText}>
            {entries.length} {entries.length === 1 ? 'pick' : 'picks'} saved
          </ThemedText>
        </View>
        {entries.length > 0 && (
          <Button size="sm" style={styles.touchTarget} onPress={handleShare}>
            Share
          </Button>
        )}
      </View>
    </View>
  );

  const emptyState = isLoaded ? (
    <View style={[styles.column, styles.emptyState, { width: contentWidth }]}>
      <ThemedText themeColor="textSecondary" style={styles.emptyText}>
        The basket is empty. Generate combinations in Fun Pick and tap Add on the
        ones worth keeping — they collect here and stay saved.
      </ThemedText>
      <Button
        size="sm"
        style={styles.touchTarget}
        onPress={() => router.navigate('/')}>
        Go to Fun Pick
      </Button>
    </View>
  ) : null;

  const footer = entries.length > 0 && (
    <View style={[styles.column, styles.actions, { width: contentWidth }]}>
      <Button
        size="sm"
        variant="outline"
        style={styles.touchTarget}
        onPress={() => setShowClearDialog(true)}>
        Clear All
      </Button>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <FlatList
        style={styles.list}
        contentContainerStyle={[styles.contentContainer, contentPadding]}
        data={entries}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={emptyState}
        ListFooterComponent={footer}
      />

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
    </View>
  );
}

/**
 * Digits identify basket entries (the store refuses duplicates), so they
 * make a stable key across removals and reordering.
 */
function keyExtractor(entry) {
  return entry.digits;
}

/**
 * One saved pick. Memoised so adding or removing another entry never
 * reformats this row's path or timestamp; only `onRemove` is needed from
 * the parent, and it is a stable callback.
 */
const BasketRow = memo(function BasketRow({ entry, index, width, onRemove }) {
  const addedAt = formatAddedAt(entry.addedAt);

  return (
    <View style={[styles.column, styles.row, { width }]}>
      <View style={styles.rowText}>
        <ThemedText type="smallBold" style={styles.digits}>
          {index + 1}. {entry.digits}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.metaText}>
          {getPathReference(entry.path)}
        </ThemedText>
        {addedAt ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.metaText}>
            Added {addedAt}
          </ThemedText>
        ) : null}
      </View>
      <Button
        size="sm"
        variant="outline"
        style={styles.touchTarget}
        accessibilityLabel={`Remove ${entry.digits} from basket`}
        onPress={() => onRemove(entry.digits)}>
        Remove
      </Button>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
    flexGrow: 1,
  },
  column: {
    flexShrink: 1,
  },
  // Scoped to this screen: the shared Button's `sm` size is 32dp tall, but
  // every Collection control needs the project's 44dp minimum touch target.
  touchTarget: {
    minHeight: 44,
    minWidth: 44,
    paddingVertical: Spacing.two,
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
  headerTitleText: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
  },
  countText: {
    fontSize: 14,
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
    fontSize: 20,
    lineHeight: 26,
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
