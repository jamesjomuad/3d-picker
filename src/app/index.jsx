import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AngleBoard, SelectedCellsCard } from '@/components/angle-board';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useScreenInsets } from '@/hooks/use-screen-insets';
import { useTheme } from '@/hooks/use-theme';
import { useAngleBoardStore } from '@/store/angleBoardStore';
import { useLibraryStore } from '@/store/libraryStore';

/**
 * Picker — the Angle Board at full size, with the selection summary under it.
 *
 * The screen owns no board logic. It picks which board to show (the library's
 * active board), holds the selection in the store so the board and the card read
 * one source of truth, and passes both down.
 */
export default function PickerScreen() {
  const theme = useTheme();
  const { contentPadding, contentWidth } = useScreenInsets();

  const selection = useAngleBoardStore((state) => state.selectedCells);
  const setSelection = useAngleBoardStore((state) => state.setSelection);
  const clearSelection = useAngleBoardStore((state) => state.clearSelection);

  const isLoaded = useLibraryStore((state) => state.isLoaded);
  const loadLibrary = useLibraryStore((state) => state.loadLibrary);
  const board = useLibraryStore((state) => {
    return state.boards.find((b) => b.id === state.activeBoardId) || state.boards[0] || null;
  });

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

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
        </ThemedView>

        <AngleBoard grid={board.grid} selection={selection} onSelectionChange={setSelection} />

        <SelectedCellsCard grid={board.grid} selection={selection} style={styles.selectionCard} />

        {selection.size > 0 && (
          <ThemedText type="linkPrimary" style={styles.clearButton} onPress={clearSelection}>
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
  selectionCard: {
    marginTop: Spacing.three,
  },
  clearButton: {
    marginTop: Spacing.three,
    textAlign: 'center',
    fontSize: 14,
  },
});
