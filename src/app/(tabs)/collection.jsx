import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, Share, StyleSheet, View } from 'react-native';

import { BasketEntrySheet } from '@/components/basket/basket-entry-sheet';
import { CollectionGroupCard } from '@/components/basket/collection-group-card';
import { CollectionSearchField } from '@/components/basket/collection-search-field';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ContextualActionSheet } from '@/components/ui/contextual-action-sheet';
import { closeAllSwipeActions } from '@/components/ui/swipe-action-row';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useScreenInsets } from '@/hooks/use-screen-insets';
import { useTheme } from '@/hooks/use-theme';
import { useBasketStore } from '@/store/basketStore';
import { useCollectionSelectionStore } from '@/store/collectionSelectionStore';
import { useLibraryStore } from '@/store/libraryStore';
import { buildBasketShareText } from '@/utils/basket-format';
import { groupBasketEntries } from '@/utils/basket-grouping';
import { areAllVisibleSelected } from '@/utils/basket-selection';
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
 * date first and newest pick first inside a day. A fixed search field and the
 * All/Favorites filter query SQLite by digits or cell coordinates; they never
 * edit the persisted basket.
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
 * entry IDs outside the persisted basket. The first checked pick opens a
 * contextual action sheet whose count stays live. Select All / Deselect All
 * limits itself to the currently displayed results; hidden picks are never
 * changed.
 */
export default function CollectionScreen() {
  const theme = useTheme();
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { contentPadding, contentWidth } = useScreenInsets();

  const entries = useBasketStore((state) => state.entries);
  const isLoaded = useBasketStore((state) => state.isLoaded);
  const filter = useBasketStore((state) => state.filter);
  const query = useBasketStore((state) => state.query);
  const totalCount = useBasketStore((state) => state.totalCount);
  const favoriteCount = useBasketStore((state) => state.favoriteCount);
  const load = useBasketStore((state) => state.load);
  const getAllEntries = useBasketStore((state) => state.getAllEntries);
  const setFilter = useBasketStore((state) => state.setFilter);
  const setQuery = useBasketStore((state) => state.setQuery);
  const remove = useBasketStore((state) => state.remove);
  const removeMany = useBasketStore((state) => state.removeMany);
  const toggleFavorite = useBasketStore((state) => state.toggleFavorite);
  const clear = useBasketStore((state) => state.clear);

  const boards = useLibraryStore((state) => state.boards);
  const activeBoardId = useLibraryStore((state) => state.activeBoardId);
  const loadLibrary = useLibraryStore((state) => state.loadLibrary);
  const activeBoard =
    boards.find((board) => board.id === activeBoardId) || boards[0] || null;

  const [showClearDialog, setShowClearDialog] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState(null);
  // Stable entry IDs keep the sheet attached to its row even when the active
  // filter or search changes while the sheet is open.
  const [selectedId, setSelectedId] = useState(null);
  const [showBulkRemoveDialog, setShowBulkRemoveDialog] = useState(false);
  const [showSelectionSheet, setShowSelectionSheet] = useState(false);
  const selectionSheetRef = useRef(null);

  const sections = useMemo(() => groupBasketEntries(entries), [entries]);
  const visibleIds = useMemo(() => entries.map((entry) => entry.id), [entries]);
  // Subscribe to primitives only. A checkbox toggle changes row subscriptions,
  // not the grouped list data or every row's props.
  const selectionMode = useCollectionSelectionStore((state) => state.selectionMode);
  const selectedCount = useCollectionSelectionStore((state) => state.selectedIds.size);
  const allVisibleSelected = useCollectionSelectionStore((state) =>
    areAllVisibleSelected(state.selectedIds, visibleIds)
  );

  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? null;
  const pendingRemoveEntry =
    entries.find((entry) => entry.id === pendingRemoveId) ?? null;
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
      .pruneAvailable(entries.map((entry) => entry.id));
  }, [entries]);

  // The sheet follows the temporary selection rather than owning it. First
  // check opens it; zero checks closes it; the confirmation dialog takes its
  // place without losing the selected IDs.
  useEffect(() => {
    if (showBulkRemoveDialog) return;
    if (!selectionMode || selectedCount === 0) {
      if (showSelectionSheet) {
        selectionSheetRef.current?.dismiss(() => setShowSelectionSheet(false));
      }
      return;
    }
    setShowSelectionSheet(true);
  }, [selectionMode, selectedCount, showSelectionSheet, showBulkRemoveDialog]);

  const closeOpenSwipes = useCallback(() => closeAllSwipeActions(), []);

  const handleShare = async () => {
    if (totalCount === 0) return;
    closeOpenSwipes();
    try {
      const allEntries = await getAllEntries();
      await Share.share({
        title: '3D Picker – Selection Basket',
        message: buildBasketShareText(allEntries),
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
    (id) => {
      closeOpenSwipes();
      setSelectedId(id);
    },
    [closeOpenSwipes]
  );

  const handleToggleFavorite = useCallback(
    (id, isFavorite) => {
      toggleFavorite(id, isFavorite);
    },
    [toggleFavorite]
  );

  const handleFilterChange = useCallback(
    (nextFilter) => {
      closeOpenSwipes();
      setFilter(nextFilter);
    },
    [closeOpenSwipes, setFilter]
  );

  const handleQueryChange = useCallback(
    (nextQuery) => {
      closeOpenSwipes();
      setQuery(nextQuery);
    },
    [closeOpenSwipes, setQuery]
  );

  const handleClearQuery = useCallback(() => {
    closeOpenSwipes();
    setQuery('');
  }, [closeOpenSwipes, setQuery]);

  const handleRequestRemove = useCallback(
    (id) => {
      closeOpenSwipes();
      setPendingRemoveId(id);
    },
    [closeOpenSwipes]
  );
  const handleCancelRemove = useCallback(() => setPendingRemoveId(null), []);
  const handleConfirmRemove = useCallback(() => {
    if (pendingRemoveId === null) return;
    remove(pendingRemoveId);
    useCollectionSelectionStore.getState().removeSelected([pendingRemoveId]);
    setSelectedId(null);
    setPendingRemoveId(null);
  }, [pendingRemoveId, remove]);

  const handleStartSelection = useCallback(() => {
    closeOpenSwipes();
    setSelectedId(null);
    useCollectionSelectionStore.getState().startSelection();
  }, [closeOpenSwipes]);

  const handleCancelSelection = useCallback(() => {
    closeOpenSwipes();
    setShowSelectionSheet(false);
    useCollectionSelectionStore.getState().cancelSelection();
  }, [closeOpenSwipes]);

  const handleSelectAll = useCallback(() => {
    if (visibleIds.length === 0) return;
    const store = useCollectionSelectionStore.getState();
    if (allVisibleSelected) {
      store.removeSelected(visibleIds);
      return;
    }
    store.selectVisible(visibleIds);
  }, [allVisibleSelected, visibleIds]);

  const handleOpenBulkRemove = useCallback(() => {
    if (selectedCount === 0) return;
    closeOpenSwipes();
    selectionSheetRef.current?.dismiss(() => {
      setShowSelectionSheet(false);
      setShowBulkRemoveDialog(true);
    });
  }, [closeOpenSwipes, selectedCount]);

  const handleCancelBulkRemove = useCallback(() => {
    setShowBulkRemoveDialog(false);
    if (useCollectionSelectionStore.getState().selectedIds.size > 0) {
      setShowSelectionSheet(true);
    }
  }, []);

  const handleConfirmBulkRemove = useCallback(() => {
    const { selectedIds } = useCollectionSelectionStore.getState();
    if (selectedIds.size === 0) return;
    closeOpenSwipes();
    removeMany([...selectedIds]);
    useCollectionSelectionStore.getState().cancelSelection();
    setShowBulkRemoveDialog(false);
    setShowSelectionSheet(false);
  }, [closeOpenSwipes, removeMany]);

  const selectionActions = useMemo(
    () => [
      {
        id: 'select-all',
        label: allVisibleSelected ? 'Deselect All' : 'Select All',
        icon: allVisibleSelected ? 'xmark' : 'checkmark',
        onPress: handleSelectAll,
        disabled: visibleIds.length === 0,
      },
      {
        id: 'remove-selected',
        label: 'Remove Selected',
        icon: 'trash',
        onPress: handleOpenBulkRemove,
        destructive: true,
        disabled: selectedCount === 0,
      },
    ],
    [
      allVisibleSelected,
      handleOpenBulkRemove,
      handleSelectAll,
      selectedCount,
      visibleIds.length,
    ]
  );

  const handleConfirmClear = useCallback(() => {
    closeOpenSwipes();
    clear();
    setSelectedId(null);
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

    setSelectedId(null);
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
        selectedId={selectedId}
        onSelect={handleSelect}
        onRequestRemove={handleRequestRemove}
        onToggleFavorite={handleToggleFavorite}
      />
    ),
    [contentWidth, selectedId, handleSelect, handleRequestRemove, handleToggleFavorite]
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
                : `${totalCount} ${totalCount === 1 ? 'pick' : 'picks'} saved`}
            </ThemedText>
          </View>
          {!selectionMode && (
            <View style={styles.headerActions}>
              {totalCount > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  style={styles.touchTarget}
                  onPress={handleStartSelection}
                  icon="checkmark">
                  Select
                </Button>
              )}
              {totalCount > 0 && (
                <Button
                  size="sm"
                  style={styles.touchTarget}
                  onPress={handleShare}
                  icon="square.and.arrow.up">
                  Share
                </Button>
              )}
            </View>
          )}
        </View>
        <CollectionSearchField
          value={query}
          onChangeText={handleQueryChange}
          onClear={handleClearQuery}
        />
        <View style={styles.filterRow}>
          {[
            { value: 'all', label: 'All', labelText: 'Show all saved picks' },
            { value: 'favorites', label: `Favorites (${favoriteCount})`, labelText: 'Show favorite picks only' },
          ].map((option) => {
            const isActive = filter === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => handleFilterChange(option.value)}
                accessibilityRole="button"
                accessibilityLabel={option.labelText}
                accessibilityState={{ selected: isActive }}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? theme.primary : theme.backgroundElement,
                    borderColor: isActive ? theme.primary : theme.border,
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText
                  style={[
                    styles.filterChipText,
                    { color: isActive ? theme.primaryText : theme.text },
                  ]}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  const hasQuery = query.trim().length > 0;
  const hasFavoritesFilter = filter === 'favorites';
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
      ) : hasFavoritesFilter ? (
        <>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            No favorites yet. Tap a star on any saved pick to keep it here.
          </ThemedText>
          <Button
            size="sm"
            style={styles.touchTarget}
            onPress={() => handleFilterChange('all')}
            icon="star.slash">
            Show all picks
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

  const footer = totalCount > 0 && (
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
        extraData={`${selectedId ?? ''}|${query}|${filter}`}
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
        onClose={() => setSelectedId(null)}
        onPlot={handlePlot}
        onRemove={handleRequestRemove}
      />

      <ContextualActionSheet
        ref={selectionSheetRef}
        visible={showSelectionSheet}
        title={`${selectedCount} ${selectedCount === 1 ? 'pick' : 'picks'} selected`}
        actions={selectionActions}
        onCancel={handleCancelSelection}
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
        message={`Remove all ${totalCount} picks from the basket? This cannot be undone.`}
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
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  filterChip: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
  },
  pressed: {
    opacity: 0.7,
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
