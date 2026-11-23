import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BoardPreview } from '@/components/board/board-preview';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Board card in the library list
 * Shows board name, preview, favorite toggle, and active indicator
 *
 * @param {Object} props
 * @param {Object} props.board - Board object
 * @param {boolean} props.isActive - Whether this is the active board
 * @param {() => void} props.onOpen - Open board handler
 * @param {() => void} props.onEdit - Edit board handler
 * @param {() => void} props.onRename - Rename board handler
 * @param {() => void} props.onDuplicate - Duplicate board handler
 * @param {() => void} props.onDelete - Delete board handler
 * @param {() => void} props.onToggleFavorite - Toggle favorite handler
 */
export const BoardCard = memo(function BoardCard({
  board,
  isActive,
  onOpen,
  onEdit,
  onRename,
  onDuplicate,
  onDelete,
  onToggleFavorite,
}) {
  const theme = useTheme();

  return (
    <ThemedView
      type="backgroundElement"
      style={[
        styles.card,
        { borderColor: isActive ? theme.primary : theme.border },
        isActive && styles.activeCard,
      ]}>
      <View style={styles.content}>
        <View style={styles.leftColumn}>
          <BoardPreview grid={board.grid} size={80} />
        </View>

        <View style={styles.rightColumn}>
          <View style={styles.nameRow}>
            <ThemedText type="default" style={styles.boardName} numberOfLines={1}>
              {board.name}
            </ThemedText>
            {isActive && (
              <View style={[styles.activeBadge, { backgroundColor: theme.primary }]}>
                <Text style={[styles.activeBadgeText, { color: theme.primaryText }]}>
                  Active
                </Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            <ThemedText themeColor="textSecondary" style={styles.metaText}>
              10×10
            </ThemedText>
            {board.updatedAt && (
              <ThemedText themeColor="textSecondary" style={styles.metaText}>
                {formatRelativeTime(board.updatedAt)}
              </ThemedText>
            )}
          </View>

          <View style={styles.actionsRow}>
            <ActionButton label="Open" onPress={onOpen} theme={theme} />
            <ActionButton label="Edit" onPress={onEdit} theme={theme} />
            <ActionButton label="Rename" onPress={onRename} theme={theme} />
            <ActionButton label="Duplicate" onPress={onDuplicate} theme={theme} />
            <ActionButton
              label="Delete"
              onPress={onDelete}
              theme={theme}
              destructive
            />
            <Pressable
              onPress={onToggleFavorite}
              accessibilityLabel={
                board.isFavorite ? 'Remove from favorites' : 'Add to favorites'
              }
              style={({ pressed }) => [
                styles.favoriteButton,
                {
                  backgroundColor: board.isFavorite
                    ? theme.primary
                    : theme.background,
                  borderColor: board.isFavorite ? theme.primary : theme.border,
                },
                pressed && styles.pressed,
              ]}>
              <Text
                style={[
                  styles.favoriteText,
                  {
                    color: board.isFavorite ? theme.primaryText : theme.text,
                  },
                ]}>
                {board.isFavorite ? '★' : '☆'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ThemedView>
  );
});

function ActionButton({ label, onPress, theme, destructive }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          borderColor: destructive ? theme.destructive + '40' : theme.border,
        },
        pressed && styles.pressed,
      ]}>
      <Text
        style={[
          styles.actionText,
          { color: destructive ? theme.destructive : theme.primary },
        ]}>
        {label}
      </Text>
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
    marginBottom: Spacing.two,
  },
  activeCard: {
    borderWidth: 2,
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  boardName: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  activeBadge: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  metaText: {
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  actionButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.sm,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
