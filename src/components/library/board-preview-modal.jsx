import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { BoardPreview } from '@/components/library/board-preview';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useScreenInsets } from '@/hooks/use-screen-insets';
import { useTheme } from '@/hooks/use-theme';

/**
 * Read-only board preview opened from the library card's options sheet.
 *
 * The modal gives the grid its own surface above the tab navigator. Outside
 * taps, Android back, and the Close button all take the same exit path, so
 * preview can never trap the list behind it.
 */
export function BoardPreviewModal({ board, onClose }) {
  const theme = useTheme();
  const { contentWidth } = useScreenInsets();

  if (!board) return null;

  const rows = board.grid?.length ?? 0;
  const columns = rows > 0 ? board.grid[0]?.length ?? 0 : 0;
  const previewSize = Math.max(200, Math.min(contentWidth, 360));

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <Pressable
        style={styles.overlay}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close board preview">
        <View
          style={[
            styles.card,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
          onStartShouldSetResponder={() => true}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.title}>
            {board.name}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.meta}>
            {rows}×{columns} grid
          </ThemedText>

          <BoardPreview grid={board.grid} size={previewSize} />

          <Button
            variant="primary"
            icon="xmark"
            onPress={onClose}
            accessibilityLabel="Close board preview"
            style={styles.closeButton}>
            Close
          </Button>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
  },
  title: {
    fontSize: Typography.size.subtitle,
    fontWeight: Typography.weight.semibold,
    alignSelf: 'flex-start',
  },
  meta: {
    alignSelf: 'flex-start',
    fontSize: Typography.size.body,
  },
  closeButton: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
});
