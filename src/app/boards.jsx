import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
  const [editingBoardId, setEditingBoardId] = useState(null); // board open in the edit sheet
  const [editSelection, setEditSelection] = useState(null); // block to fill from
  const [showReplaceTool, setShowReplaceTool] = useState(false);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const filteredBoards = useMemo(
    () => getFilteredBoards(filter),
    [getFilteredBoards, filter]
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
  const openEditSheet = useCallback((boardId) => {
    setEditSelection(null);
    setShowReplaceTool(false);
    setEditingBoardId(boardId);
  }, []);

  const closeEditSheet = useCallback(() => {
    setEditSelection(null);
    setShowReplaceTool(false);
    setEditingBoardId(null);
  }, []);

  // Actions
  const handleCreate = useCallback(() => {
    const boardCount = boards.length + 1;
    const newBoard = createBoard({ name: `Board ${String(boardCount).padStart(3, '0')}` });
    // Jump to edit the new board immediately
    openEditSheet(newBoard.id);
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
      openEditSheet(board.id);
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
    if (!renameValue.trim()) {
      Alert.alert('Invalid Name', 'Board name cannot be empty');
      return;
    }
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

  const handleDuplicate = useCallback(
    (boardId) => {
      duplicateBoard(boardId);
    },
    [duplicateBoard]
  );

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
        <View style={[styles.innerContainer, { width: contentWidth }]}>
          <ThemedText themeColor="textSecondary">Loading boards...</ThemedText>
        </View>
      </ScrollView>
    );
  }

  // Empty state
  const isEmpty = filteredBoards.length === 0;

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
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
            isActive={filter === FILTER_ALL}
            onPress={() => setFilter(FILTER_ALL)}
            theme={theme}
          />
          <FilterTab
            label="Favorites"
            isActive={filter === FILTER_FAVORITES}
            onPress={() => setFilter(FILTER_FAVORITES)}
            theme={theme}
          />
        </View>

        {/* Board list */}
        {isEmpty ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {filter === FILTER_FAVORITES
                ? 'No favorite boards yet. Tap ☆ to favorite a board.'
                : 'No boards yet. Create one to get started.'}
            </ThemedText>
          </ThemedView>
        ) : (
          <View style={styles.listContainer}>
            {filteredBoards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                isActive={board.id === activeBoardId}
                onOpen={() => handleOpen(board.id)}
                onEdit={() => handleEdit(board)}
                onRename={() => handleRename(board)}
                onDuplicate={() => handleDuplicate(board.id)}
                onDelete={() => handleDelete(board)}
                onToggleFavorite={() => handleToggleFavorite(board.id)}
              />
            ))}
          </View>
        )}
      </View>

      {/* Rename dialog */}
      <ConfirmDialog
        visible={!!renameDialog}
        title="Rename Board"
        confirmLabel="Rename"
        onCancel={() => setRenameDialog(null)}
        onConfirm={handleRenameConfirm}>
        <Input
          value={renameValue}
          onChangeText={setRenameValue}
          placeholder="Board name"
          autoFocus
        />
      </ConfirmDialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        visible={!!deleteDialog}
        title="Delete Board"
        message={`Are you sure you want to delete "${deleteDialog?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
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
                onPress={() => setShowReplaceTool((prev) => !prev)}>
                {showReplaceTool ? '✕ Close Replace' : 'Replace'}
              </Button>
            </View>

            {showReplaceTool && editingBoard && (
              <ReplaceTool
                grid={editingBoard.grid}
                onReplaceAll={handleReplaceAll}
                onClose={() => setShowReplaceTool(false)}
              />
            )}

            {editingBoard && (
              <AngleBoard
                grid={editingBoard.grid}
                selection={editSelection}
                onSelectionChange={setEditSelection}
                editable
                onCellChange={handleCellChange}
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
    </ScrollView>
  );
}

function FilterTab({ label, isActive, onPress, theme }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterTab,
        {
          backgroundColor: isActive ? theme.primary : theme.backgroundElement,
          borderColor: isActive ? theme.primary : theme.border,
        },
        pressed && styles.pressed,
      ]}>
      <Text
        style={[
          styles.filterText,
          { color: isActive ? theme.primaryText : theme.text },
        ]}>
        {label}
      </Text>
    </Pressable>
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
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 40,
    justifyContent: 'center',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    gap: Spacing.two,
  },
  emptyState: {
    padding: Spacing.four,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
  // Rename dialog (ConfirmDialog children)
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
