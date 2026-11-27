import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { SwipeActionRow } from '@/components/ui/swipe-action-row';
import {
  BorderRadius,
  Fonts,
  Interaction,
  Spacing,
  TouchTarget,
  Typography,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatAddedTime } from '@/utils/basket-format';
import { getPathReference } from '@/utils/cell-reference';

/**
 * One saved pick inside a date group card.
 *
 * Digits lead, original cell coordinates sit directly below them, and the
 * local time plus a quiet chevron sit on the right. The row has no card
 * surface of its own: the group card owns the surface, and only thin dividers
 * separate rows. Press and selected states change opacity/background without
 * moving any content.
 *
 * Browse mode allows a deliberate left swipe to reveal Remove. Selection mode
 * swaps that gesture for a checkbox and never opens the detail sheet.
 *
 * @param {Object} props
 * @param {{digits: string, path: Array, addedAt?: string|number}} props.entry
 * @param {boolean} [props.selected=false] - detail sheet target
 * @param {boolean} [props.checked=false] - temporary multi-select state
 * @param {boolean} [props.selectionMode=false]
 * @param {boolean} [props.showDivider=false]
 * @param {number} [props.width]
 * @param {(digits: string) => void} [props.onSelect]
 * @param {(digits: string) => void} [props.onToggleSelected]
 * @param {(digits: string) => void} [props.onRequestRemove]
 */
export const CollectionRow = memo(function CollectionRow({
  entry,
  selected = false,
  checked = false,
  selectionMode = false,
  showDivider = false,
  width,
  onSelect,
  onToggleSelected,
  onRequestRemove,
}) {
  const theme = useTheme();
  const { digits } = entry;
  const time = formatAddedTime(entry.addedAt);
  const coordinates = getPathReference(entry.path).split(' → ').join(' · ');

  const handleRowPress = useCallback(() => {
    if (selectionMode) {
      onToggleSelected?.(digits);
      return;
    }
    onSelect?.(digits);
  }, [digits, onSelect, onToggleSelected, selectionMode]);

  const removeActions = useMemo(
    () => [
      {
        key: 'remove',
        label: 'Remove',
        icon: 'trash',
        tone: 'destructive',
        accessibilityLabel: `Remove ${digits} from the basket`,
        onPress: () => onRequestRemove?.(digits),
      },
    ],
    [digits, onRequestRemove]
  );

  const surfaceStyle = useMemo(
    () => [
      {
        backgroundColor: selected
          ? theme.backgroundSelected
          : theme.backgroundElement,
      },
    ],
    [selected, theme.backgroundElement, theme.backgroundSelected]
  );

  const browseLabel = `Open details for ${digits}, at ${coordinates}, added ${time}`;
  const selectLabel = `Select ${digits}, at ${coordinates}, added ${time}`;
  const rowHighlighted = selectionMode ? checked : selected;

  const content = (
    <Pressable
      onPress={handleRowPress}
      accessibilityRole={selectionMode ? 'checkbox' : 'button'}
      accessibilityLabel={selectionMode ? selectLabel : browseLabel}
      accessibilityState={selectionMode ? { checked } : { selected }}
      style={({ pressed }) => [
        styles.row,
        { width, borderTopColor: theme.border },
        showDivider && styles.divider,
        rowHighlighted && {
          borderRadius: BorderRadius.sm,
          backgroundColor: theme.backgroundSelected,
        },
        pressed && styles.pressed,
      ]}>
      <View
        pointerEvents={selectionMode ? 'auto' : 'none'}
        style={[
          styles.checkbox,
          !selectionMode && styles.hidden,
          {
            borderColor: checked ? theme.primary : theme.border,
            backgroundColor: checked ? theme.primary : theme.background,
          },
        ]}>
        <AppIcon
          name="checkmark"
          size="inline"
          tone="primaryText"
          style={checked ? styles.checkVisible : styles.checkHidden}
        />
      </View>
      <View style={styles.primary}>
        <ThemedText numberOfLines={1} style={styles.digits}>
          {digits}
        </ThemedText>
        <ThemedText
          numberOfLines={1}
          style={[styles.coordinates, { color: theme.textSecondary }]}>
          {coordinates}
        </ThemedText>
      </View>
      <View style={styles.trailing}>
        <ThemedText
          numberOfLines={1}
          style={[styles.time, { color: theme.textSecondary }]}>
          {time}
        </ThemedText>
        <AppIcon
          name="chevron.right"
          size="small"
          tone="textSecondary"
          style={selectionMode ? styles.hidden : undefined}
        />
      </View>
    </Pressable>
  );

  if (selectionMode) return content;

  return (
    <SwipeActionRow rowId={digits} actions={removeActions} contentStyle={surfaceStyle}>
      {content}
    </SwipeActionRow>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: TouchTarget,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.half,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: Interaction.pressedOpacity,
  },
  hidden: {
    display: 'none',
  },
  checkbox: {
    width: 22,
    height: 22,
    flexShrink: 0,
    marginTop: Spacing.one,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkVisible: {
    opacity: 1,
  },
  checkHidden: {
    opacity: 0,
  },
  primary: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  digits: {
    fontSize: Typography.size.subtitle,
    lineHeight: Typography.lineHeight.subtitle,
    fontWeight: Typography.weight.semibold,
    fontFamily: Fonts.mono,
    fontVariant: ['tabular-nums'],
  },
  coordinates: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    fontVariant: ['tabular-nums'],
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  time: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    fontVariant: ['tabular-nums'],
  },
});
