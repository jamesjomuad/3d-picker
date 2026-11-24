import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AngleBoard } from '@/components/angle-board';
import { ReplaceTool } from '@/components/angle-board/replace-tool';
import { BoardCard } from '@/components/library/board-card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useScreenInsets } from '@/hooks/use-screen-insets';
import { useTheme } from '@/hooks/use-theme';
import { router } from 'expo-router';
import { useLibraryStore } from '@/store/libraryStore';

const FILTER_ALL = 'all';
const FILTER_FAVORITES = 'favorites';

export default function BoardsScreen() {
  const theme = useTheme();
  const { contentPadding, contentWidth } = useScreenInsets();

  // Store selectors
  const boards = useLibraryStore((s) => s.boards);
  const activeBoardId = useLibraryStore((s) => s.activeBoardId);
  const isLoaded = useLibraryStore((s) => s.isLoaded);
  const loadLibrary = useLibraryStore((s) => s.loadLibrary);
  const createBoard = useLibraryStore((s) => s.createBoard);
  const renameBoard = useLibraryStore((s) => s.renameBoard);
  const applyCells = useLibraryStore((s) => s.applyCells);
  const replaceCells = useLibraryStore((s) => s.replaceCells);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const duplicateBoard = useLibraryStore((s) => s.duplicateBoard);
  const deleteBoard = useLibraryStore((s) => s.deleteBoard);
  const setActiveBoard = useLibraryStore((s) => s.setActiveBoard);
  const getFilteredBoards = useLibraryStore((s) => s.getFilteredBoards);

  // Local UI state
  const [filter, setFilter] = useState(FILTER_ALL);
  const [renameDialog, setRenameDialog] = useState(null); // { id, name }
  const [renameValue, setRenameValue] = useState('');
  const [deleteDialog, setDeleteDialog] = useState(null); // { id, name }
  const [duplicateDialog, setDuplicateDialog] = useState(null); // { id }
  const [duplicateValue, setDuplicateValue] = useState('');
  const [editingBoardId, setEditingBoardId] = useState(null); // board open in the edit sheet
  const [editSnapshot, setEditSnapshot] = useState(null); // original grid, frozen for the session
  const [editSelection, setEditSelection] = useState(null); // block to fill from
  const [showReplaceTool, setShowReplaceTool] = useState(false);
  const [replaceMatches, setReplaceMatches] = useState(null); // Set of "row,col" keys

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // `boards` gates the memo: getFilteredBoards is a stable store action
  // that reads live state, so without it the memo would keep serving the
  // list captured at mount and a duplicated board would only appear when
  // the filter changed.
  const filteredBoards = useMemo(
    () => (Array.isArray(boards) ? getFilteredBoards(filter) : []),
    [boards, filter, getFilteredBoards]
  );

  // The Favorites tab shows its count next to the label; boards change
  // rarely enough that a straight filter over the list is the cheapest
  // honest number.
  const favoriteCount = useMemo(
    () => boards.filter((board) => board.isFavorite).length,
    [boards]
  );

  // The board itself, read from the store on every render: `applyCells` replaces
  // the board object, so a snapshot taken when the sheet opened would show the
  // digits as they were before the last edit.
  const editingBoard = useMemo(
    () => boards.find((b) => b.id === editingBoardId) ?? null,
    [boards, editingBoardId]
  );

  // The sheet carries its own fill pattern, so it starts clean each time: a
  // leftover selection from the last board would fill this one with those digits.
  // The grid it opened with is frozen as `editSnapshot`: Replace matches against
  // the board as it was, so digits written by an earlier replacement never
  // become a source for the next one.
  const openEditSheet = useCallback((boardId, grid) => {
    setEditSelection(null);
    setShowReplaceTool(false);
    setReplaceMatches(null);
    setEditSnapshot(grid ? grid.map((row) => [...row]) : null);
    setEditingBoardId(boardId);
  }, []);

  const closeEditSheet = useCallback(() => {
    setEditSelection(null);
    setShowReplaceTool(false);
    setReplaceMatches(null);
    setEditSnapshot(null);
    setEditingBoardId(null);
  }, []);

  const openReplaceTool = useCallback(() => {
    setReplaceMatches(null);
    setShowReplaceTool(true);
  }, []);

  const closeReplaceTool = useCallback(() => {
    setShowReplaceTool(false);
    setReplaceMatches(null);
  }, []);

  const toggleReplaceTool = useCallback(() => {
    if (showReplaceTool) closeReplaceTool();
    else openReplaceTool();
  }, [showReplaceTool, closeReplaceTool, openReplaceTool]);

  // Actions
  const handleCreate = useCallback(() => {
    const boardCount = boards.length + 1;
    const newBoard = createBoard({ name: `Board ${String(boardCount).padStart(3, '0')}` });
    // Jump to edit the new board immediately
    openEditSheet(newBoard.id, newBoard.grid);
  }, [boards.length, createBoard, openEditSheet]);

  const handleOpen = useCallback(
    (boardId) => {
      setActiveBoard(boardId);
      router.navigate('/');
    },
    [setActiveBoard]
  );

  const handleEdit = useCallback(
    (board) => {
      openEditSheet(board.id, board.grid);
    },
    [openEditSheet]
  );

  const handleRename = useCallback(
    (board) => {
      setRenameDialog({ id: board.id, name: board.name });
      setRenameValue(board.name);
    },
    []
  );

  const handleRenameConfirm = useCallback(() => {
    if (!renameDialog) return;
    // The Save button is already disabled while the field is blank; this is
    // the guard for any other path into confirm.
    if (!renameValue.trim()) return;
    renameBoard(renameDialog.id, renameValue);
    setRenameDialog(null);
    setRenameValue('');
  }, [renameDialog, renameValue, renameBoard]);

  const handleDelete = useCallback(
    (board) => {
      setDeleteDialog({ id: board.id, name: board.name });
    },
    []
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteDialog) return;
    deleteBoard(deleteDialog.id);
    setDeleteDialog(null);
  }, [deleteDialog, deleteBoard]);

  const handleDuplicate = useCallback((board) => {
    // Prefill with the store's own default, so accepting it unchanged is the
    // old one-tap path and naming the copy is optional.
    setDuplicateDialog({ id: board.id });
    setDuplicateValue(`${board.name} (copy)`);
  }, []);

  const handleDuplicateConfirm = useCallback(() => {
    if (!duplicateDialog) return;
    if (!duplicateValue.trim()) return;
    duplicateBoard(duplicateDialog.id, duplicateValue);
    setDuplicateDialog(null);
    setDuplicateValue('');
    // The copy is never a favorite, so it could not appear under the
    // Favorites filter: show All so the new board is visibly there.
    setFilter(FILTER_ALL);
  }, [duplicateDialog, duplicateValue, duplicateBoard]);

  const handleToggleFavorite = useCallback(
    (boardId) => {
      toggleFavorite(boardId);
    },
    [toggleFavorite]
  );

  // Edit sheet: digits to write, in the map the board reports (one cell from a
  // field, a whole block from a fill), stored in one step.
  const handleCellChange = useCallback(
    (changes) => {
      if (!editingBoardId) return;
      applyCells(editingBoardId, changes);
    },
    [editingBoardId, applyCells]
  );

  // Replace tool: writes every matching cell via replaceCells (persist-first)
  const handleReplaceAll = useCallback(
    async ({ count, changes }) => {
      if (!editingBoardId || count === 0) return;
      const result = await replaceCells(editingBoardId, changes);
      if (!result.success) {
        Alert.alert('Replace Failed', result.error || 'Could not save the changes.');
      }
    },
    [editingBoardId, replaceCells]
  );

  // Loading state
  if (!isLoaded) {
    return (
      <ScrollView
        style={[styles.scrollView, { backgroundColor: theme.background }]}
        contentContainerStyle={[styles.contentContainer, contentPadding]}>
        <View style={styles.loadingState}>
          <ActivityIndicator color={theme.primary} />
          <ThemedText themeColor="textSecondary">Loading boards...</ThemedText>
        </View>
      </ScrollView>
    );
  }

  // Empty state
  const isEmpty = filteredBoards.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, contentPadding]}>
        <View style={[styles.innerContainer, { width: contentWidth }]}>
          {/* Header */}
          <ThemedView style={styles.headerContainer}>
            <View style={styles.headerTop}>
              <View>
                <ThemedText type="subtitle">Boards</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.subtitleText}>
                  {boards.length} board{boards.length === 1 ? '' : 's'}
                </ThemedText>
              </View>
              <Button onPress={handleCreate} size="sm">
                + New
              </Button>
            </View>
          </ThemedView>

          {/* Filter tabs */}
          <View style={styles.filterRow}>
            <FilterTab
              label="All"
              count={boards.length}
              isActive={filter === FILTER_ALL}
              onPress={() => setFilter(FILTER_ALL)}
              theme={theme}
            />
            <FilterTab
              label="Favorites"
              count={favoriteCount}
              isActive={filter === FILTER_FAVORITES}
              onPress={() => setFilter(FILTER_FAVORITES)}
              theme={theme}
            />
          </View>

          {/* Board list */}
          {isEmpty ? (
            <ThemedView style={styles.emptyState}>
              <ThemedText type="smallBold" style={styles.emptyTitle}>
                {filter === FILTER_FAVORITES ? 'No favorites yet' : 'No boards yet'}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                {filter === FILTER_FAVORITES
                  ? 'Star a board to keep it within reach here.'
                  : 'Create an Angle Board to arrange your own digit grid.'}
              </ThemedText>
              {filter === FILTER_ALL && (
                <Button onPress={handleCreate} size="sm">
                  + Create Board
                </Button>
              )}
            </ThemedView>
          ) : (
            <View style={styles.listContainer}>
              {filteredBoards.map((board) => (
                <BoardCard
                  key={board.id}
                  board={board}
                  isActive={board.id === activeBoardId}
                  onOpen={handleOpen}
                  onEdit={handleEdit}
                  onRename={handleRename}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Rename and delete dialogs are true Modal popups: they paint above
          the screen and the sheet on their own window, dim what is behind,
          and answer the Android back gesture with Cancel. */}
      <ConfirmDialog
        visible={!!renameDialog}
        title="Rename Board"
        confirmLabel="Save"
        confirmDisabled={!renameValue.trim()}
        onCancel={() => setRenameDialog(null)}
        onConfirm={handleRenameConfirm}>
        <Input
          value={renameValue}
          onChangeText={setRenameValue}
          placeholder="Board name"
          autoFocus
        />
        {renameValue.trim() ? null : (
          <Text style={[styles.dialogError, { color: theme.destructive }]}>
            Enter a name for this board.
          </Text>
        )}
      </ConfirmDialog>

      {/* Duplicate asks for the copy's name, prefilled with the default */}
      <ConfirmDialog
        visible={!!duplicateDialog}
        title="Duplicate Board"
        message="Give the copy a name. Its grid is copied independently of the original."
        confirmLabel="Duplicate"
        confirmDisabled={!duplicateValue.trim()}
        onCancel={() => setDuplicateDialog(null)}
        onConfirm={handleDuplicateConfirm}>
        <Input
          value={duplicateValue}
          onChangeText={setDuplicateValue}
          placeholder="Board name"
          autoFocus
        />
        {duplicateValue.trim() ? null : (
          <Text style={[styles.dialogError, { color: theme.destructive }]}>
            Enter a name for the copy.
          </Text>
        )}
      </ConfirmDialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        visible={!!deleteDialog}
        title="Delete Board?"
        message={`"${deleteDialog?.name}" will be deleted from this device. This cannot be undone.`}
        confirmLabel="Delete Board"
        confirmVariant="destructive"
        onCancel={() => setDeleteDialog(null)}
        onConfirm={handleDeleteConfirm}
      />

      {/* Edit sheet: the same board, in editable mode */}
      <Modal
        visible={!!editingBoard}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeEditSheet}>
        <ScrollView
          style={[styles.editModal, { backgroundColor: theme.background }]}
          contentContainerStyle={[styles.editModalContent, contentPadding]}>
          <View style={[styles.editModalInner, { width: contentWidth }]}>
            <View style={styles.editHeader}>
              <ThemedText type="subtitle">Edit Board</ThemedText>
              <ThemedText
                themeColor="textSecondary"
                style={styles.subtitleText}>
                {editingBoard?.name}
              </ThemedText>
            </View>

            <View style={styles.editToolbar}>
              <Button
                variant={showReplaceTool ? 'secondary' : 'outline'}
                size="sm"
                onPress={toggleReplaceTool}>
                {showReplaceTool ? '✕ Close Replace' : 'Replace'}
              </Button>
            </View>

            {showReplaceTool && editingBoard && (
              <ReplaceTool
                // Replace reads the session snapshot, never the working grid.
                grid={editSnapshot ?? editingBoard.grid}
                onReplaceAll={handleReplaceAll}
                onClose={closeReplaceTool}
                onMatchesChange={setReplaceMatches}
              />
            )}

            {editingBoard && (
              <AngleBoard
                grid={editingBoard.grid}
                selection={editSelection}
                onSelectionChange={setEditSelection}
                editable
                onCellChange={handleCellChange}
                matchHighlights={replaceMatches}
              />
            )}

            <View style={styles.editActions}>
              <Button variant="primary" onPress={closeEditSheet}>
                Done
              </Button>
            </View>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

function FilterTab({ label, count, isActive, onPress, theme }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={`${label}, ${count} ${count === 1 ? 'board' : 'boards'}`}
      accessibilityState={{ selected: isActive }}
      style={({ pressed }) => [
        styles.filterTab,
        {
          backgroundColor: isActive ? theme.primary : theme.backgroundElement,
          borderColor: isActive ? theme.primary : theme.border,
        },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.filterText, { color: isActive ? theme.primaryText : theme.text }]}>
        {label}
      </Text>
      <Text style={[styles.filterCount, { color: isActive ? theme.primaryText : theme.textSecondary }]}>
        {count}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
    flexGrow: 1,
  },
  innerContainer: {
    flexShrink: 1,
    width: '100%',
  },
  headerContainer: {
    marginBottom: Spacing.three,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtitleText: {
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    justifyContent: 'center',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterCount: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  listContainer: {
    gap: Spacing.two,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
  },
  emptyState: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: BorderRadius.md,
  },
  emptyTitle: {
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  // Rename dialog (ConfirmDialog children)
  dialogError: {
    fontSize: 13,
  },
  // Edit modal
  editModal: {
    flex: 1,
  },
  editModalContent: {
    alignItems: 'center',
    flexGrow: 1,
  },
  editModalInner: {
    width: '100%',
    gap: Spacing.three,
  },
  editHeader: {
    gap: Spacing.half,
  },
  editToolbar: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  editActions: {
    marginTop: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
