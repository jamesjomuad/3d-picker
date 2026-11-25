import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AngleBoard, SelectedCellsCard } from '@/components/angle-board';
import { CombinationSearchBar } from '@/components/search/combination-search-bar';
import { CombinationSearchResults } from '@/components/search/combination-search-results';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useScreenInsets } from '@/hooks/use-screen-insets';
import { useTheme } from '@/hooks/use-theme';
import { useAngleBoardStore } from '@/store/angleBoardStore';
import { useLibraryStore } from '@/store/libraryStore';
import { MAX_RESULTS, parseCombinationList, searchCombinations } from '@/utils/combination-search';
import {
  PLOT_PARAM,
  parsePlotRequest,
  validatePlotRequest,
} from '@/utils/plot-combination';
import { buildPlotHighlights } from '@/utils/plot-highlights';
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
 *
 * A saved basket pick can arrive as a one-shot route param. It is validated
 * against the board that is active at that moment, then shown as a temporary
 * cell highlight — never written to the grid, never persisted, and never sent
 * back to the board the pick originally came from.
 *
 * Plotting now reuses the search engine: the saved digits light up every path
 * that matches them on the active board, while the saved coordinates stay a
 * separate outline.
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

  // One-shot plot request from the Collection tab. The raw param is consumed
  // once so revisiting this tab never replays an old highlight.
  const params = useLocalSearchParams();
  const rawPlot = params[PLOT_PARAM];
  const consumedPlot = useRef(null);
  const [plot, setPlot] = useState(null);

  // Combination search. `draft` is what the field holds; `query` is what the
  // engine has actually run, once typing pauses or the search key commits it.
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const settledDraft = useDebouncedValue(draft);
  const [activeIndex, setActiveIndex] = useState(0);

  const boardId = board?.id ?? null;
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // A different board means the old coordinates belong to a different grid.
  useEffect(() => {
    setPlot(null);
  }, [boardId]);

  // Tabs keep screens mounted, so blur is the reliable "exit" signal: a
  // preview must not still be showing when the user comes back later.
  useFocusEffect(
    useCallback(() => {
      return () => setPlot(null);
    }, [])
  );

  useEffect(() => {
    if (!isLoaded || !board) return;
    if (rawPlot === undefined || rawPlot === '' || consumedPlot.current === rawPlot) return;
    consumedPlot.current = rawPlot;

    // Validate again here, on the board actually being displayed: the active
    // board may have changed since Collection validated the same coordinates.
    const result = validatePlotRequest(parsePlotRequest(rawPlot), board.grid);
    if (!result.valid) {
      Alert.alert('Cannot plot pick', result.error);
    } else {
      setPlot({ digits: result.digits, path: result.path, cells: result.cells });
      // Plot colours take over the board, so clear any older search view
      // instead of leaving a results card for digits no longer on show.
      setDraft('');
      setQuery('');
      setActiveIndex(0);
      // A fresh preview should be unobstructed by an older selection.
      clearSelection();
    }
    router.setParams({ [PLOT_PARAM]: '' });
  }, [board, clearSelection, isLoaded, rawPlot]);

  useEffect(() => {
    setQuery(settledDraft);
  }, [settledDraft]);

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
  const groupColors = useMemo(() => assignResultColors(groups.length, mode), [groups.length, mode]);

  // The board takes one flat list, each result carrying its combination's
  // colour, so overlapping paths still keep every identity that crosses them.
  const flatResults = useMemo(() => groups.flatMap((group) => group.results), [groups]);
  const resultColors = useMemo(
    () => groups.flatMap((group, index) => group.results.map(() => groupColors[index])),
    [groups, groupColors]
  );

  // Search colours, kept separate so a plot can take over the board without
  // changing the query or the results card.
  const searchHighlights = useMemo(
    () => buildSearchHighlights(flatResults, activeIndex, mode, resultColors),
    [flatResults, activeIndex, mode, resultColors]
  );

  // A plot runs the same search on the active grid: every matching path gets a
  // colour, and the saved path is emphasised when it still matches.
  const plotHighlights = useMemo(
    () => (plot && board ? buildPlotHighlights(board.grid, plot.digits, plot.path, mode) : null),
    [plot, board, mode]
  );

  // Plot owns the colour layer while shown; `plotCells` washes the saved cells.
  const highlights = plotHighlights ? plotHighlights.highlights : searchHighlights;
  const matchCount = plotHighlights?.results.length ?? 0;
  const plotHint = !plot
    ? 'Tap or drag to select cells'
    : matchCount === 0
      ? `Plotted ${plot.digits} · no matching paths on this board`
      : `Plotted ${plot.digits} · ${
          matchCount >= MAX_RESULTS ? `${MAX_RESULTS}+` : matchCount
        } matching path${matchCount === 1 ? '' : 's'} on this board`;

  const handleSearchSubmit = useCallback(() => {
    setPlot(null);
    setQuery(draft);
  }, [draft]);

  const handleSearchClear = useCallback(() => {
    setPlot(null);
    setDraft('');
    setQuery('');
  }, []);

  // Any new board gesture replaces the preview with the user's own selection.
  const handleSelectionChange = useCallback(
    (cells) => {
      setPlot(null);
      setSelection(cells);
    },
    [setSelection]
  );

  // Feedback while typing: the engine ignores anything that is not digits,
  // commas or spaces, so say so instead of quietly showing "no matches".
  const searchError =
    draft !== '' && parseCombinationList(draft) === null
      ? 'Digits (0-9), separated by commas or spaces'
      : undefined;

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
            {plotHint}
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
          onSelectionChange={handleSelectionChange}
          highlights={highlights}
          plotCells={plot?.cells}
        />

        {query !== '' && isValidQuery && (
          <CombinationSearchResults
            groups={groups}
            colors={groupColors}
            activeIndex={activeIndex}
            onSelectResult={(index) => {
              setPlot(null);
              setActiveIndex(index);
            }}
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
            onFunPick={() => router.push('/fun-pick')}
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
    fontSize: Typography.size.body,
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
