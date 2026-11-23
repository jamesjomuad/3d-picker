import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
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
 * Lists the paths a combination was found along, and hands the tapped row back
 * as the active result. It reads only its props: the search itself lives in
 * `@/utils/combination-search`, and highlighting the board is the screen's job.
 *
 * @param {Object} props
 * @param {string} props.combination - the digits that were searched for
 * @param {Array<{ digits: string, path: Array<{row: number, column: number}> }>} props.results
 * @param {number} props.activeIndex - which result the board is emphasising
 * @param {(index: number) => void} props.onSelectResult
 * @param {Object} [props.style] - Additional card styles
 */
export function CombinationSearchResults({
  combination,
  results,
  activeIndex,
  onSelectResult,
  style,
}) {
  const theme = useTheme();

  const countLabel =
    results.length >= MAX_RESULTS ? `${MAX_RESULTS}+` : String(results.length);

  return (
    <Card
      style={style}
      header={
        <View style={styles.headerRow}>
          <ThemedText type="smallBold">Combination Search</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.count}>
            {countLabel}
          </ThemedText>
        </View>
      }>
      {results.length === 0 ? (
        <View style={styles.body}>
          <ThemedText>
            Combination: <ThemedText style={styles.digits}>{combination}</ThemedText>
          </ThemedText>
          <ThemedText themeColor="textSecondary">No matches found.</ThemedText>
        </View>
      ) : (
        <View style={styles.body}>
          <ThemedText>
            Combination: <ThemedText style={styles.digits}>{combination}</ThemedText>
          </ThemedText>
          <ThemedText themeColor="textSecondary">Matches: {countLabel}</ThemedText>

          {results.slice(0, MAX_ROWS).map((result, index) => {
            const isActive = index === activeIndex;

            return (
              <View
                key={`${result.path.map((cell) => `${cell.row},${cell.column}`).join('-')}`}
                style={[
                  styles.row,
                  isActive && {
                    backgroundColor: theme.backgroundSelected,
                    borderColor: theme.primary,
                  },
                ]}>
                <ThemedText
                  onPress={() => onSelectResult(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Show path ${index + 1} of ${results.length} on the board`}
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
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  count: {
    fontVariant: ['tabular-nums'],
  },
  digits: {
    fontFamily: Fonts.mono,
  },
  body: {
    gap: Spacing.half,
  },
  row: {
    borderRadius: BorderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
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
