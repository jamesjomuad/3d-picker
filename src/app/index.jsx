import { useCallback, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { SelectedCellsCard } from '@/components/angle-board/SelectedCellsCard';
import { AngleBoardGrid } from '@/components/board/angle-board-grid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useScreenInsets } from '@/hooks/use-screen-insets';
import { useTheme } from '@/hooks/use-theme';
import { useBoardStore } from '@/store/boardStore';
import { useLibraryStore } from '@/store/libraryStore';

export default function PickerScreen() {
  const theme = useTheme();
  const { contentPadding, contentWidth } = useScreenInsets();
  const selectedCells = useBoardStore((state) => state.selectedCells);
  const clearSelection = useBoardStore((state) => state.clearSelection);

  // Library store - subscribe to the specific values that affect rendering
  const isLoaded = useLibraryStore((s) => s.isLoaded);
  const loadLibrary = useLibraryStore((s) => s.loadLibrary);
  const board = useLibraryStore((s) => {
    return s.boards.find((b) => b.id === s.activeBoardId) || s.boards[0] || null;
  });

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const handleClear = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Loading state
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

  const selectionCount = selectedCells.size;

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.contentContainer, contentPadding]}>
      <View style={[styles.innerContainer, { width: contentWidth }]}>
        <ThemedView style={styles.headerContainer}>
          <ThemedText type="subtitle">{board.name}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitleText}>
            Tap or drag to select cells
          </ThemedText>
          {selectionCount > 0 && (
            <ThemedText themeColor="textSecondary" style={styles.countText}>
              {selectionCount} cell{selectionCount === 1 ? '' : 's'} selected
            </ThemedText>
          )}
        </ThemedView>

        <AngleBoardGrid board={board} />

        <SelectedCellsCard
          board={board}
          selectedCells={selectedCells}
          style={styles.selectionCard}
        />

        {selectionCount > 0 && (
          <ThemedText type="linkPrimary" style={styles.clearButton} onPress={handleClear}>
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
  selectionCard: {
    marginTop: Spacing.three,
  },
  clearButton: {
    marginTop: Spacing.three,
    textAlign: 'center',
    fontSize: 14,
  },
});
