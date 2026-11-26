import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import {
  Animated,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { InputClearButton } from '@/components/ui/input-clear-button';
import { BorderRadius, Fonts, Spacing, Typography } from '@/constants/theme';
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
import { AppIcon } from '@/components/ui/app-icon';

const COPY_FEEDBACK_MS = 1600;
const RENDER_BATCH = 50;
const SHEET_DETENTS = [0.5, 0.75, 1];
const DEFAULT_DETENT_INDEX = 1;
const SHEET_SPRING = { damping: 24, stiffness: 240, mass: 0.9 };
const DISMISS_DURATION_MS = 180;
const DRAG_ACTIVATION = 10;
const DRAG_SLOP = 16;

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
  const { height: windowHeight } = useWindowDimensions();
  const sheetY = useSharedValue((1 - SHEET_DETENTS[DEFAULT_DETENT_INDEX]) * windowHeight);
  const detentIndex = useSharedValue(DEFAULT_DETENT_INDEX);
  const dragStartY = useSharedValue(0);
  const dragStartDetent = useSharedValue(DEFAULT_DETENT_INDEX);

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
    sheetY.set((1 - SHEET_DETENTS[detentIndex.get()]) * windowHeight);
  }, [detentIndex, sheetY, windowHeight]);

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

  const snapToIndex = useCallback(
    (index) => {
      const nextIndex = Math.max(0, Math.min(SHEET_DETENTS.length - 1, index));
      detentIndex.set(nextIndex);
      sheetY.set(withSpring((1 - SHEET_DETENTS[nextIndex]) * windowHeight, SHEET_SPRING));
    },
    [detentIndex, sheetY, windowHeight]
  );

  const closeSheet = useCallback(() => {
    router.back();
  }, []);

  const dismissSheet = useCallback(() => {
    sheetY.set(
      withTiming(windowHeight, { duration: DISMISS_DURATION_MS }, () => {
        runOnJS(closeSheet)();
      })
    );
  }, [closeSheet, sheetY, windowHeight]);

  const panGesture = usePanGesture({
    activeOffsetY: [-DRAG_ACTIVATION, DRAG_ACTIVATION],
    failOffsetX: [-DRAG_SLOP, DRAG_SLOP],
    shouldCancelWhenOutside: false,
    onActivate: () => {
      'worklet';
      dragStartY.set(sheetY.get());
      dragStartDetent.set(detentIndex.get());
    },
    onUpdate: (event) => {
      'worklet';
      const maxY = windowHeight * (1 - SHEET_DETENTS[0]);
      const nextY = dragStartY.get() + event.translationY;
      sheetY.set(Math.min(maxY, Math.max(0, nextY)));
    },
    onDeactivate: (event) => {
      'worklet';
      const current = dragStartDetent.get();
      if (event.canceled) {
        runOnJS(snapToIndex)(current);
        return;
      }
      if (event.translationY > DRAG_ACTIVATION) {
        if (current === 0) {
          runOnJS(dismissSheet)();
        } else {
          runOnJS(snapToIndex)(current - 1);
        }
        return;
      }
      if (event.translationY < -DRAG_ACTIVATION) {
        runOnJS(snapToIndex)(Math.min(current + 1, SHEET_DETENTS.length - 1));
        return;
      }
      runOnJS(snapToIndex)(current);
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.get() }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      sheetY.get(),
      [0, windowHeight * (1 - SHEET_DETENTS[1])],
      [0.35, 0],
      Extrapolation.CLAMP
    ),
  }));

  const closeStyle = useAnimatedStyle(() => ({
    bottom: sheetY.get() + insets.bottom + Spacing.three,
  }));

  const emptyText = !hasGenerated
    ? 'Generate combinations from the selected cells.'
    : visibleCombinations.length === 0
      ? `No generated combinations${filterHint}${search.trim() ? ` matching "${search.trim()}"` : ''}.`
      : '';

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          style={styles.backdropPress}
          onPress={closeSheet}
          accessibilityLabel="Close Fun Pick"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            height: windowHeight,
            backgroundColor: theme.background,
            borderTopColor: theme.border,
            paddingTop: insets.top + Spacing.two,
            paddingLeft: insets.left + Spacing.three,
            paddingRight: insets.right + Spacing.three,
            paddingBottom: insets.bottom,
          },
          sheetStyle,
        ]}>
        <GestureDetector gesture={panGesture}>
          <View style={styles.handleArea} importantForAccessibility="no">
            <View style={[styles.handleBar, { backgroundColor: theme.border }]} />
          </View>
        </GestureDetector>

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
          <Button size="sm" onPress={handleGenerate} disabled={selection.size === 0} icon="sparkles">
            Generate
          </Button>
        </View>

        <ScrollView
          style={[styles.controlsScroll, { maxHeight: windowHeight * 0.25 }]}
          contentContainerStyle={styles.controls}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={false}>
          <View style={[styles.filtersHeader, { borderColor: theme.border }]}>
            <ThemedText type="smallBold">Filters</ThemedText>
            <Button size="sm" variant="ghost" onPress={handleClearAll} icon="trash">
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
        </ScrollView>

        <View style={styles.resultsViewport}>
          {emptyText ? (
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {emptyText}
            </ThemedText>
          ) : (
            <ScrollView
              style={styles.resultsScroll}
              contentContainerStyle={[
                styles.resultsContent,
                {
                  paddingBottom:
                    Spacing.three + (insets.bottom > 0 ? 0 : Spacing.two) + Spacing.six,
                },
              ]}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={false}>
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
              {hiddenCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onPress={handleShowMore}
                  style={styles.moreButton}
                  icon="chevron.down">
                  Show {hiddenCount} more
                </Button>
              )}
            </ScrollView>
          )}
        </View>
      </Animated.View>

      <Animated.View pointerEvents="box-none" style={[styles.floatingClose, closeStyle]}>
        <View
          style={[
            styles.floatingCloseSurface,
            { backgroundColor: theme.backgroundElement, shadowColor: theme.border },
          ]}>
          <IconButton
            symbol="xmark"
            size="md"
            variant="filled"
            onPress={closeSheet}
            accessibilityLabel="Close Fun Pick"
          />
        </View>
      </Animated.View>
    </View>
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
      {checked && <AppIcon name="checkmark" size="small" tone="primary" />}
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
        icon={isSaved ? 'checkmark' : 'plus'}
        onPress={() => onToggle(combination)}>
        {isSaved ? 'Added' : 'Add'}
      </Button>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropPress: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    gap: Spacing.two,
  },
  handleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
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
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
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
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    fontWeight: Typography.weight.bold,
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
  controlsScroll: {
    flexGrow: 0,
  },
  controls: {
    gap: Spacing.two,
  },
  resultsViewport: {
    flex: 1,
    minHeight: 0,
  },
  resultsScroll: {
    flex: 1,
  },
  resultsContent: {
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
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sectionOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  sectionHelper: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
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
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    fontWeight: Typography.weight.bold,
  },
  chipLabel: {
    flexShrink: 1,
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
  },
  chipLabelActive: {
    fontWeight: Typography.weight.bold,
  },
  chipCount: {
    fontFamily: Fonts.mono,
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
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
    fontSize: Typography.size.body,
  },
  searchError: {
    color: '#D93025',
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
  },
  resultsCount: {
    fontFamily: Fonts.mono,
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
  },
  resultActions: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  addHint: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
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
    fontSize: Typography.size.subtitle,
    lineHeight: Typography.lineHeight.bodyLarge,
    fontWeight: Typography.weight.bold,
  },
  resultPath: {
    fontFamily: Fonts.mono,
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
  },
  emptyText: {
    padding: Spacing.three,
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
    textAlign: 'center',
  },
  moreButton: {
    alignSelf: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
