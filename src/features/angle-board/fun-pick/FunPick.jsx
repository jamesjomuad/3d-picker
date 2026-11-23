import * as Clipboard from 'expo-clipboard';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FoldableCard } from '@/components/ui/foldable-card';
import { BorderRadius, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBasketStore } from '@/store/basketStore';
import { getPathReference } from '@/utils/cell-reference';

import {
  FUN_PICK_DIRECTION_OPTIONS,
  FUN_PICK_FILTERS,
  FUN_PICK_TYPE_OPTIONS,
  applyFilter,
  applySearch,
  getFilterCounts,
  parseSequenceQuery,
} from './fun-pick-utils';
import { useFunPick } from './useFunPick';

const COPY_FEEDBACK_MS = 1600;

/**
 * Result rows rendered at once. Generations are now exhaustive, so a large
 * selection can yield thousands of combinations; the list grows in batches
 * on "Show more" instead of mounting every row up front. Rendering is a
 * view concern - the full batch always exists and filters count it whole.
 */
const RENDER_BATCH = 50;

/**
 * Fun Pick card
 *
 * Generates every valid angle-walk combination from the current Angle Board
 * selection: each step turns exactly 90 degrees from the previous one, and
 * the type rule (2D/3D/4D) picks how many digits each combination holds.
 * Results are one continuous list behind a horizontally scrollable filter
 * bar - All, With 0/1/2, and the four L-shape orientations Г ㄱ ┘ L - so
 * any digit or shape subset can be inspected without changing the
 * generated batch. A sequence search field ("12,4" — every comma-separated
 * sequence must appear as a consecutive run in the combination) narrows
 * the visible results further, composing with the active filter and never
 * regenerating the batch. Takes the same `grid` + `selection` pair the
 * board and the summary card take, so it can be mounted beside any board.
 * Presentation only: the batch and the rules live in `useFunPick`, the
 * walk itself in `fun-pick-utils`. The Copy button puts the generated
 * digits on the clipboard, one combination per line, and each result row
 * can be collected into the Selection Basket — a persisted store
 * independent of generation, search and filtering, reviewed on the
 * Collection tab.
 *
 * @param {Object} props
 * @param {number[][]} props.grid - the board's digits, read row-major
 * @param {Set<string>} props.selection - selected "row,col" keys
 * @param {Object} [props.style] - Additional card styles
 */
export function FunPick({ grid, selection, style }) {
  const {
    combinations,
    generate,
    clear,
    type,
    setType,
    direction,
    setDirection,
  } = useFunPick({ grid, selection });

  const [showRules, setShowRules] = useState(false);
  // The active result filter; "all" shows the whole generated batch.
  const [filter, setFilter] = useState('all');
  // Distinguishes "nothing generated yet" from "generated, but the
  // selection cannot produce any combination".
  const [hasGenerated, setHasGenerated] = useState(false);
  const [copyStatus, setCopyStatus] = useState('idle');
  const resetTimer = useRef(null);

  // Sequence search ("12,4"). Local to the card and applied immediately:
  // every keystroke just re-derives a view over the existing batch. An
  // invalid query filters nothing and says so under the field.
  const [search, setSearch] = useState('');
  const searchQuery = useMemo(() => parseSequenceQuery(search), [search]);
  const searchActive = searchQuery.valid && searchQuery.sequences.length > 0;

  // The Selection Basket lives in its own persisted store: this card only
  // reads and edits it, so generating, searching or filtering never
  // touches collected picks.
  const basketEntries = useBasketStore((state) => state.entries);
  const loadBasket = useBasketStore((state) => state.load);
  const addToBasket = useBasketStore((state) => state.add);
  const removeFromBasket = useBasketStore((state) => state.remove);

  useEffect(() => {
    loadBasket();
  }, [loadBasket]);

  const basketDigits = useMemo(
    () => new Set(basketEntries.map((entry) => entry.digits)),
    [basketEntries]
  );

  const handleToggleBasket = useCallback(
    (combination) => {
      if (basketDigits.has(combination.digits)) removeFromBasket(combination.digits);
      else addToBasket(combination);
    },
    [basketDigits, addToBasket, removeFromBasket]
  );

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    []
  );

  const handleCopy = useCallback(async () => {
    if (combinations.length === 0) return;

    try {
      await Clipboard.setStringAsync(combinations.map((combination) => combination.digits).join('\n'));
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }

    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyStatus('idle'), COPY_FEEDBACK_MS);
  }, [combinations]);

  const copyLabel = copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy';

  const handleGenerate = () => {
    generate();
    setHasGenerated(true);
  };

  const handleClear = () => {
    clear();
    setHasGenerated(false);
    setSearch('');
  };

  const typeLabel =
    FUN_PICK_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? '3D';
  const directionLabel =
    FUN_PICK_DIRECTION_OPTIONS.find((option) => option.value === direction)?.label ?? 'All directions';

  // Recomputed whenever the batch changes: per-filter badge counts and the
  // slice the active view shows. Search narrows first, the filter applies
  // to what is left, so chip badges count the searched batch. Everything
  // here is a pure view — the batch is never touched, filtered away for
  // good, or regenerated by searching or filtering.
  const searchedCombinations = useMemo(
    () => applySearch(combinations, searchQuery.sequences),
    [combinations, searchQuery]
  );
  const filterCounts = useMemo(() => getFilterCounts(searchedCombinations), [searchedCombinations]);
  const visibleCombinations = useMemo(
    () => applyFilter(searchedCombinations, filter),
    [searchedCombinations, filter]
  );
  const activeFilter =
    FUN_PICK_FILTERS.find((option) => option.value === filter) ?? FUN_PICK_FILTERS[0];

  // Progressive rendering: only the first `visibleCount` matching rows are
  // mounted, "Show more" grows the slice. Reset whenever the batch, the
  // search or the active filter changes so a fresh view always starts at
  // the top.
  const [visibleCount, setVisibleCount] = useState(RENDER_BATCH);
  useEffect(() => {
    setVisibleCount(RENDER_BATCH);
  }, [searchedCombinations, filter]);
  const renderedCombinations = visibleCombinations.slice(0, visibleCount);
  const hiddenCount = visibleCombinations.length - renderedCombinations.length;

  return (
    <FoldableCard
      style={style}
      title="Fun Pick"
      subtitle={`${typeLabel} · ${directionLabel}`}
      defaultExpanded={false}>
      <View style={styles.body}>
        <View style={styles.actions}>
          <Button size="sm" onPress={handleGenerate}>
            Generate
          </Button>
          <Button
            size="sm"
            variant={showRules ? 'secondary' : 'outline'}
            onPress={() => setShowRules((value) => !value)}>
            Generation Rules
          </Button>
        </View>

        {showRules && (
          <View style={styles.rules}>
            <View style={styles.ruleGroup}>
              <ThemedText type="smallBold">Type</ThemedText>
              <View style={styles.pills}>
                {FUN_PICK_TYPE_OPTIONS.map((option) => (
                  <RulePill
                    key={option.value}
                    label={option.label}
                    selected={option.value === type}
                    onSelect={() => setType(option.value)}
                  />
                ))}
              </View>
            </View>
            <View style={styles.ruleGroup}>
              <ThemedText type="smallBold">Direction</ThemedText>
              <View style={styles.pills}>
                {FUN_PICK_DIRECTION_OPTIONS.map((option) => (
                  <RulePill
                    key={option.value}
                    label={option.label}
                    selected={option.value === direction}
                    onSelect={() => setDirection(option.value)}
                  />
                ))}
              </View>
            </View>
          </View>
        )}

        {combinations.length > 0 && (
          <FunPickSearchField
            value={search}
            onChangeText={setSearch}
            error={searchQuery.valid ? null : 'Only digits and commas, separated by commas.'}
          />
        )}

        {combinations.length > 0 ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterBar}>
              {filterCounts.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  count={option.count}
                  selected={option.value === filter}
                  onSelect={() => setFilter(option.value)}
                />
              ))}
            </ScrollView>

            <ThemedText type="small" themeColor="textSecondary">
              {visibleCombinations.length} of {combinations.length}{' '}
              {combinations.length === 1 ? 'combination' : 'combinations'}
            </ThemedText>

            {visibleCombinations.length > 0 ? (
              <>
                <View style={styles.results}>
                  {renderedCombinations.map((combination) => (
                    <CombinationRow
                      key={getPathKey(combination)}
                      combination={combination}
                      inBasket={basketDigits.has(combination.digits)}
                      onToggleBasket={handleToggleBasket}
                    />
                  ))}
                </View>
                {hiddenCount > 0 && (
                  <Button size="sm" variant="outline" onPress={() => setVisibleCount((count) => count + RENDER_BATCH)}>
                    Show {hiddenCount > RENDER_BATCH ? RENDER_BATCH : hiddenCount} more
                  </Button>
                )}
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                {searchActive
                  ? `No generated combinations${
                      activeFilter.value === 'all' ? '' : ` ${activeFilter.hint}`
                    } match "${searchQuery.sequences.join(', ')}".`
                  : `No generated combinations ${activeFilter.hint}.`}
              </ThemedText>
            )}

            <View style={styles.actions}>
              <Button size="sm" onPress={handleGenerate}>
                Generate Again
              </Button>
              <Button size="sm" variant="outline" onPress={handleCopy}>
                {copyLabel}
              </Button>
              <Button size="sm" variant="outline" onPress={handleClear}>
                Clear
              </Button>
            </View>
          </>
        ) : (
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            {hasGenerated
              ? 'The current selection cannot form a combination under these rules. Select more cells that form an L or V angle, or change the type and direction rules.'
              : 'Select cells on the board, then generate every valid angle walk through them.'}
          </ThemedText>
        )}
      </View>
    </FoldableCard>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rules: {
    gap: Spacing.two,
  },
  ruleGroup: {
    gap: Spacing.one,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  rulePill: {
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  pressedPill: {
    opacity: 0.7,
  },
  results: {
    gap: Spacing.two,
  },
  filterBar: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  filterChip: {
    alignItems: 'center',
    gap: 2,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 60,
    paddingHorizontal: Spacing.two,
  },
  filterCount: {
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  digits: {
    fontSize: 17,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  rowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pathText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'right',
  },
  searchLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: Spacing.one,
  },
  searchFieldRow: {
    position: 'relative',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.two,
    // Room for the clear button at the right end.
    paddingRight: Spacing.four + Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    fontFamily: Fonts.mono,
    minHeight: 44,
  },
  searchClear: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: 44,
    paddingHorizontal: Spacing.three,
    fontSize: 22,
    lineHeight: 44,
  },
  searchError: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: Spacing.one,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

/**
 * One selectable rule pill, used by the Type and Direction groups alike.
 *
 * @param {Object} props
 * @param {string} props.label - Pill text
 * @param {boolean} props.selected - Whether this pill holds the active rule
 * @param {() => void} props.onSelect - Called with a tap
 */
function RulePill({ label, selected, onSelect }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={{ top: 8, bottom: 8 }}
      style={({ pressed }) => [
        styles.rulePill,
        pressed && styles.pressedPill,
        {
          backgroundColor: selected ? theme.primary : theme.backgroundElement,
          borderColor: selected ? theme.primary : theme.border,
        },
      ]}>
      <ThemedText type="small" themeColor={selected ? 'primaryText' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/**
 * One filter in the results filter bar: label above its match count, the
 * active one filled with the primary colour. The bar scrolls horizontally,
 * so eight chips stay compact on narrow Android screens instead of
 * squeezing or overflowing.
 *
 * @param {Object} props
 * @param {string} props.label - Filter name, e.g. "With 0" or "Г"
 * @param {number} props.count - Combinations this filter matches
 * @param {boolean} props.selected - Whether this filter is active
 * @param {() => void} props.onSelect - Called with a tap
 */
function FilterChip({ label, count, selected, onSelect }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${count} ${count === 1 ? 'combination' : 'combinations'}`}
      style={({ pressed }) => [
        styles.filterChip,
        pressed && styles.pressedPill,
        {
          backgroundColor: selected ? theme.primary : theme.backgroundElement,
          borderColor: selected ? theme.primary : theme.border,
        },
      ]}>
      <ThemedText type="small" themeColor={selected ? 'primaryText' : 'textSecondary'}>
        {label}
      </ThemedText>
      <ThemedText
        type="smallBold"
        themeColor={selected ? 'primaryText' : 'text'}
        style={styles.filterCount}>
        {count}
      </ThemedText>
    </Pressable>
  );
}

/**
 * Stable React key for a generated combination: its path cell by cell.
 *
 * @param {{ path: Array<{ row: number, column: number }> }} combination
 * @returns {string}
 */
function getPathKey(combination) {
  return combination.path.map((cell) => `${cell.row},${cell.column}`).join(';');
}

/**
 * One result row: the digit sequence leading, with the board reference of
 * its path and an Add/Added basket toggle on the trailing edge. Digits use
 * tabular figures so rows of the same length align and stay easy to scan.
 * Memoised so growing the list with "Show more" never re-renders the rows
 * already on screen; `inBasket` flips only the touched row.
 *
 * @param {Object} props
 * @param {{ digits: string, path: Array<Object> }} props.combination
 * @param {boolean} props.inBasket - Whether this pick is already collected
 * @param {(combination: Object) => void} props.onToggleBasket - Add or remove on tap
 */
const CombinationRow = memo(function CombinationRow({ combination, inBasket, onToggleBasket }) {
  return (
    <View style={styles.resultRow}>
      <ThemedText type="smallBold" style={styles.digits}>
        {combination.digits}
      </ThemedText>
      <View style={styles.rowTrailing}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.pathText}>
          {getPathReference(combination.path)}
        </ThemedText>
        <Button
          size="sm"
          variant={inBasket ? 'secondary' : 'outline'}
          accessibilityLabel={inBasket ? `Remove ${combination.digits} from basket` : `Add ${combination.digits} to basket`}
          onPress={() => onToggleBasket(combination)}>
          {inBasket ? 'Added' : 'Add'}
        </Button>
      </View>
    </View>
  );
});

/**
 * The Fun Pick sequence search field. Typing filters the batch through
 * `parseSequenceQuery` in the parent, so this is plain controlled input:
 * label, field with an inline clear button, and the invalid-character
 * error line. The placeholder states the semantics — every comma-separated
 * sequence must appear in a combination — which differ from the main
 * board's combination search, so it is deliberately its own field.
 *
 * @param {Object} props
 * @param {string} props.value
 * @param {(text: string) => void} props.onChangeText
 * @param {string|null} props.error - Shown under the field when the query is invalid
 */
function FunPickSearchField({ value, onChangeText, error }) {
  const theme = useTheme();

  return (
    <View>
      <ThemedText themeColor="textSecondary" style={styles.searchLabel}>
        Search sequences (all must appear)
      </ThemedText>
      <View style={styles.searchFieldRow}>
        <TextInput
          style={[
            styles.searchInput,
            {
              borderColor: error ? theme.destructive : theme.border,
              backgroundColor: theme.background,
              color: theme.text,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder="e.g. 12,4"
          placeholderTextColor={theme.disabledText}
          // Android's number pad has no comma key, so it types on the
          // normal keyboard; iOS gets the digits-and-punctuation pad.
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
          returnKeyType="search"
          maxLength={60}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {value.length > 0 && (
          <ThemedText
            type="linkPrimary"
            onPress={() => onChangeText('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            style={[styles.searchClear, { color: theme.textSecondary }]}>
            ×
          </ThemedText>
        )}
      </View>
      {error ? (
        <ThemedText themeColor="destructive" style={styles.searchError}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

