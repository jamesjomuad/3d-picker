import { useCallback } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AngleBoardGrid } from '@/components/board/angle-board-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadBoard } from '@/services/board-loader';
import { useBoardStore } from '@/store/boardStore';

const board = loadBoard();

export default function PickerScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const selectedCells = useBoardStore((state) => state.selectedCells);
  const toggleCell = useBoardStore((state) => state.toggleCell);
  const clearSelection = useBoardStore((state) => state.clearSelection);

  const contentWidth = Math.min(width - Spacing.three * 2, MaxContentWidth);
  const paddingBottom = insets.bottom + BottomTabInset + Spacing.three;

  const handleCellPress = useCallback(
    (rowIndex, colIndex) => {
      toggleCell(rowIndex, colIndex);
    },
    [toggleCell]
  );

  const selectionCount = selectedCells.size;

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, { paddingBottom }]}
      contentInset={{
        top: insets.top,
        left: insets.left,
        right: insets.right,
      }}>
      <View style={[styles.innerContainer, { width: contentWidth }]}>
        <ThemedView style={styles.headerContainer}>
          <ThemedText type="subtitle">{board.name}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitleText}>
            Tap cells to select them
          </ThemedText>
          {selectionCount > 0 && (
            <ThemedText themeColor="textSecondary" style={styles.countText}>
              {selectionCount} cell{selectionCount === 1 ? '' : 's'} selected
            </ThemedText>
          )}
        </ThemedView>

        <AngleBoardGrid
          board={board}
          selectedCells={selectedCells}
          onCellPress={handleCellPress}
        />

        {selectionCount > 0 && (
          <ThemedText
            type="linkPrimary"
            style={styles.clearButton}
            onPress={clearSelection}>
            Clear selection
          </ThemedText>
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
    paddingTop: Spacing.three,
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
  countText: {
    fontSize: 14,
    marginTop: Spacing.half,
  },
  clearButton: {
    marginTop: Spacing.three,
    textAlign: 'center',
    fontSize: 14,
  },
});
