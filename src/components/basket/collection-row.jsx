import { memo, useCallback, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';

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
import { useCollectionSelectionStore } from '@/store/collectionSelectionStore';
import {
  selectionModeProgress,
} from '@/store/collectionSelectionVisuals';
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
 * Selection is subscribed at row level: a toggle re-renders only the row whose
 * checked flag changed. Mode changes drive checkbox/chevron opacity and swipe
 * enablement through shared values, so entering selection mode never re-renders
 * every row. The row stays mounted throughout.
 *
 * @param {Object} props
 * @param {{digits: string, path: Array, addedAt?: string|number}} props.entry
 * @param {boolean} [props.selected=false] - detail sheet target
 * @param {boolean} [props.showDivider=false]
 * @param {number} [props.width]
 * @param {(digits: string) => void} [props.onSelect]
 * @param {(digits: string) => void} [props.onRequestRemove]
 */
export const CollectionRow = memo(function CollectionRow({
  entry,
  selected = false,
  showDivider = false,
  width,
  onSelect,
  onRequestRemove,
}) {
  const theme = useTheme();
  const { digits } = entry;
  const rowRef = useRef(null);
  const checked = useCollectionSelectionStore((state) => state.selectedIds.has(digits));
  const time = useMemo(() => formatAddedTime(entry.addedAt), [entry.addedAt]);
  const coordinates = useMemo(
    () => getPathReference(entry.path).split(' → ').join(' · '),
    [entry.path]
  );

  // Read once for initial native props. Later mode changes are applied to the
  // mounted view, not through a React subscription.
  const modeAtRender = useCollectionSelectionStore.getState().selectionMode;

  const handleRowPress = useCallback(() => {
    if (useCollectionSelectionStore.getState().selectionMode) {
      useCollectionSelectionStore.getState().toggleSelected(digits);
      return;
    }
    onSelect?.(digits);
  }, [digits, onSelect]);

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

  const highlighted = selected || checked;
  const surfaceStyle = useMemo(
    () => [
      {
        backgroundColor: highlighted
          ? theme.backgroundSelected
          : theme.backgroundElement,
      },
    ],
    [highlighted, theme.backgroundElement, theme.backgroundSelected]
  );

  const browseLabel = `Open details for ${digits}, at ${coordinates}, added ${time}`;
  const selectLabel = `Select ${digits}, at ${coordinates}, added ${time}`;

  const checkboxStyle = useAnimatedStyle(() => ({
    opacity: selectionModeProgress.get(),
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    opacity: 1 - selectionModeProgress.get(),
  }));

  const syncAccessibility = useCallback(
    (active) => {
      rowRef.current?.setNativeProps?.({
        accessibilityRole: active ? 'checkbox' : 'button',
        accessibilityLabel: active ? selectLabel : browseLabel,
        accessibilityState: active ? { checked } : { selected },
      });
    },
    [browseLabel, checked, selectLabel, selected]
  );

  useAnimatedReaction(
    () => selectionModeProgress.get() === 1,
    (active) => {
      runOnJS(syncAccessibility)(active);
    },
    [syncAccessibility]
  );

  const content = (
    <Pressable
      ref={rowRef}
      onPress={handleRowPress}
      accessibilityRole={modeAtRender ? 'checkbox' : 'button'}
      accessibilityLabel={modeAtRender ? selectLabel : browseLabel}
      accessibilityState={modeAtRender ? { checked } : { selected }}
      style={({ pressed }) => [
        styles.row,
        { width, borderTopColor: theme.border },
        showDivider && styles.divider,
        highlighted && {
          borderRadius: BorderRadius.sm,
          backgroundColor: theme.backgroundSelected,
        },
        pressed && styles.pressed,
      ]}>
      <Animated.View
        style={[
          styles.checkbox,
          checkboxStyle,
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
      </Animated.View>
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
        <Animated.View style={[styles.chevron, chevronStyle]}>
          <AppIcon name="chevron.right" size="small" tone="textSecondary" />
        </Animated.View>
      </View>
    </Pressable>
  );

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
  chevron: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    fontVariant: ['tabular-nums'],
  },
});
