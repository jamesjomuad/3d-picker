import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Share, StyleSheet, View } from 'react-native';

import { BasketEntrySheet } from '@/components/basket/basket-entry-sheet';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useScreenInsets } from '@/hooks/use-screen-insets';
import { useTheme } from '@/hooks/use-theme';
import { useBasketStore } from '@/store/basketStore';
import { useLibraryStore } from '@/store/libraryStore';
import { buildBasketShareText, formatAddedAt } from '@/utils/basket-format';
import { getPathReference } from '@/utils/cell-reference';
import { buildPlotHighlights } from '@/utils/plot-highlights';
import {
  PLOT_PARAM,
  serializePlotRequest,
  validatePlotRequest,
} from '@/utils/plot-combination';

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
 *
 * Tapping a row opens its detail sheet; tapping the active-board preview in
 * that sheet plots the pick. Plotting sends only the saved digits and
 * coordinates to the Picker, which validates them against whichever board is
 * active *then* — the Collection never switches boards or edits a grid.
 *
 * The preview uses the same search-style colour layer as the plotted board,
 * so every matching path is visible before the tap.
 */
export default function CollectionScreen() {
  const theme = useTheme();
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { contentPadding, contentWidth } = useScreenInsets();

  const entries = useBasketStore((state) => state.entries);
  const isLoaded = useBasketStore((state) => state.isLoaded);
  const load = useBasketStore((state) => state.load);
  const remove = useBasketStore((state) => state.remove);
  const clear = useBasketStore((state) => state.clear);

  const boards = useLibraryStore((state) => state.boards);
  const activeBoardId = useLibraryStore((state) => state.activeBoardId);
  const loadLibrary = useLibraryStore((state) => state.loadLibrary);
  const activeBoard =
    boards.find((board) => board.id === activeBoardId) || boards[0] || null;

  const [showClearDialog, setShowClearDialog] = useState(false);
  // Digits are the basket's stable identity, so the sheet always resolves the
  // current entry from the store even if the list changes while it is open.
  const [selectedDigits, setSelectedDigits] = useState(null);

  const selectedEntry = entries.find((entry) => entry.digits === selectedDigits) ?? null;
  const plotPreview = selectedEntry
    ? validatePlotRequest(selectedEntry, activeBoard?.grid)
    : null;
  const plotHighlights = useMemo(
    () =>
      plotPreview?.valid
        ? buildPlotHighlights(activeBoard.grid, selectedEntry.digits, selectedEntry.path, mode)
        : null,
    [plotPreview, activeBoard, selectedEntry, mode]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

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

  // Zustand actions are stable, so these handlers stay referentially stable
  // and memoised rows only re-render when their own entry or index changes.
  const handleRemove = useCallback((digits) => remove(digits), [remove]);
  const handleSelect = useCallback((digits) => setSelectedDigits(digits), []);

  const handlePlot = useCallback(() => {
    if (!selectedEntry) return;

    // Validate before navigating: a saved pick may come from a differently
    // sized board, and plotting must never land on the wrong cell or fall back
    // to its source board.
    const result = validatePlotRequest(selectedEntry, activeBoard?.grid);
    if (!result.valid) {
      Alert.alert('Cannot plot pick', result.error);
      return;
    }

    setSelectedDigits(null);
    router.navigate({
      pathname: '/',
      params: { [PLOT_PARAM]: serializePlotRequest(selectedEntry) },
    });
  }, [activeBoard, selectedEntry]);

  const renderItem = useCallback(
    ({ item, index }) => (
      <BasketRow
        entry={item}
        index={index}
        width={contentWidth}
        onSelect={handleSelect}
        onRemove={handleRemove}
      />
    ),
    [contentWidth, handleSelect, handleRemove]
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

      <BasketEntrySheet
        visible={selectedEntry !== null}
        entry={selectedEntry}
        activeBoardName={activeBoard?.name ?? null}
        preview={
          plotPreview?.valid
            ? {
                grid: activeBoard.grid,
                cells: plotPreview.cells,
                highlights: plotHighlights?.highlights ?? null,
                matchCount: plotHighlights?.results.length ?? 0,
              }
            : null
        }
        plotError={plotPreview && !plotPreview.valid ? plotPreview.error : null}
        onClose={() => setSelectedDigits(null)}
        onPlot={handlePlot}
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
 * reformats this row's path or timestamp. The text area opens the detail
 * sheet; Remove stays a sibling button so there are no nested Pressables.
 */
const BasketRow = memo(function BasketRow({ entry, index, width, onSelect, onRemove }) {
  const addedAt = formatAddedAt(entry.addedAt);

  return (
    <View style={[styles.column, styles.row, { width }]}>
      <Pressable
        onPress={() => onSelect(entry.digits)}
        accessibilityRole="button"
        accessibilityLabel={`Open details for ${entry.digits}`}
        style={({ pressed }) => [styles.rowText, pressed && styles.rowTextPressed]}>
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
      </Pressable>
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
    fontSize: Typography.size.title,
    lineHeight: Typography.lineHeight.title,
    fontWeight: Typography.weight.semibold,
  },
  countText: {
    fontSize: Typography.size.body,
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
  rowTextPressed: {
    opacity: 0.7,
  },
  digits: {
    fontSize: Typography.size.title,
    lineHeight: Typography.lineHeight.title,
    fontVariant: ['tabular-nums'],
  },
  metaText: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
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
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
  },
});
