import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FoldableCard } from '@/components/ui/foldable-card';
import { BorderRadius, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getPathReference } from '@/utils/cell-reference';
import { MAX_RESULTS } from '@/utils/combination-search';

// A long list of paths would make the card taller than the board it describes.
// The rest stay reachable on the board: every match still lights up.
const MAX_ROWS = 100;

/**
 * Combination search results card
 *
 * Lists the matches per searched combination, and hands the tapped row back
 * as the active result. It reads only its props: the search itself lives in
 * `@/utils/combination-search`, and highlighting the board is the screen's job.
 *
 * @param {Object} props
 * @param {Array<{ combination: string, results: Array<{ digits: string, path: Array<{row:number,column:number}> }> }>} props.groups
 *   one entry per searched combination, in typed order
 * @param {string[]} props.colors - the palette colour of each group, in group
 *   order (see `@/utils/search-highlight-utils`); drawn as a dot beside the
 *   group and its rows so the list and the board agree on which colour is which
 * @param {number} props.activeIndex - the emphasised result, counted over the
 *   concatenated groups (group 0's results first, then group 1's, and so on)
 * @param {(index: number) => void} props.onSelectResult
 * @param {Object} [props.style] - Additional card styles
 */
export function CombinationSearchResults({ groups, colors, activeIndex, onSelectResult, style }) {
  const theme = useTheme();

  // Where each group's results start in the flattened list the board uses
  // (the groups are few, so the running sum per section stays cheap).
  const sections = groups.map((group, groupIndex) => ({
    ...group,
    groupIndex,
    offset: groups.slice(0, groupIndex).reduce((sum, earlier) => sum + earlier.results.length, 0),
  }));
  const total = groups.reduce((sum, group) => sum + group.results.length, 0);

  return (
    <FoldableCard
      style={style}
      title="Combination Search"
      trailing={
        <ThemedText themeColor="textSecondary" style={styles.count}>
          {total}
        </ThemedText>
      }>
      <View style={styles.body}>
        {sections.map(({ combination, results, groupIndex, offset }) => {
          const color = colors[groupIndex];
          const countLabel = results.length >= MAX_RESULTS ? `${MAX_RESULTS}+` : String(results.length);

          return (
            <View key={`${combination}-${groupIndex}`} style={styles.group}>
              <View style={styles.groupHeader}>
                <View style={[styles.swatch, { backgroundColor: color }]} />
                <ThemedText>
                  Combination: <ThemedText style={styles.digits}>{combination}</ThemedText>
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={[styles.count, styles.groupCount]}>
                  Matches: {countLabel}
                </ThemedText>
              </View>

              {results.length === 0 ? (
                <ThemedText themeColor="textSecondary">No matches found.</ThemedText>
              ) : (
                <>
                  {results.slice(0, MAX_ROWS).map((result, index) => {
                    const flatIndex = offset + index;
                    const isActive = flatIndex === activeIndex;

                    return (
                      <View
                        key={`${result.path.map((cell) => `${cell.row},${cell.column}`).join('-')}`}
                        style={[styles.row, isActive && { borderColor: color }]}>
                        <View style={[styles.swatch, { backgroundColor: color }]} />
                        <ThemedText
                          onPress={() => onSelectResult(flatIndex)}
                          accessibilityRole="button"
                          accessibilityLabel={`Show path ${index + 1} of ${results.length} for combination ${combination} on the board, colour ${color}`}
                          style={[
                            styles.rowText,
                            isActive && { color: theme.text, fontWeight: '700' },
                          ]}>
                          {index + 1}. {getPathReference(result.path)}
                        </ThemedText>
                      </View>
                    );
                  })}

                  {results.length > MAX_ROWS && (
                    <ThemedText themeColor="textSecondary" style={styles.more}>
                      +{results.length - MAX_ROWS} more paths
                    </ThemedText>
                  )}
                </>
              )}
            </View>
          );
        })}
      </View>
    </FoldableCard>
  );
}

const styles = StyleSheet.create({
  count: {
    fontVariant: ['tabular-nums'],
  },
  digits: {
    fontFamily: Fonts.mono,
  },
  body: {
    gap: Spacing.three,
  },
  group: {
    gap: Spacing.half,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  groupCount: {
    marginLeft: 'auto',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: BorderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: BorderRadius.full,
  },
  rowText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    lineHeight: 20,
  },
  more: {
    fontSize: 12,
    lineHeight: 16,
  },
});
