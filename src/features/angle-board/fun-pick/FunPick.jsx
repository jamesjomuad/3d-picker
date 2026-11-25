import * as Clipboard from 'expo-clipboard';
import { router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { InputClearButton } from '@/components/ui/input-clear-button';
import { BorderRadius, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAngleBoardStore } from '@/store/angleBoardStore';
import { useBasketStore } from '@/store/basketStore';
import { useLibraryStore } from '@/store/libraryStore';
import { getPathReference } from '@/utils/cell-reference';

import {
  FUN_PICK_DIRECTION_FILTERS,
  FUN_PICK_DISTINCT_FILTER,
  FUN_PICK_FILTERS,
  FUN_PICK_LENGTH,
  applyFunPickView,
  applySearch,
  clearFilterSelection,
  createFilterSelection,
  getFilterCounts,
  parseSequenceQuery,
  toggleFilterSelection,
} from './fun-pick-utils';
import { useFunPick } from './useFunPick';

const COPY_FEEDBACK_MS = 1600;
const RENDER_BATCH = 50;
const SHEET_DETENTS = [0.5, 0.75, 1];

const DIGIT_FILTERS = FUN_PICK_FILTERS.filter((filter) => filter.digit !== null);
const PATTERN_FILTERS = FUN_PICK_FILTERS.filter((filter) => filter.pattern !== null);

const COMPACT_FILTER_LABELS = {
  'direction-horizontal': 'Horiz',
  'direction-vertical': 'Vert',
  'direction-diagonal': 'Diag',
  'direction-orthogonal': 'H + V',
};

/**
 * Fun Pick bottom sheet.
 *
 * The board and selection come from the shared stores, so opening the sheet
 * never depends on temporary screen state. Generated combinations stay the
 * original batch; filters, Distinct, and search are display-only views over
 * that batch. The generation engine in `useFunPick` / `fun-pick-utils` is
 * unchanged.
 */
export function FunPickScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { height: windowHeight } = useWindowDimensions();
  const [detentIndex, setDetentIndex] = useState(2);

  const board = useLibraryStore((state) =>
    state.boards.find((item) => item.id === state.activeBoardId) || state.boards[0] || null
  );
  const selection = useAngleBoardStore((state) => state.selectedCells);
  const grid = board?.grid ?? [];
  const { combinations, generate, clear } = useFunPick({ grid, selection });

  const [filters, setFilters] = useState(createFilterSelection);
  const [search, setSearch] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);
  const [copyStatus, setCopyStatus] = useState('idle');
  const [visibleCount, setVisibleCount] = useState(RENDER_BATCH);
  const resetTimer = useRef(null);

  const basketCount = useBasketStore((state) => state.entries.length);
  const loadBasket = useBasketStore((state) => state.load);
  const addToBasket = useBasketStore((state) => state.add);
  const addManyToBasket = useBasketStore((state) => state.addMany);
  const entries = useBasketStore((state) => state.entries);

  useEffect(() => {
    loadBasket();
  }, [loadBasket]);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    []
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('sheetDetentChange', ({ data }) => {
      setDetentIndex(data.index);
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    setVisibleCount(RENDER_BATCH);
  }, [combinations, filters, search]);

  const basketDigits = useMemo(
    () => new Set(entries.map((entry) => entry.digits)),
    [entries]
  );
  const searchQuery = useMemo(() => parseSequenceQuery(search), [search]);
  const searchedCombinations = useMemo(
    () => applySearch(combinations, searchQuery.sequences),
    [combinations, searchQuery]
  );
  const filterCounts = useMemo(() => getFilterCounts(searchedCombinations), [searchedCombinations]);
  const countByValue = useMemo(
    () => Object.fromEntries(filterCounts.map((item) => [item.value, item.count])),
    [filterCounts]
  );
  const visibleCombinations = useMemo(
    () => applyFunPickView(combinations, filters, searchQuery.sequences),
    [combinations, filters, searchQuery]
  );
  const renderedCombinations = useMemo(
    () => visibleCombinations.slice(0, visibleCount),
    [visibleCombinations, visibleCount]
  );
  const hiddenCount = Math.max(0, visibleCombinations.length - renderedCombinations.length);

  const activeFilterLabels = useMemo(
    () =>
      FUN_PICK_FILTERS.concat(FUN_PICK_DIRECTION_FILTERS, FUN_PICK_DISTINCT_FILTER)
        .filter((option) => option.value !== 'all' && filters[option.value])
        .map((option) => option.hint),
    [filters]
  );
  const filterHint = activeFilterLabels.length > 0 ? ` with ${activeFilterLabels.join(', ')}` : '';

  const missingCombinations = useMemo(
    () => visibleCombinations.filter((item) => !basketDigits.has(item.digits)),
    [visibleCombinations, basketDigits]
  );
  const missingPreview = useMemo(
    () => missingCombinations.slice(0, 3).map((item) => item.digits).join(', '),
    [missingCombinations]
  );

  const copyLabel = copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy';
  const sheetFraction = SHEET_DETENTS[detentIndex] ?? SHEET_DETENTS[SHEET_DETENTS.length - 1];
  const floatingCloseBottom = (1 - sheetFraction) * windowHeight + insets.bottom + Spacing.three;

  const handleToggleFilter = useCallback((value) => {
    setFilters((current) => toggleFilterSelection(current, value));
  }, []);

  const handleClearAll = useCallback(() => {
    setFilters(clearFilterSelection());
    setSearch('');
  }, []);

  const handleGenerate = useCallback(() => {
    if (selection.size === 0) return;
    generate();
    setHasGenerated(true);
  }, [generate, selection.size]);

  const handleClearResults = useCallback(() => {
    clear();
    setHasGenerated(false);
    setSearch('');
  }, [clear]);

  const handleToggleBasket = useCallback(
    (combination) => {
      if (basketDigits.has(combination.digits)) {
        useBasketStore.getState().remove(combination.digits);
      } else {
        addToBasket({
          digits: combination.digits,
          path: combination.path,
          addedAt: new Date().toISOString(),
        });
      }
    },
    [addToBasket, basketDigits]
  );

  const handleAddVisible = useCallback(() => {
    if (missingCombinations.length === 0) return;
    addManyToBasket(
      missingCombinations.map((combination) => ({
        digits: combination.digits,
        path: combination.path,
        addedAt: new Date().toISOString(),
      }))
    );
  }, [addManyToBasket, missingCombinations]);

  const handleCopy = useCallback(async () => {
    if (combinations.length === 0) return;
    try {
      await Clipboard.setStringAsync(combinations.map((item) => item.digits).join('\n'));
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyStatus('idle'), COPY_FEEDBACK_MS);
  }, [combinations]);

  const handleShowMore = useCallback(() => {
    setVisibleCount((current) => current + RENDER_BATCH);
  }, []);

  const emptyText = !hasGenerated
    ? 'Generate combinations from the selected cells.'
    : visibleCombinations.length === 0
      ? `No generated combinations${filterHint}${search.trim() ? ` matching "${search.trim()}"` : ''}.`
      : '';

  return (
    <ThemedView
      style={[
        styles.screen,
        {
          paddingTop: insets.top + Spacing.two,
          paddingLeft: insets.left + Spacing.three,
          paddingRight: insets.right + Spacing.three,
          paddingBottom: insets.bottom,
        },
      ]}>
      <View style={styles.handleArea} importantForAccessibility="no">
        <View style={[styles.handleBar, { backgroundColor: theme.border }]} />
      </View>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <ThemedText type="smallBold">Fun Pick</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.headerSubtitle}>
            {FUN_PICK_LENGTH}D
          </ThemedText>
        </View>
        <View style={styles.basketWrap}>
          <IconButton
            symbol="collection"
            size="sm"
            variant="outline"
            onPress={() => router.navigate('/collection')}
            accessibilityLabel={`Collection, ${basketCount} picks`}
          />
          {basketCount > 0 && (
            <View style={[styles.basketBadge, { backgroundColor: theme.primary }]}>
              <ThemedText themeColor="primaryText" style={styles.basketBadgeText}>
                {basketCount}
              </ThemedText>
            </View>
          )}
        </View>
        <Button size="sm" onPress={handleGenerate} disabled={selection.size === 0}>
          Generate
        </Button>
      </View>

      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={[
          styles.sheetContent,
          {
            paddingBottom:
              Spacing.three + (insets.bottom > 0 ? 0 : Spacing.two) + Spacing.six,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={false}>
        <View style={[styles.filtersHeader, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">Filters</ThemedText>
          <Button size="sm" variant="ghost" onPress={handleClearAll}>
            Clear All
          </Button>
        </View>
        <View style={styles.filterColumns}>
          <View style={styles.filterColumn}>
            <FilterSection
              title="Digits"
              options={DIGIT_FILTERS}
              counts={countByValue}
              filters={filters}
              onToggle={handleToggleFilter}
            />
            <FilterSection
              title="L-pattern"
              options={PATTERN_FILTERS}
              counts={countByValue}
              filters={filters}
              onToggle={handleToggleFilter}
            />
          </View>
          <View style={styles.filterColumn}>
            <FilterSection
              title="Direction"
              options={FUN_PICK_DIRECTION_FILTERS}
              counts={countByValue}
              filters={filters}
              onToggle={handleToggleFilter}
            />
            <FilterSection
              title="Other"
              options={[FUN_PICK_DISTINCT_FILTER]}
              counts={countByValue}
              filters={filters}
              onToggle={handleToggleFilter}
              helper="Hide combinations with the same digits in a different order."
            />
          </View>
        </View>

        <View style={[styles.searchBlock, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">Search</ThemedText>
          <View style={styles.searchField}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="e.g. 12,4"
              placeholderTextColor={theme.textSecondary}
              keyboardType="default"
              returnKeyType="search"
              maxLength={60}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.searchInput,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                },
              ]}
            />
            {search.length > 0 && <InputClearButton onPress={() => setSearch('')} />}
          </View>
          {!searchQuery.valid && (
            <ThemedText style={styles.searchError}>Digits (0-9), separated by commas</ThemedText>
          )}
        </View>

        <View style={styles.resultsHeader}>
          <ThemedText type="smallBold">Results</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.resultsCount}>
            {visibleCombinations.length} of {combinations.length}
          </ThemedText>
        </View>

        <View style={styles.resultActions}>
          <Button
            size="sm"
            variant="outline"
            onPress={handleAddVisible}
            disabled={missingCombinations.length === 0}>
            Add visible
          </Button>
          <Button
            size="sm"
            variant="outline"
            onPress={handleCopy}
            disabled={combinations.length === 0}>
            {copyLabel}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={handleClearResults}
            disabled={!hasGenerated}>
            Clear
          </Button>
        </View>
        {missingPreview.length > 0 && (
          <ThemedText themeColor="textSecondary" style={styles.addHint} numberOfLines={1}>
            Not in basket: {missingPreview}
          </ThemedText>
        )}
        {emptyText ? (
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            {emptyText}
          </ThemedText>
        ) : (
          <View style={styles.resultRows}>
            {renderedCombinations.map((combination) => (
              <CombinationRow
                key={getPathKey(combination)}
                combination={combination}
                isSaved={basketDigits.has(combination.digits)}
                onToggle={handleToggleBasket}
              />
            ))}
          </View>
        )}
        {hiddenCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onPress={handleShowMore}
            style={styles.moreButton}>
            Show {hiddenCount} more
          </Button>
        )}
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={[styles.floatingClose, { bottom: floatingCloseBottom }]}>
        <View
          style={[
            styles.floatingCloseSurface,
            { backgroundColor: theme.backgroundElement, shadowColor: theme.border },
          ]}>
          <IconButton
            symbol="xmark"
            size="md"
            variant="filled"
            onPress={() => router.back()}
            accessibilityLabel="Close Fun Pick"
          />
        </View>
      </View>
    </ThemedView>
  );
}

function FilterSection({ title, options, counts, filters, onToggle, helper }) {
  return (
    <View style={styles.section}>
      <ThemedText themeColor="textSecondary" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      <View style={styles.sectionOptions}>
        {options.map((option) => (
          <FilterChip
            key={option.value}
            option={option}
            count={counts[option.value] ?? 0}
            checked={Boolean(filters[option.value])}
            onToggle={() => onToggle(option.value)}
          />
        ))}
      </View>
      {helper && (
        <ThemedText themeColor="textSecondary" style={styles.sectionHelper}>
          {helper}
        </ThemedText>
      )}
    </View>
  );
}

function FilterChip({ option, count, checked, onToggle }) {
  const theme = useTheme();
  const label = COMPACT_FILTER_LABELS[option.value] ?? option.label;
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${option.label}, ${checked ? 'on' : 'off'}, ${count} matches`}
      hitSlop={2}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: checked ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: checked ? theme.primary : theme.border,
        },
        pressed && styles.pressed,
      ]}>
      {checked && (
        <ThemedText themeColor="primary" style={styles.chipCheck}>
          ✓
        </ThemedText>
      )}
      <ThemedText
        themeColor="text"
        style={[styles.chipLabel, checked && styles.chipLabelActive]}
        numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.chipCount}>
        {count}
      </ThemedText>
    </Pressable>
  );
}

function getPathKey(combination) {
  return combination.path.map((cell) => `${cell.row},${cell.column}`).join(';');
}

const CombinationRow = memo(function CombinationRow({ combination, isSaved, onToggle }) {
  const theme = useTheme();
  return (
    <View style={[styles.resultRow, { borderColor: theme.border }]}>
      <ThemedText style={styles.resultDigits}>{combination.digits}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.resultPath}>
        {getPathReference(combination.path)}
      </ThemedText>
      <Button
        size="sm"
        variant={isSaved ? 'secondary' : 'outline'}
        onPress={() => onToggle(combination)}>
        {isSaved ? 'Added' : 'Add'}
      </Button>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: BorderRadius.full,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  headerTitle: {
    flex: 1,
    gap: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  basketWrap: {
    position: 'relative',
  },
  basketBadge: {
    position: 'absolute',
    right: -4,
    top: -4,
    minWidth: 18,
    height: 18,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  basketBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  floatingClose: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  floatingCloseSurface: {
    borderRadius: BorderRadius.full,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    gap: Spacing.two,
  },
  filtersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterColumns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  filterColumn: {
    flex: 1,
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.one,
  },
  sectionTitle: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sectionOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  sectionHelper: {
    fontSize: 11,
    lineHeight: 14,
  },
  chip: {
    minHeight: 44,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
  },
  chipCheck: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
  chipLabel: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  chipLabelActive: {
    fontWeight: '700',
  },
  chipCount: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 14,
    minWidth: 14,
    textAlign: 'right',
  },
  searchBlock: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  searchField: {
    position: 'relative',
  },
  searchInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.two,
    paddingRight: 44,
    fontFamily: Fonts.mono,
    fontSize: 14,
  },
  searchError: {
    color: '#D93025',
    fontSize: 12,
    lineHeight: 16,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
  },
  resultsCount: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 16,
  },
  resultActions: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  addHint: {
    fontSize: 11,
    lineHeight: 14,
  },
  resultRows: {
    gap: Spacing.one,
  },
  resultRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  resultDigits: {
    flex: 1,
    fontFamily: Fonts.mono,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  resultPath: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 14,
  },
  emptyText: {
    padding: Spacing.three,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  moreButton: {
    alignSelf: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
