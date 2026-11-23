import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BorderRadius, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getSelectionSummary } from '@/utils/selection-summary';

const COPY_FEEDBACK_MS = 1600;

/**
 * Selected cells card
 *
 * Shows the digits, coordinates, range and count for the current Angle Board
 * selection. Selection state is passed in from the Picker screen so the store
 * is not subscribed twice; the component never modifies the selection.
 *
 * @param {Object} props
 * @param {{ name?: string, grid: number[][] }} props.board - Angle Board
 * @param {Set<string>} props.selectedCells - Store selection set ("row,col")
 * @param {Object} [props.style] - Additional card styles
 */
export function SelectedCellsCard({ board, selectedCells, style }) {
  const theme = useTheme();
  const [copyStatus, setCopyStatus] = useState('idle');
  const resetTimer = useRef(null);

  const summary = useMemo(
    () => getSelectionSummary(board?.grid, selectedCells),
    [board?.grid, selectedCells]
  );

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

  return (
    <Card
      style={style}
      header={
        <View style={styles.headerRow}>
          <ThemedText type="smallBold">Selected Cells</ThemedText>
          <Button
            size="sm"
            variant="outline"
            onPress={handleCopy}
            disabled={!summary.hasSelection}>
            {copyLabel}
          </Button>
        </View>
      }>
      {summary.hasSelection ? (
        <View style={styles.body}>
          <View style={styles.digitGrid}>
            {summary.entries.map((cell) => (
              <View
                key={cell.key}
                style={[styles.digitChip, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText style={[styles.digitText, { color: theme.text }]}>
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
              {summary.count} cell{summary.count === 1 ? '' : 's'} selected · {summary.typeLabel}
            </ThemedText>
          </View>
        </View>
      ) : (
        <ThemedText themeColor="textSecondary" style={styles.emptyText}>
          Tap or drag on the board to select cells.
        </ThemedText>
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
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  coordinates: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  meta: {
    gap: Spacing.half,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
