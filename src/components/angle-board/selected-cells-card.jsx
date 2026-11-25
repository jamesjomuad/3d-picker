import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { FoldableCard } from '@/components/ui/foldable-card';
import { BorderRadius, Fonts, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getSelectionInsights } from '@/utils/selection-insights';
import { getSelectionSummary } from '@/utils/selection-summary';

const COPY_FEEDBACK_MS = 1600;

/**
 * Selected cells card
 *
 * Shows the digits, coordinates and range for an Angle Board selection, plus
 * a compact bordered insights card (cell, digit and Fun Pick combination counts). It
 * takes the same `grid` + `selection` pair the board takes, so it sits beside
 * the board in any screen and never reads a store or modifies the selection
 * itself.
 *
 * @param {Object} props
 * @param {number[][]} props.grid - the board's digits, read row-major
 * @param {Set<string>} props.selection - selected "row,col" keys
 * @param {Function} [props.onClear] - called when the Clear button is pressed
 * @param {Function} [props.onFunPick] - called when the Fun Pick button is pressed
 * @param {Object} [props.style] - Additional card styles
 */
export function SelectedCellsCard({ grid, selection, onClear, onFunPick, style }) {
  const theme = useTheme();
  const [copyStatus, setCopyStatus] = useState('idle');
  const resetTimer = useRef(null);

  const summary = useMemo(() => getSelectionSummary(grid, selection), [grid, selection]);
  const insights = useMemo(() => getSelectionInsights(grid, selection), [grid, selection]);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    []
  );

  const handleCopy = useCallback(async () => {
    if (!summary.hasSelection) return;

    try {
      await Clipboard.setStringAsync(summary.digitsText);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }

    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyStatus('idle'), COPY_FEEDBACK_MS);
  }, [summary.digitsText, summary.hasSelection]);

  const copyLabel = copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy';

  const stats = [
    { label: 'Cells', value: insights.cellCount },
    { label: 'Unique digits', value: insights.uniqueDigitCount },
    { label: 'Repeated digits', value: insights.repeatedDigitCount },
    { label: 'Combinations', value: insights.combinationCount },
    { label: 'Start cells', value: insights.startCellCount },
  ];

  return (
    <FoldableCard
      style={style}
      title="Selected Cells"
      trailing={
        <View style={styles.headerActions} pointerEvents="box-none">
          {onClear && (
            <Button size="sm" variant="outline" onPress={onClear} icon="trash">
              Clear
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onPress={handleCopy} icon="doc.on.doc"
            disabled={!summary.hasSelection}>
            {copyLabel}
          </Button>
          {onFunPick && summary.hasSelection && (
            <Button size="sm" variant="primary" onPress={onFunPick} icon="sparkles">
              Fun Pick
            </Button>
          )}
        </View>
      }>
      {summary.hasSelection ? (
        <View style={styles.body}>
          <View style={styles.digitGrid}>
            {summary.entries.map((cell) => (
              <View
                key={cell.key}
                style={[styles.digitChip, { backgroundColor: theme.primary }]}>
                <ThemedText themeColor="primaryText" style={styles.digitText}>
                  {cell.value}
                </ThemedText>
              </View>
            ))}
          </View>

          <ThemedText themeColor="textSecondary" style={styles.coordinates}>
            {summary.coordinatesText}
          </ThemedText>

          <View style={styles.meta}>
            {summary.type !== 'single' && (
              <ThemedText themeColor="textSecondary" style={styles.metaText}>
                Range: {summary.rangeLabel}
              </ThemedText>
            )}
            <ThemedText themeColor="textSecondary" style={styles.metaText}>
              {summary.typeLabel}
            </ThemedText>
          </View>

          <ThemedView
            type="background"
            style={[styles.insights, { borderColor: theme.border }]}>
            <ThemedText themeColor="textSecondary" style={styles.insightsTitle}>
              Insights
            </ThemedText>
            <View style={styles.statRow}>
              {stats.map((stat) => (
                <View key={stat.label} style={styles.stat}>
                  <ThemedText style={styles.statValue}>{stat.value}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                    {stat.label}
                  </ThemedText>
                </View>
              ))}
            </View>
          </ThemedView>
        </View>
      ) : (
        <ThemedText themeColor="textSecondary" style={styles.emptyText}>
          Tap or drag on the board to select cells.
        </ThemedText>
      )}
    </FoldableCard>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  body: {
    gap: Spacing.two,
  },
  digitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  digitChip: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitText: {
    fontFamily: Fonts.mono,
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
    fontWeight: Typography.weight.semibold,
  },
  coordinates: {
    fontFamily: Fonts.mono,
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.body,
  },
  meta: {
    gap: Spacing.half,
  },
  metaText: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
  },
  insights: {
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
    padding: Spacing.two,
  },
  insightsTitle: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    fontWeight: Typography.weight.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  stat: {
    minWidth: 64,
    gap: Spacing.half,
  },
  statValue: {
    fontFamily: Fonts.mono,
    fontSize: Typography.size.bodyLarge,
    lineHeight: Typography.lineHeight.body,
    fontWeight: Typography.weight.semibold,
  },
  statLabel: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
  },
  emptyText: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
  },
});
