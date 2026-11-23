import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AngleBoard, SelectedCellsCard } from '@/components/angle-board';
import { CombinationSearchBar } from '@/components/search/combination-search-bar';
import { CombinationSearchResults } from '@/components/search/combination-search-results';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useScreenInsets } from '@/hooks/use-screen-insets';
import { useTheme } from '@/hooks/use-theme';
import { useAngleBoardStore } from '@/store/angleBoardStore';
import { useLibraryStore } from '@/store/libraryStore';
import { parseCombinationList, searchCombinations } from '@/utils/combination-search';
import { assignResultColors, buildSearchHighlights } from '@/utils/search-highlight-utils';

/**
 * Picker — the Angle Board at full size, with the selection summary under it.
 *
 * The screen owns no board logic. It picks which board to show (the library's
 * active board), holds the selection in the store so the board and the card read
 * one source of truth, and passes both down.
 *
 * Combination search lives here as plain screen state: what is typed, what has
 * settled into a query, which result is being shown. None of it belongs in a
 * store — nothing else reads it, and the board only ever receives derived,
 * coloured cell data from `@/utils/search-highlight-utils`.
 */
export default function PickerScreen() {
  const theme = useTheme();
  const { contentPadding, contentWidth } = useScreenInsets();

  const selection = useAngleBoardStore((state) => state.selectedCells);
  const setSelection = useAngleBoardStore((state) => state.setSelection);
  const clearSelection = useAngleBoardStore((state) => state.clearSelection);

  const isLoaded = useLibraryStore((state) => state.isLoaded);
  const loadLibrary = useLibraryStore((state) => state.loadLibrary);
  const board = useLibraryStore((state) => {
    return state.boards.find((b) => b.id === state.activeBoardId) || state.boards[0] || null;
  });

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // Combination search. `draft` is what the field holds; `query` is what the
  // engine has actually run, once typing pauses or the search key commits it.
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const settledDraft = useDebouncedValue(draft);
  useEffect(() => {
    setQuery(settledDraft);
  }, [settledDraft]);

  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const combinations = useMemo(() => parseCombinationList(query), [query]);
  const isValidQuery = query === '' || combinations !== null;

  // Each combination is searched independently; its paths stay grouped under
  // it in the results card.
  const groups = useMemo(() => {
    if (!combinations) return [];
    return combinations.map((combination) => ({
      combination,
      results: searchCombinations(board?.grid, combination),
    }));
  }, [board, combinations]);

  // One palette colour per combination, shared by every path it matched,
  // recoloured when the system theme flips so board and list keep agreeing.
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const groupColors = useMemo(() => assignResultColors(groups.length, mode), [groups.length, mode]);

  // The board takes one flat list, each result carrying its combination's
  // colour, so overlapping paths still keep every identity that crosses them.
  const flatResults = useMemo(() => groups.flatMap((group) => group.results), [groups]);
  const resultColors = useMemo(
    () => groups.flatMap((group, index) => group.results.map(() => groupColors[index])),
    [groups, groupColors]
  );

  // The board's colour layer: every crossed cell knows the colours of the
  // combinations through it, the emphasised result's cells are solid-filled.
  // Null while nothing matched keeps the board prop-free.
  const highlights = useMemo(
    () => buildSearchHighlights(flatResults, activeIndex, mode, resultColors),
    [flatResults, activeIndex, mode, resultColors]
  );

  const handleSearchSubmit = useCallback(() => {
    setQuery(draft);
  }, [draft]);

  const handleSearchClear = useCallback(() => {
    setDraft('');
    setQuery('');
  }, []);

  // Feedback while typing: the engine ignores anything that is not digits
  // and commas, so say so instead of quietly showing "no matches".
  const searchError =
    draft !== '' && parseCombinationList(draft) === null ? 'Digits (0-9), separated by commas' : undefined;

  if (!isLoaded || !board) {
    return (
      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        contentContainerStyle={[styles.contentContainer, contentPadding]}>
        <View style={[styles.innerContainer, { width: contentWidth }]}>
          <ThemedText themeColor="textSecondary">Loading board...</ThemedText>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, contentPadding]}>
      <View style={[styles.innerContainer, { width: contentWidth }]}>
        <ThemedView style={styles.headerContainer}>
          <ThemedText type="subtitle">{board.name}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitleText}>
            Tap or drag to select cells
          </ThemedText>
        </ThemedView>

        <CombinationSearchBar
          value={draft}
          onChangeText={setDraft}
          onSubmit={handleSearchSubmit}
          onClear={handleSearchClear}
          error={searchError}
          style={styles.searchBar}
        />

        <AngleBoard
          grid={board.grid}
          selection={selection}
          onSelectionChange={setSelection}
          highlights={highlights}
        />

        {query !== '' && isValidQuery && (
          <CombinationSearchResults
            groups={groups}
            colors={groupColors}
            activeIndex={activeIndex}
            onSelectResult={setActiveIndex}
            style={styles.resultsCard}
          />
        )}

        {/* The results card already keeps its own gap under it, so the summary
            only adds its margin when the search is out of the way. The card is
            hidden entirely with an empty selection — the header hint above the
            board already tells the user how to select. */}
        {selection.size > 0 && (
          <SelectedCellsCard
            grid={board.grid}
            selection={selection}
            onClear={clearSelection}
            style={query !== '' && isValidQuery ? undefined : styles.selectionCard}
          />
        )}
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
  subtitleText: {
    fontSize: 14,
  },
  searchBar: {
    marginBottom: Spacing.three,
  },
  resultsCard: {
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
  },
  selectionCard: {
    marginTop: Spacing.three,
  },
});
