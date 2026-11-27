import { memo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { BoardPreview } from '@/components/library/board-preview';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AppIcon } from '@/components/ui/app-icon';

/**
 * Board card in the library list
 *
 * One surface, one primary action: tapping anywhere on the card opens the
 * board actions sheet. That sheet carries Preview, Set Board, Edit, Rename,
 * Duplicate, favorite and Delete, with Delete styled destructive. The compact row keeps
 * Edit one tap away. The sheet dismisses on an outside tap, the hardware back
 * gesture or Cancel, so it can never trap the list behind it. The favorite
 * star sits on the title row where it reads as a property of the board rather
 * than an action competing with it.
 *
 * @param {Object} props
 * @param {Object} props.board - Board object
 * @param {boolean} props.isActive - Whether this is the active board
 * @param {(board: Object) => void} props.onPreview - Preview board handler
 * @param {(id: string) => void} props.onSetBoard - Set active board and open it handler
 * @param {(board: Object) => void} props.onEdit - Edit board handler
 * @param {(board: Object) => void} props.onRename - Rename board handler
 * @param {(board: Object) => void} props.onDuplicate - Duplicate board handler
 * @param {(board: Object) => void} props.onDelete - Delete board handler
 * @param {(id: string) => void} props.onToggleFavorite - Toggle favorite handler
 */
export const BoardCard = memo(function BoardCard({
  board,
  isActive,
  onPreview,
  onSetBoard,
  onEdit,
  onRename,
  onDuplicate,
  onDelete,
  onToggleFavorite,
}) {
  const theme = useTheme();

  // Dimensions come from the grid itself; nothing in a board is 10×10 by law.
  const rows = board.grid?.length ?? 0;
  const columns = rows > 0 ? board.grid[0].length : 0;

  // The ⋯ sheet is the card's own moment of UI: local state, and every row
  // closes it before delegating, so Rename or Delete never stack on top of
  // it and an outside tap always has somewhere to go.
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      <Pressable
      onPress={() => setShowMore(true)}
      accessibilityRole="button"
      accessibilityLabel={`More options for ${board.name}${isActive ? ', active board' : ''}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: isActive ? theme.primary : theme.border,
        },
        isActive && styles.activeCard,
        pressed && styles.cardPressed,
      ]}>
      <View style={styles.content}>
        <View style={styles.leftColumn}>
          <BoardPreview grid={board.grid} size={80} />
        </View>

        <View style={styles.rightColumn}>
          <View style={styles.titleRow}>
            <ThemedText type="default" style={styles.boardName} numberOfLines={1}>
              {board.name}
            </ThemedText>
            <Pressable
              onPress={() => onToggleFavorite(board.id)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={
                board.isFavorite ? `Remove ${board.name} from favorites` : `Add ${board.name} to favorites`
              }
              accessibilityState={{ selected: board.isFavorite }}
              style={({ pressed }) => [
                styles.favoriteButton,
                {
                  backgroundColor: board.isFavorite ? theme.primary : theme.background,
                  borderColor: board.isFavorite ? theme.primary : theme.border,
                },
                pressed && styles.pressed,
              ]}>
              <AppIcon name={board.isFavorite ? 'star' : 'star.slash'} size="small" tone={board.isFavorite ? 'primaryText' : 'textSecondary'} />
            </Pressable>
          </View>

          <View style={styles.metaRow}>
            {isActive && (
              <View style={[styles.activeBadge, { backgroundColor: theme.primary }]}>
                <Text style={[styles.activeBadgeText, { color: theme.primaryText }]}>Active</Text>
              </View>
            )}
            {rows > 0 && (
              <ThemedText themeColor="textSecondary" style={styles.metaText}>
                {rows}×{columns}
              </ThemedText>
            )}
            {board.updatedAt && (
              <ThemedText themeColor="textSecondary" style={styles.metaText}>
                {formatRelativeTime(board.updatedAt)}
              </ThemedText>
            )}
          </View>

          <View style={styles.actionsRow}>
            <PillButton label="Edit" icon="square.and.pencil" onPress={() => onEdit(board)} theme={theme} />
            <PillButton
              label="More" icon="ellipsis"
              onPress={() => setShowMore(true)}
              theme={theme}
              accessibilityLabel={`More options for ${board.name}`}
            />
          </View>
        </View>
      </View>
      </Pressable>

      <BoardActionsSheet
        visible={showMore}
        board={board}
        onHide={() => setShowMore(false)}
        onPreview={onPreview}
        onSetBoard={onSetBoard}
        onEdit={onEdit}
        onRename={onRename}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onToggleFavorite={onToggleFavorite}
      />
    </>
  );
});

/**
 * Compact secondary-action pill. The visual box stays small and quiet;
 * hitSlop lifts the effective touch area past 44dp.
 */
function PillButton({ label, onPress, theme, accessibilityLabel, icon }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.pill,
        { borderColor: theme.border, backgroundColor: theme.background },
        pressed && styles.pressed,
      ]}>
      <View style={styles.pillContent}>
        {icon ? <AppIcon name={icon} size="small" tone="primary" /> : null}
        <Text style={[styles.pillText, { color: theme.primary }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Bottom sheet of ⋯ options for one board.
 *
 * A real Modal, so it escapes the card and the scrolling list: the dim
 * backdrop is a Pressable that hides the sheet on an outside tap, the
 * hardware back gesture arrives through onRequestClose, and taps inside
 * the sheet are captured so they never fall through to the backdrop.
 * Every row closes the sheet first, then delegates to the card's handler,
 * so Rename or Delete opens on top of a dismissed sheet.
 */
function BoardActionsSheet({
  visible,
  board,
  onHide,
  onPreview,
  onSetBoard,
  onEdit,
  onRename,
  onDuplicate,
  onDelete,
  onToggleFavorite,
}) {
  const theme = useTheme();

  // Close, then act: the sheet is gone before any dialog or navigation
  // the action may raise.
  const pick = (action) => () => {
    onHide();
    action();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onHide}>
      <Pressable
        style={styles.sheetBackdrop}
        onPress={onHide}
        accessibilityRole="button"
        accessibilityLabel="Dismiss board options">
        <View
          style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}
          // Bubble phase, never capture: a capture-phase handler here takes
          // the touch itself, which would leave every row below it dead.
          // In the bubble phase the deepest responder (a SheetRow) wins
          // first, and only taps on the sheet's own padding reach this.
          onStartShouldSetResponder={() => true}>
          <View style={styles.sheetHeader}>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.sheetTitle}>
              {board.name}
            </ThemedText>
          </View>

          <SheetRow label="Preview" icon="eye" onPress={pick(() => onPreview(board))} theme={theme} />
          <SheetRow label="Set Board" icon="checkmark.circle" onPress={pick(() => onSetBoard(board.id))} theme={theme} />
          <SheetRow label="Edit board" icon="square.and.pencil" onPress={pick(() => onEdit(board))} theme={theme} />
          <SheetRow label="Rename" icon="text.cursor" onPress={pick(() => onRename(board))} theme={theme} />
          <SheetRow label="Duplicate" icon="doc.on.doc" onPress={pick(() => onDuplicate(board))} theme={theme} />
          <SheetRow
            label={board.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            icon={board.isFavorite ? 'star.slash' : 'star'}
            onPress={pick(() => onToggleFavorite(board.id))}
            theme={theme}
          />
          <SheetRow
            label="Delete board"
            icon="trash"
            destructive
            onPress={pick(() => onDelete(board))}
            theme={theme}
          />

          <View style={[styles.sheetDivider, { backgroundColor: theme.border }]} />
          <SheetRow label="Cancel" icon="xmark" onPress={onHide} theme={theme} />
        </View>
      </Pressable>
    </Modal>
  );
}

/** One full-width row of the actions sheet; destructive rows read red. */
function SheetRow({ label, value, onPress, theme, destructive, icon }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}>
      <View style={styles.sheetRowLabelWrap}>
        {icon ? (
          <AppIcon name={icon} size="small" tone={destructive ? 'destructive' : 'text'} />
        ) : null}
        <Text style={[styles.sheetRowLabel, { color: destructive ? theme.destructive : theme.text }]}>
          {label}
        </Text>
      </View>
      {value ? (
        <Text style={[styles.sheetRowValue, { color: theme.textSecondary }]}>{value}</Text>
      ) : null}
    </Pressable>
  );
}

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  activeCard: {
    borderWidth: 2,
  },
  cardPressed: {
    opacity: 0.85,
  },
  content: {
    flexDirection: 'row',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  leftColumn: {
    flexShrink: 0,
    justifyContent: 'center',
  },
  rightColumn: {
    flex: 1,
    gap: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  boardName: {
    fontSize: Typography.size.bodyLarge,
    fontWeight: Typography.weight.semibold,
    flexShrink: 1,
  },
  favoriteButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  favoriteText: {
    fontSize: Typography.size.bodyLarge,
    fontWeight: Typography.weight.semibold,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  activeBadge: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  activeBadgeText: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaText: {
    fontSize: Typography.size.caption,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  pill: {
    minHeight: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  pillText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    paddingHorizontal: Spacing.two,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
  sheetHeader: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  sheetTitle: {
    fontSize: Typography.size.body,
    opacity: 0.7,
  },
  sheetRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.md,
  },
  sheetRowLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  sheetRowLabel: {
    flexShrink: 1,
    fontSize: Typography.size.bodyLarge,
  },
  sheetRowValue: {
    fontSize: Typography.size.body,
  },
  sheetDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
