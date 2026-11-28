import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Share, StyleSheet, View } from 'react-native';

import { BasketEntrySheet } from '@/components/basket/basket-entry-sheet';
import { CollectionGroupCard } from '@/components/basket/collection-group-card';
import { CollectionSearchField } from '@/components/basket/collection-search-field';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { closeAllSwipeActions } from '@/components/ui/swipe-action-row';
import { Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useScreenInsets } from '@/hooks/use-screen-insets';
import { useTheme } from '@/hooks/use-theme';
import { useBasketStore } from '@/store/basketStore';
import { useCollectionSelectionStore } from '@/store/collectionSelectionStore';
import { useLibraryStore } from '@/store/libraryStore';
import { buildBasketShareText } from '@/utils/basket-format';
import { groupBasketEntries } from '@/utils/basket-grouping';
import { areAllVisibleSelected } from '@/utils/basket-selection';
import { filterBasketEntries } from '@/utils/basket-search';
import { buildPlotHighlights } from '@/utils/plot-highlights';
import {
  PLOT_PARAM,
  serializePlotRequest,
  validatePlotRequest,
} from '@/utils/plot-combination';

/**
 * Collection tab — the Selection Basket
 *
 * The dedicated collection view for the picks saved from Fun Pick. Picks sit
 * in permanently expanded groups by the local date they were added, newest
 * date first and newest pick first inside a day. A fixed search field filters
 * the visible list in memory by digits or cell coordinates; it never edits
 * the persisted basket or the store.
 *
 * It reads and writes only the basket store, so nothing here — sharing,
 * searching, clearing, switching tabs — touches Fun Pick's generation, search
 * or filter state, and the counts on both sides update from the same source.
 *
 * The list virtualises date groups rather than individual rows: "Add to
 * Collection" can save a whole generated batch at once, so the basket can grow
 * far beyond the number of rows it is sensible to mount at one time. Each
 * group is one always-expanded card with its header outside; there is no
 * collapse control.
 *
 * Tapping a row opens its detail sheet; the sheet's Plot action and embedded
 * board preview plot the pick. Plotting sends only the saved digits and
 * coordinates to the Picker, which validates them against whichever board is
 * active *then* — the Collection never switches boards or edits a grid.
 *
 * The preview uses the same search-style colour layer as the plotted board,
 * so every matching path is visible before the tap.
 *
 * Browse mode also offers a deliberate left swipe on a row to reveal Remove.
 * Select mode replaces that gesture with a checkbox and keeps its temporary
 * digit IDs outside the persisted basket. Select All limits itself to the
 * currently displayed search results; hidden picks are never bulk removed.
 */
export default function CollectionScreen() {
  const theme = useTheme();
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { contentPadding, contentWidth } = useScreenInsets();

  const entries = useBasketStore((state) => state.entries);
  const isLoaded = useBasketStore((state) => state.isLoaded);
  const load = useBasketStore((state) => state.load);
  const remove = useBasketStore((state) => state.remove);
  const removeMany = useBasketStore((state) => state.removeMany);
  const clear = useBasketStore((state) => state.clear);

  const boards = useLibraryStore((state) => state.boards);
  const activeBoardId = useLibraryStore((state) => state.activeBoardId);
  const loadLibrary = useLibraryStore((state) => state.loadLibrary);
  const activeBoard =
    boards.find((board) => board.id === activeBoardId) || boards[0] || null;

  const [query, setQuery] = useState('');
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [pendingRemoveDigits, setPendingRemoveDigits] = useState(null);
  // Digits are the basket's stable identity, so the sheet always resolves the
  // current entry from the store even if the list changes while it is open.
  const [selectedDigits, setSelectedDigits] = useState(null);
  const [showBulkRemoveDialog, setShowBulkRemoveDialog] = useState(false);

  const filteredEntries = useMemo(
    () => filterBasketEntries(entries, query),
    [entries, query]
  );
  const sections = useMemo(() => groupBasketEntries(filteredEntries), [filteredEntries]);
  const visibleIds = useMemo(
    () => filteredEntries.map((entry) => entry.digits),
    [filteredEntries]
  );
  // Subscribe to primitives only. A checkbox toggle changes row subscriptions,
  // not the grouped list data or every row's props.
  const selectionMode = useCollectionSelectionStore((state) => state.selectionMode);
  const selectedCount = useCollectionSelectionStore((state) => state.selectedIds.size);
  const allVisibleSelected = useCollectionSelectionStore((state) =>
    areAllVisibleSelected(state.selectedIds, visibleIds)
  );

  const selectedEntry = entries.find((entry) => entry.digits === selectedDigits) ?? null;
  const pendingRemoveEntry =
    entries.find((entry) => entry.digits === pendingRemoveDigits) ?? null;
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

  useEffect(() => {
    useCollectionSelectionStore
      .getState()
      .pruneAvailable(entries.map((entry) => entry.digits));
  }, [entries]);

  const closeOpenSwipes = useCallback(() => closeAllSwipeActions(), []);

  const handleShare = async () => {
    if (entries.length === 0) return;
    closeOpenSwipes();
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
  // and memoised rows only re-render when their own entry changes.
  const handleSelect = useCallback(
    (digits) => {
      closeOpenSwipes();
      setSelectedDigits(digits);
    },
    [closeOpenSwipes]
  );

  const handleQueryChange = useCallback(
    (nextQuery) => {
      closeOpenSwipes();
      setQuery(nextQuery);
    },
    [closeOpenSwipes]
  );

  const handleClearQuery = useCallback(() => {
    closeOpenSwipes();
    setQuery('');
  }, [closeOpenSwipes]);

  const handleRequestRemove = useCallback(
    (digits) => {
      closeOpenSwipes();
      setPendingRemoveDigits(digits);
    },
    [closeOpenSwipes]
  );
  const handleCancelRemove = useCallback(() => setPendingRemoveDigits(null), []);
  const handleConfirmRemove = useCallback(() => {
    if (pendingRemoveDigits === null) return;
    remove(pendingRemoveDigits);
    useCollectionSelectionStore.getState().removeSelected([pendingRemoveDigits]);
    setSelectedDigits(null);
    setPendingRemoveDigits(null);
  }, [pendingRemoveDigits, remove]);

  const handleStartSelection = useCallback(() => {
    closeOpenSwipes();
    setSelectedDigits(null);
    useCollectionSelectionStore.getState().startSelection();
  }, [closeOpenSwipes]);

  const handleCancelSelection = useCallback(() => {
    closeOpenSwipes();
    useCollectionSelectionStore.getState().cancelSelection();
  }, [closeOpenSwipes]);

  const handleSelectAll = useCallback(() => {
    if (visibleIds.length === 0 || allVisibleSelected) return;
    useCollectionSelectionStore.getState().selectVisible(visibleIds);
  }, [allVisibleSelected, visibleIds]);

  const handleOpenBulkRemove = useCallback(() => {
    if (selectedCount === 0) return;
    closeOpenSwipes();
    setShowBulkRemoveDialog(true);
  }, [closeOpenSwipes, selectedCount]);

  const handleCancelBulkRemove = useCallback(() => setShowBulkRemoveDialog(false), []);

  const handleConfirmBulkRemove = useCallback(() => {
    const { selectedIds } = useCollectionSelectionStore.getState();
    if (selectedIds.size === 0) return;
    closeOpenSwipes();
    removeMany([...selectedIds]);
    useCollectionSelectionStore.getState().cancelSelection();
    setShowBulkRemoveDialog(false);
  }, [closeOpenSwipes, removeMany]);

  const handleConfirmClear = useCallback(() => {
    closeOpenSwipes();
    clear();
    setSelectedDigits(null);
    useCollectionSelectionStore.getState().cancelSelection();
    setShowClearDialog(false);
  }, [clear, closeOpenSwipes]);

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
    ({ item }) => (
      <CollectionGroupCard
        section={item}
        width={contentWidth}
        selectedDigits={selectedDigits}
        onSelect={handleSelect}
        onRequestRemove={handleRequestRemove}
      />
    ),
    [contentWidth, selectedDigits, handleSelect, handleRequestRemove]
  );

  const headerPadding = {
    paddingTop: contentPadding.paddingTop,
    paddingLeft: contentPadding.paddingLeft,
    paddingRight: contentPadding.paddingRight,
  };
  const listPadding = { paddingBottom: contentPadding.paddingBottom };

  const header = (
    <View
      style={[
        styles.header,
        headerPadding,
        { backgroundColor: theme.background, borderBottomColor: theme.border },
      ]}>
      <View style={[styles.headerInner, { width: contentWidth }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitle}>
            <ThemedText type="default" style={styles.headerTitleText}>
              Collection
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.countText}>
              {selectionMode
                ? `${selectedCount} selected`
                : `${entries.length} ${entries.length === 1 ? 'pick' : 'picks'} saved`}
            </ThemedText>
          </View>
          <View style={styles.headerActions}>
            {selectionMode ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  style={styles.touchTarget}
                  onPress={handleCancelSelection}
                  icon="xmark">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  style={styles.touchTarget}
                  onPress={handleSelectAll}
                  disabled={visibleIds.length === 0 || allVisibleSelected}
                  icon="checkmark">
                  Select All
                </Button>
              </>
            ) : (
              <>
                {entries.length > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    style={styles.touchTarget}
                    onPress={handleStartSelection}
                    icon="checkmark">
                    Select
                  </Button>
                )}
                {entries.length > 0 && (
                  <Button
                    size="sm"
                    style={styles.touchTarget}
                    onPress={handleShare}
                    icon="square.and.arrow.up">
                    Share
                  </Button>
                )}
              </>
            )}
          </View>
        </View>
        <CollectionSearchField
          value={query}
          onChangeText={handleQueryChange}
          onClear={handleClearQuery}
        />
        {selectionMode && selectedCount > 0 && (
          <View style={styles.selectionToolbar}>
            <ThemedText themeColor="textSecondary" style={styles.selectedText}>
              {selectedCount} {selectedCount === 1 ? 'pick' : 'picks'} selected
            </ThemedText>
            <Button
              size="sm"
              variant="destructive"
              style={styles.touchTarget}
              onPress={handleOpenBulkRemove}
              icon="trash">
              Remove Selected
            </Button>
          </View>
        )}
      </View>
    </View>
  );

  const hasQuery = query.trim().length > 0;
  const emptyState = isLoaded ? (
    <View style={[styles.column, styles.emptyState, { width: contentWidth }]}>
      {hasQuery ? (
        <>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            No saved picks match that search. Try a shorter digit sequence or a cell
            reference like A1.
          </ThemedText>
          <Button
            size="sm"
            style={styles.touchTarget}
            onPress={handleClearQuery}
            icon="xmark.circle">
            Clear search
          </Button>
        </>
      ) : (
        <>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            The basket is empty. Generate combinations in Fun Pick and tap Add on the
            ones worth keeping — they collect here and stay saved.
          </ThemedText>
          <Button
            size="sm"
            style={styles.touchTarget}
            onPress={() => router.navigate('/')}
            icon="sparkles">
            Go to Fun Pick
          </Button>
        </>
      )}
    </View>
  ) : null;

  const footer = entries.length > 0 && (
    <View style={[styles.column, styles.actions, { width: contentWidth }]}>
      <Button
        size="sm"
        variant="outline"
        style={styles.touchTarget}
        onPress={() => setShowClearDialog(true)} icon="trash">
        Clear All
      </Button>
    </View>
  );

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.background }]}
      onTouchStart={closeOpenSwipes}>
      {header}
      <FlatList
        style={styles.list}
        contentContainerStyle={[styles.contentContainer, listPadding]}
        data={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={emptyState}
        ListFooterComponent={footer}
        onScrollBeginDrag={closeOpenSwipes}
        extraData={`${selectedDigits ?? ''}|${query}`}
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
        onRemove={handleRequestRemove}
      />

      <ConfirmDialog
        visible={pendingRemoveEntry !== null}
        title="Remove Pick"
        message={`Remove ${pendingRemoveEntry?.digits ?? ''} from the basket? This cannot be undone.`}
        confirmLabel="Remove"
        confirmVariant="destructive"
        icon="trash"
        onCancel={handleCancelRemove}
        onConfirm={handleConfirmRemove}
      />

      <ConfirmDialog
        visible={showBulkRemoveDialog}
        title="Remove Selected"
        message={`Remove ${selectedCount} selected ${selectedCount === 1 ? 'pick' : 'picks'} from the basket? This cannot be undone.`}
        confirmLabel="Remove"
        confirmVariant="destructive"
        icon="trash"
        onCancel={handleCancelBulkRemove}
        onConfirm={handleConfirmBulkRemove}
      />

      <ConfirmDialog
        visible={showClearDialog}
        title="Clear Basket"
        message={`Remove all ${entries.length} picks from the basket? This cannot be undone.`}
        confirmLabel="Clear"
        confirmVariant="destructive"
        icon="trash"
        onCancel={() => setShowClearDialog(false)}
        onConfirm={handleConfirmClear}
      />
    </View>
  );
}

/**
 * Local date keys identify groups, so each card keeps its identity when a
 * search narrows or widens the visible list.
 */
function keyExtractor(section) {
  return section.key;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    alignSelf: 'center',
    paddingBottom: Spacing.two,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  selectionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  selectedText: {
    flexShrink: 1,
    fontSize: Typography.size.body,
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
  // every Collection control needs the project's minimum touch target.
  touchTarget: {
    minHeight: 44,
    minWidth: 44,
    paddingVertical: Spacing.two,
  },
  actions: {
    marginTop: Spacing.three,
  },
  emptyState: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
  },
});
