import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AngleBoard } from '@/components/angle-board';
import { ReplaceTool } from '@/components/angle-board/replace-tool';
import { BoardCard } from '@/components/library/board-card';
import { BoardJsonEditor } from '@/components/library/board-json-editor';
import { GridSizeControl } from '@/components/library/grid-size-control';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Interaction, Spacing, TouchTarget, Typography } from '@/constants/theme';
import { useScreenInsets } from '@/hooks/use-screen-insets';
import { useTheme } from '@/hooks/use-theme';
import { router } from 'expo-router';
import { useLibraryStore } from '@/store/libraryStore';
import { compareBoards, parseBoardJson, serializeBoardJson } from '@/utils/board-json';
import { resizeGrid as resizeGridData } from '@/utils/board-resize';
import { AppIcon } from '@/components/ui/app-icon';

const FILTER_ALL = 'all';
const FILTER_FAVORITES = 'favorites';
const EDIT_MODE_VISUAL = 'visual';
const EDIT_MODE_JSON = 'json';
const EDIT_MODE_OPTIONS = [
  { label: 'Visual Editor', mode: EDIT_MODE_VISUAL },
  { label: 'JSON Editor', mode: EDIT_MODE_JSON },
];

export default function BoardsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
  const resizeBoardGrid = useLibraryStore((s) => s.resizeGrid);
  const applyEditedBoard = useLibraryStore((s) => s.applyEditedBoard);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const duplicateBoard = useLibraryStore((s) => s.duplicateBoard);
  const deleteBoard = useLibraryStore((s) => s.deleteBoard);
  const setActiveBoard = useLibraryStore((s) => s.setActiveBoard);
  const getFilteredBoards = useLibraryStore((s) => s.getFilteredBoards);

  // Local UI state
  const [filter, setFilter] = useState(FILTER_ALL);
  const [createDialog, setCreateDialog] = useState(false);
  const [createValue, setCreateValue] = useState('');
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
  const [editMode, setEditMode] = useState(EDIT_MODE_VISUAL);
  const [jsonText, setJsonText] = useState('');
  const [jsonBaseline, setJsonBaseline] = useState('');
  const [jsonPreview, setJsonPreview] = useState(null);
  const [jsonErrors, setJsonErrors] = useState([]);
  const [jsonApplying, setJsonApplying] = useState(false);
  const [pendingEditMode, setPendingEditMode] = useState(null);
  const [pendingClose, setPendingClose] = useState(false);
  const [pendingResize, setPendingResize] = useState(null); // { rows, columns }
  const editBoardRef = useRef(null);

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

  const isJsonDirty = jsonText !== jsonBaseline;

  const resetJsonEditor = useCallback(() => {
    setEditMode(EDIT_MODE_VISUAL);
    setJsonText('');
    setJsonBaseline('');
    setJsonPreview(null);
    setJsonErrors([]);
    setJsonApplying(false);
    setPendingEditMode(null);
    setPendingClose(false);
  }, []);

  // The sheet carries its own fill pattern, so it starts clean each time: a
  // leftover selection from the last board would fill this one with those digits.
  // The grid it opened with is frozen as `editSnapshot`: Replace matches against
  // the board as it was, so digits written by an earlier replacement never
  // become a source for the next one.
  const openEditSheet = useCallback(
    (boardId, grid) => {
      setEditSelection(null);
      setShowReplaceTool(false);
      setReplaceMatches(null);
      setPendingResize(null);
      setEditSnapshot(grid ? grid.map((row) => [...row]) : null);
      setEditingBoardId(boardId);
      resetJsonEditor();
    },
    [resetJsonEditor]
  );

  const closeEditSheet = useCallback(() => {
    setEditSelection(null);
    setShowReplaceTool(false);
    setReplaceMatches(null);
    setPendingResize(null);
    setEditSnapshot(null);
    setEditingBoardId(null);
    resetJsonEditor();
  }, [resetJsonEditor]);

  // Footer and mode taps keep keyboard focus, so the field's blur handler may
  // never fire. Ask the board to commit its open cell before leaving it.
  const commitOpenCellEdit = useCallback(() => {
    editBoardRef.current?.commitEdit();
  }, []);

  // Closing with unapplied JSON text is data loss. Ask first, same as switching
  // editor modes does.
  const requestCloseEditSheet = useCallback(() => {
    commitOpenCellEdit();
    if (editMode === EDIT_MODE_JSON && isJsonDirty) {
      setPendingClose(true);
      return;
    }
    closeEditSheet();
  }, [closeEditSheet, commitOpenCellEdit, editMode, isJsonDirty]);

  const openReplaceTool = useCallback(() => {
    commitOpenCellEdit();
    setReplaceMatches(null);
    setShowReplaceTool(true);
  }, [commitOpenCellEdit]);

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
    setCreateValue(`Board ${String(boardCount).padStart(3, '0')}`);
    setCreateDialog(true);
  }, [boards.length]);

  const handleCreateConfirm = useCallback(() => {
    const name = createValue.trim();
    if (!name) return;

    const newBoard = createBoard({ name });
    setCreateDialog(false);
    setCreateValue('');
    // Jump to edit the new board immediately
    openEditSheet(newBoard.id, newBoard.grid);
  }, [createValue, createBoard, openEditSheet]);

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

  // Resizing changes the grid itself. Stop editing, clear anything tied to the
  // old coordinates, and refresh the Replace snapshot from the resized grid.
  const applyGridResize = useCallback(
    (rows, columns) => {
      if (!editingBoardId) return;
      const result = resizeBoardGrid(editingBoardId, rows, columns);
      if (!result.success) {
        Alert.alert('Resize Failed', result.error || 'Could not resize this board.');
        return;
      }

      setEditSelection(null);
      setReplaceMatches(null);
      setShowReplaceTool(false);
      setEditSnapshot(result.grid.map((row) => [...row]));
      setPendingResize(null);
    },
    [editingBoardId, resizeBoardGrid]
  );

  const requestGridResize = useCallback(
    (rows, columns) => {
      if (!editingBoardId || !editingBoard) return;
      commitOpenCellEdit();

      // Read the store again: the commit above may have just written a digit.
      const board =
        useLibraryStore.getState().boards.find((b) => b.id === editingBoardId) ?? editingBoard;
      const result = resizeGridData(board.grid, rows, columns);
      if (!result.success) {
        Alert.alert('Invalid Board Size', result.error);
        return;
      }

      if (result.shrunk) {
        setPendingResize({ rows, columns });
        return;
      }

      applyGridResize(rows, columns);
    },
    [applyGridResize, commitOpenCellEdit, editingBoard, editingBoardId]
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

  const handleEditModeChange = useCallback(
    (mode) => {
      if (mode === editMode) return;

      if (mode === EDIT_MODE_JSON) {
        commitOpenCellEdit();
        // Read the store again: the commit above may have just written a digit.
        const board =
          useLibraryStore.getState().boards.find((b) => b.id === editingBoardId) ?? editingBoard;
        if (!board) return;
        const serialized = serializeBoardJson(board);
        setJsonText(serialized);
        setJsonBaseline(serialized);
        setJsonPreview(null);
        setJsonErrors([]);
        setEditMode(EDIT_MODE_JSON);
        return;
      }

      if (isJsonDirty) {
        setPendingEditMode(mode);
        return;
      }

      setJsonPreview(null);
      setJsonErrors([]);
      setEditMode(mode);
    },
    [commitOpenCellEdit, editMode, editingBoard, editingBoardId, isJsonDirty]
  );

  const handleDiscardJson = useCallback(() => {
    setJsonText('');
    setJsonBaseline('');
    setJsonPreview(null);
    setJsonErrors([]);
    if (pendingEditMode) setEditMode(pendingEditMode);
    setPendingEditMode(null);
  }, [pendingEditMode]);

  const handleJsonCancel = useCallback(() => {
    setJsonText('');
    setJsonBaseline('');
    setJsonPreview(null);
    setJsonErrors([]);
    setEditMode(EDIT_MODE_VISUAL);
  }, []);

  const handleJsonTextChange = useCallback((text) => {
    setJsonText(text);
    setJsonPreview(null);
    setJsonErrors([]);
  }, []);

  const handleJsonPreview = useCallback(() => {
    if (!editingBoard) return;
    const parsed = parseBoardJson(jsonText, editingBoard);
    if (!parsed.success) {
      setJsonErrors(parsed.errors);
      setJsonPreview(null);
      return;
    }

    const comparison = compareBoards(editingBoard, parsed.board);
    setJsonErrors([]);
    setJsonPreview({
      board: parsed.board,
      changed: comparison.changed,
      changes: comparison.changes,
    });
  }, [editingBoard, jsonText]);

  const handleJsonApply = useCallback(async () => {
    if (!editingBoard || !editingBoardId || jsonApplying) return;

    const parsed = parseBoardJson(jsonText, editingBoard);
    if (!parsed.success) {
      setJsonErrors(parsed.errors);
      setJsonPreview(null);
      return;
    }

    setJsonApplying(true);
    let result;
    try {
      result = await applyEditedBoard(editingBoardId, parsed.board);
    } catch {
      result = { success: false, error: 'Could not save the changes.' };
    } finally {
      setJsonApplying(false);
    }

    if (!result.success) {
      setJsonErrors([{ message: result.error || 'Could not save the changes.' }]);
      return;
    }

    const applied = result.board ?? parsed.board;
    const serialized = serializeBoardJson(applied);
    setJsonText(serialized);
    setJsonBaseline(serialized);
    setJsonPreview(null);
    setJsonErrors([]);
    setEditMode(EDIT_MODE_VISUAL);
  }, [applyEditedBoard, editingBoard, editingBoardId, jsonApplying, jsonText]);

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
              <Button onPress={handleCreate} size="sm" icon="plus">New
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
                <Button onPress={handleCreate} size="sm" icon="plus">Create Board
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
        visible={createDialog}
        title="New Board"
        message="Give the board a name."
        confirmLabel="Create"
        confirmDisabled={!createValue.trim()}
        onCancel={() => {
          setCreateDialog(false);
          setCreateValue('');
        }}
        onConfirm={handleCreateConfirm}>
        <Input
          value={createValue}
          onChangeText={setCreateValue}
          placeholder="Board name"
          autoFocus
        />
        {createValue.trim() ? null : (
          <Text style={[styles.dialogError, { color: theme.destructive }]}>
            Enter a name for this board.
          </Text>
        )}
      </ConfirmDialog>

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

      <ConfirmDialog
        visible={!!pendingResize}
        title="Shrink board?"
        message={`Resizing to ${pendingResize?.rows} rows by ${pendingResize?.columns} columns deletes cells outside the new grid. This cannot be undone.`}
        confirmLabel="Shrink board"
        confirmVariant="destructive"
        cancelLabel="Keep size"
        onCancel={() => setPendingResize(null)}
        onConfirm={() => {
          if (pendingResize) applyGridResize(pendingResize.rows, pendingResize.columns);
        }}
      />

      <ConfirmDialog
        visible={!!pendingEditMode}
        title="Discard JSON changes?"
        message="Unapplied JSON edits will be lost. The board stays as it is."
        confirmLabel="Discard and switch"
        confirmVariant="destructive"
        cancelLabel="Keep editing"
        onCancel={() => setPendingEditMode(null)}
        onConfirm={handleDiscardJson}
      />

      <ConfirmDialog
        visible={pendingClose}
        title="Discard JSON changes?"
        message="Unapplied JSON edits will be lost. The board stays as it is."
        confirmLabel="Discard and close"
        confirmVariant="destructive"
        cancelLabel="Keep editing"
        onCancel={() => setPendingClose(false)}
        onConfirm={closeEditSheet}
      />

      {/* Edit sheet: the same board, in editable mode */}
      <Modal
        visible={!!editingBoard}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={requestCloseEditSheet}>
        <KeyboardAvoidingView
          behavior="padding"
          style={[styles.editModal, { backgroundColor: theme.background }]}>
          <ScrollView
            style={styles.editScrollView}
            contentContainerStyle={[
              styles.editModalContent,
              {
                paddingTop: insets.top + Spacing.three,
                paddingLeft: insets.left,
                paddingRight: insets.right,
                paddingBottom: Spacing.two,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
            <View style={[styles.editModalInner, { width: contentWidth }]}>
              <View style={styles.editHeader}>
                <ThemedText type="subtitle">Edit Board</ThemedText>
                <ThemedText
                  themeColor="textSecondary"
                  style={styles.subtitleText}>
                  {editingBoard?.name}
                </ThemedText>
              </View>

              {editMode === EDIT_MODE_VISUAL ? (
                <>
                  {editingBoard && (
                    <AngleBoard
                      ref={editBoardRef}
                      grid={editingBoard.grid}
                      selection={editSelection}
                      onSelectionChange={setEditSelection}
                      editable
                      onCellChange={handleCellChange}
                      matchHighlights={replaceMatches}
                    />
                  )}

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
                    <GridSizeControl
                      rows={editingBoard.grid.length}
                      columns={editingBoard.grid[0]?.length ?? 0}
                      onChange={requestGridResize}
                    />
                  )}
                </>
              ) : (
                editingBoard && (
                  <BoardJsonEditor
                    value={jsonText}
                    onChangeText={handleJsonTextChange}
                    width={contentWidth}
                    errors={jsonErrors}
                    preview={jsonPreview}
                    applying={jsonApplying}
                    onPreview={handleJsonPreview}
                    onApply={handleJsonApply}
                    onCancel={handleJsonCancel}
                    showActions={false}
                  />
                )
              )}
            </View>
          </ScrollView>

          <View
            style={[
              styles.editFooter,
              {
                borderTopColor: theme.border,
                paddingLeft: Math.max(insets.left, insets.right) + Spacing.three,
                paddingRight: Math.max(insets.left, insets.right) + Spacing.three,
                paddingBottom: insets.bottom + Spacing.two,
              },
            ]}>
            <View style={[styles.editFooterInner, { width: contentWidth }]}>
              <View style={styles.modeSwitch}>
                {EDIT_MODE_OPTIONS.map((option) => {
                  const isActive = editMode === option.mode;
                  return (
                    <Pressable
                      key={option.mode}
                      onPress={() => handleEditModeChange(option.mode)}
                      accessibilityRole="tab"
                      accessibilityLabel={option.label}
                      accessibilityState={{ selected: isActive }}
                      style={({ pressed }) => [
                        styles.modeTab,
                        {
                          backgroundColor: isActive ? theme.primary : theme.backgroundElement,
                          borderColor: isActive ? theme.primary : theme.border,
                        },
                        pressed && styles.pressed,
                      ]}>
                      <AppIcon
                        name={option.label === 'JSON' ? 'curlybraces' : 'square.grid.2x2'}
                        size="small"
                        tone={isActive ? 'primaryText' : 'textSecondary'}
                      />
                      <Text
                        style={[
                          styles.modeTabText,
                          { color: isActive ? theme.primaryText : theme.text },
                        ]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.editFooterActions}>
                {editMode === EDIT_MODE_VISUAL ? (
                  <View style={styles.editActionRow}>
                    <Button
                      variant="secondary"
                      onPress={toggleReplaceTool}
                      style={styles.footerAction}
                      icon={showReplaceTool ? 'xmark' : 'swap'}
                      accessibilityLabel={showReplaceTool ? 'Close Replace tool' : 'Open Replace tool'}>
                      {showReplaceTool ? 'Close Replace' : 'Replace'}
                    </Button>
                    <Button
                      variant="primary"
                      onPress={requestCloseEditSheet}
                      style={styles.footerAction}
                      icon="checkmark.circle"
                      accessibilityLabel="Close board editor"
                      accessibilityHint="Cell edits are saved as you make them.">
                      Done
                    </Button>
                  </View>
                ) : (
                  <View style={styles.editActionRow}>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={handleJsonCancel}
                      disabled={jsonApplying}
                      style={styles.footerAction}
                      icon="xmark"
                      accessibilityLabel="Discard JSON changes"
                      accessibilityHint="Returns to the visual editor without applying JSON edits.">
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={handleJsonPreview}
                      disabled={jsonApplying || !jsonText.trim()}
                      style={styles.footerAction}
                      icon="eye"
                      accessibilityLabel="Preview JSON changes"
                      accessibilityHint="Checks the JSON and shows what will change.">
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={requestCloseEditSheet}
                      style={styles.footerAction}
                      icon="xmark.circle"
                      accessibilityLabel="Close board editor"
                      accessibilityHint={
                        isJsonDirty ? 'Unapplied JSON edits will be discarded.' : undefined
                      }>
                      Close
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onPress={handleJsonApply}
                      disabled={!jsonText.trim() || jsonApplying}
                      loading={jsonApplying}
                      style={styles.footerAction}
                      icon="checkmark"
                      accessibilityLabel="Apply JSON changes"
                      accessibilityHint="Validates and saves the JSON to this board.">
                      Apply
                    </Button>
                  </View>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    fontSize: Typography.size.body,
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
    minHeight: TouchTarget,
    justifyContent: 'center',
  },
  filterText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
  },
  filterCount: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.bold,
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
    fontSize: Typography.size.bodyLarge,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
  },
  // Rename dialog (ConfirmDialog children)
  dialogError: {
    fontSize: Typography.size.body,
  },
  // Edit modal
  editModal: {
    flex: 1,
  },
  editScrollView: {
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
  editFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  editFooterInner: {
    gap: Spacing.two,
  },
  editFooterActions: {
    gap: Spacing.two,
  },
  editActionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  footerAction: {
    flex: 1,
    flexShrink: 1,
    minWidth: TouchTarget,
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.one,
  },
  modeSwitch: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  modeTab: {
    flex: 1,
    minHeight: TouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.one,
  },
  modeTabText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    textAlign: 'center',
  },
  pressed: {
    opacity: Interaction.pressedOpacity,
  },
});
