import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { AngleBoard } from '@/components/angle-board';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, TouchTarget, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatAddedAt } from '@/utils/basket-format';
import { MIN_CELL_SIZE, getBoardSize } from '@/utils/board-layout';
import { getPathReference } from '@/utils/cell-reference';
import { MAX_RESULTS } from '@/utils/combination-search';
import { AppIcon } from '@/components/ui/app-icon';

/**
 * Detail sheet for one saved basket pick.
 *
 * Opens when a Collection row is tapped and carries the exact entry chosen by
 * the caller — digits are the basket's stable identity, so several rows can
 * never be confused. The active board is embedded as a read-only preview with
 * the saved cells marked. Tapping that embedded board plots the pick, and the
 * explicit Plot action does the same. Remove is delegated upward so the
 * Collection screen owns its confirmation dialog. It follows
 * the existing Modal/backdrop pattern used by the board actions sheet, with a
 * bubble-phase guard so backdrop taps and Android back both dismiss safely.
 *
 * @param {Object} props
 * @param {boolean} props.visible
 * @param {{ digits: string, path: Array, addedAt?: string }|null} props.entry
 * @param {string|null} [props.activeBoardName] - board the pick will be plotted on
 * @param {{ grid: number[][], cells: Set<string>, highlights?: Object|null, matchCount?: number }|null} [props.preview] -
 *   active board grid, validated saved cells, and the search-style colour
 *   layer for every path matching the saved digits
 * @param {string|null} [props.plotError] - why this pick cannot be plotted
 * @param {() => void} props.onClose
 * @param {() => void} props.onPlot - called by the embedded board and Plot action
 * @param {() => void} props.onRemove - asks the screen to confirm removal
 */
export function BasketEntrySheet({
  visible,
  entry,
  activeBoardName,
  preview,
  plotError,
  onClose,
  onPlot,
  onRemove,
}) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();

  if (!entry) return null;

  const addedAt = formatAddedAt(entry.addedAt);
  const matchCount = preview?.matchCount ?? 0;
  const matchLabel = matchCount >= MAX_RESULTS ? `${MAX_RESULTS}+` : String(matchCount);
  const boardWidth = preview
    ? Math.min(
        getBoardSize(preview.grid.length, preview.grid[0]?.length ?? 0, MIN_CELL_SIZE).width,
        width - Spacing.four * 2
      )
    : 0;
  // A 10x10 preview fits, but keep the sheet scrollable on short screens.
  const maxContentHeight = Math.max(320, Math.round(height * 0.76));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close pick details">
        <View
          style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}
          // Bubble phase: the sheet content wins its own touches, while taps on
          // the sheet's padding stay here instead of hitting the backdrop.
          onStartShouldSetResponder={() => true}>
          <ScrollView style={{ maxHeight: maxContentHeight }} contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <ThemedText type="smallBold" style={styles.eyebrow}>
                Saved pick
              </ThemedText>
              <ThemedText style={styles.digits}>{entry.digits}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.detail}>
                Cells  {getPathReference(entry.path)}
              </ThemedText>
              {addedAt ? (
                <ThemedText themeColor="textSecondary" style={styles.detail}>
                  Added  {addedAt}
                </ThemedText>
              ) : null}
            </View>

            {preview ? (
              <View style={[styles.preview, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <ThemedText type="smallBold" style={styles.previewLabel}>
                  Plot preview{activeBoardName ? ` · ${activeBoardName}` : ''}
                </ThemedText>
                <Pressable
                  onPress={onPlot}
                  accessibilityRole="button"
                  accessibilityLabel={`Plot ${entry.digits} on active board`}
                  style={({ pressed }) => [
                    styles.boardFrame,
                    { backgroundColor: theme.background },
                    pressed && styles.pressed,
                  ]}>
                  <View pointerEvents="none">
                    <AngleBoard
                      grid={preview.grid}
                      highlights={preview.highlights ?? null}
                      plotCells={preview.cells}
                      style={{ width: boardWidth }}
                    />
                  </View>
                </Pressable>
                <ThemedText themeColor="textSecondary" style={styles.previewHint}>
                  {matchCount === 0
                    ? 'No matching paths on this board · Tap to plot saved cells'
                    : `${matchLabel} matching path${matchCount === 1 ? '' : 's'} · Tap the board to plot`}
                </ThemedText>
              </View>
            ) : null}

            {plotError ? (
              <ThemedText themeColor="destructive" style={styles.errorText}>
                {plotError}
              </ThemedText>
            ) : null}

            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <SheetAction label="Plot on Active Board" icon="swap" onPress={onPlot} theme={theme} />
            <SheetAction
              label="Remove from Basket"
              icon="trash"
              destructive
              onPress={() => onRemove(entry.digits)}
              theme={theme}
            />
            <SheetAction label="Close" icon="xmark" onPress={onClose} theme={theme} />
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

/** One full-width sheet action, sized to the platform touch-target token. */
function SheetAction({ label, onPress, theme, icon, destructive = false }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.action,
        { borderColor: destructive ? theme.destructive : theme.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.actionContent}>
        {icon ? (
          <AppIcon name={icon} size="small" tone={destructive ? 'destructive' : 'text'} />
        ) : null}
        <Text
          style={[
            styles.actionText,
            { color: destructive ? theme.destructive : theme.text },
          ]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    paddingHorizontal: Spacing.two,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
  content: {
    gap: Spacing.one,
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.half,
  },
  eyebrow: {
    fontSize: Typography.size.caption,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  digits: {
    fontSize: Typography.size.section,
    fontWeight: Typography.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  detail: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
  },
  preview: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.one,
    padding: Spacing.two,
    gap: Spacing.one,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewLabel: {
    fontSize: Typography.size.body,
  },
  previewHint: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
  },
  boardFrame: {
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  errorText: {
    paddingHorizontal: Spacing.three,
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
  },
  action: {
    minHeight: TouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  actionText: {
    fontSize: Typography.size.bodyLarge,
    fontWeight: Typography.weight.semibold,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
