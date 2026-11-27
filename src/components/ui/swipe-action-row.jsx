import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { Spacing, TouchTarget, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Row wrapper that reveals trailing actions on a deliberate left swipe.
 *
 * The gesture activates only after horizontal travel and fails as soon as the
 * finger moves vertically. Without the vertical fail threshold, a list drag
 * that drifts sideways claims the gesture and freezes the enclosing FlatList.
 * Taps never activate the pan, so row presses keep working normally.
 *
 * Coordination lives here:
 * - only one row can be open; opening another closes the previous one;
 * - `closeAllSwipeActions()` closes the open row on outside taps;
 * - taps on an open row close it instead of triggering row navigation.
 */

// Module-level registry: at most one row holds the open claim at a time.
let activeEntry = null;

function claimRow(entry) {
  if (activeEntry && activeEntry.id !== entry.id) {
    const previous = activeEntry;
    activeEntry = entry;
    previous.close();
  } else {
    activeEntry = entry;
  }
}

function releaseRow(id) {
  if (activeEntry && activeEntry.id === id) activeEntry = null;
}

/** Close whichever swipe row is open. No-op when none is open. */
export function closeAllSwipeActions() {
  if (!activeEntry) return;
  const entry = activeEntry;
  activeEntry = null;
  entry.close();
}

const ACTIVATION_OFFSET = 12;
const VERTICAL_FAIL_OFFSET = 12;
const OPEN_THRESHOLD_RATIO = 0.35;
const OPEN_VELOCITY = -420;
const SNAP = { duration: 180 };

/**
 * UI-thread helper. Keeping the write outside render lets the compiler treat
 * the shared value as read-only during render while worklets animate it.
 */
function setSwipeOffset(offset, value) {
  'worklet';
  offset.set(value);
}

/**
 * @param {Object} props
 * @param {string} props.rowId - stable row identity, usually the entry ID
 * @param {Array<{key: string, label: string, icon?: string, tone?: string, accessibilityLabel?: string, onPress?: () => void}>} props.actions
 * @param {React.ReactNode} props.children - sliding row content
 * @param {() => void} [props.onOpen]
 * @param {() => void} [props.onClose]
 * @param {boolean} [props.disabled=false]
 * @param {Object} [props.style]
 * @param {Object|Array} [props.contentStyle] - opaque surface style for children
 */
export function SwipeActionRow({
  rowId,
  actions = [],
  children,
  onOpen,
  onClose,
  disabled = false,
  style,
  contentStyle,
}) {
  const theme = useTheme();
  const autoId = useId();
  const id = rowId ?? autoId;

  const tones = useMemo(
    () => ({
      destructive: { background: theme.destructive, ink: 'primaryText' },
      default: { background: theme.backgroundSelected, ink: 'text' },
    }),
    [theme.backgroundSelected, theme.destructive]
  );

  // The sliding surface must be opaque so revealed buttons never bleed through
  // the row text while dragging or closing. Callers can override via
  // contentStyle, including selected-row backgrounds.
  const surfaceStyle = useMemo(
    () => [{ backgroundColor: theme.backgroundElement }, contentStyle],
    [contentStyle, theme.backgroundElement]
  );

  const [open, setOpen] = useState(false);
  const swipeX = useSharedValue(0);
  const actionsWidth = useSharedValue(0);
  const startX = useSharedValue(0);
  const dragging = useSharedValue(false);
  const closeRequest = useSharedValue(0);

  const enabled = !disabled && actions.length > 0;

  // JS closes go through a signal; a UI-thread reaction snaps the row shut.
  const closeSelf = useCallback(() => {
    closeRequest.set(closeRequest.get() + 1);
    setOpen(false);
    releaseRow(id);
    onClose?.();
    // Shared values are stable hook-owned objects, not render-time inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, onClose]);

  useAnimatedReaction(
    () => closeRequest.get(),
    (requested) => {
      'worklet';
      if (requested === 0) return;
      setSwipeOffset(swipeX, withTiming(0, SNAP));
    }
  );

  const settle = useCallback(
    (shouldOpen) => {
      setOpen(shouldOpen);
      if (shouldOpen) {
        claimRow({ id, close: closeSelf });
        onOpen?.();
      } else {
        releaseRow(id);
        onClose?.();
      }
    },
    [closeSelf, id, onClose, onOpen]
  );

  useEffect(
    () => () => {
      releaseRow(id);
    },
    [id]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .maxPointers(1)
        .activeOffsetX([-ACTIVATION_OFFSET, ACTIVATION_OFFSET])
        // Hand vertical drags back to the list before this pan can claim them.
        // A swipeable that wins a vertical drag freezes the enclosing list.
        .failOffsetY([-VERTICAL_FAIL_OFFSET, VERTICAL_FAIL_OFFSET])
        .onBegin(() => {
          'worklet';
          startX.set(swipeX.get());
        })
        .onStart(() => {
          'worklet';
          dragging.set(true);
        })
        .onUpdate((event) => {
          'worklet';
          const next = startX.get() + event.translationX;
          setSwipeOffset(
            swipeX,
            Math.min(0, Math.max(-actionsWidth.get(), next))
          );
        })
        .onEnd((event) => {
          'worklet';
          const width = actionsWidth.get();
          const shouldOpen =
            width > 0 &&
            (swipeX.get() < -width * OPEN_THRESHOLD_RATIO ||
              event.velocityX < OPEN_VELOCITY);
          setSwipeOffset(swipeX, withTiming(shouldOpen ? -width : 0, SNAP));
          dragging.set(false);
          runOnJS(settle)(shouldOpen);
        })
        .onFinalize(() => {
          'worklet';
          if (!dragging.get()) return;
          // Cancelled mid-drag by a list or modal: snap shut.
          dragging.set(false);
          setSwipeOffset(swipeX, withTiming(0, SNAP));
          runOnJS(settle)(false);
        }),
    // Shared values are stable hook-owned objects read by worklets at event
    // time, so they are intentionally not hook dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, settle]
  );

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.get() }],
  }));

  const actionsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: swipeX.get() < 0 ? 1 : 0,
  }));

  const handleActionsLayout = useCallback(
    (event) => {
      actionsWidth.set(event.nativeEvent.layout.width);
    },
    // Actions width is a stable hook-owned shared value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <GestureDetector gesture={pan} touchAction="pan-y">
      <Animated.View collapsable={false} style={[styles.row, style]}>
        {enabled ? (
          <Animated.View
            style={[styles.actionsLayer, actionsAnimatedStyle]}
            pointerEvents={open ? 'box-none' : 'none'}>
            <View style={styles.actions} onLayout={handleActionsLayout}>
              {actions.map((action) => {
                const tone = tones[action.tone] ?? tones.default;
                return (
                  <Pressable
                    key={action.key}
                    accessibilityRole="button"
                    accessibilityLabel={action.accessibilityLabel ?? action.label}
                    style={({ pressed }) => [
                      styles.action,
                      {
                        backgroundColor: tone.background,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                    onPress={() => {
                      closeSelf();
                      action.onPress?.();
                    }}>
                    {action.icon ? (
                      <AppIcon name={action.icon} size="small" tone={tone.ink} />
                    ) : null}
                    <ThemedText
                      themeColor={tone.ink}
                      numberOfLines={1}
                      style={styles.actionText}>
                      {action.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        ) : null}

        <Animated.View style={[styles.surface, surfaceStyle, contentAnimatedStyle]}>
          {children}
          {enabled && open ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close actions"
              onPress={closeSelf}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: {
    overflow: 'hidden',
    width: '100%',
  },
  // Explicit insets: StyleSheet.absoluteFillObject was removed in RN 0.88.
  actionsLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    zIndex: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  surface: {
    width: '100%',
    zIndex: 1,
  },
  action: {
    minHeight: TouchTarget,
    minWidth: TouchTarget * 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  actionText: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    fontWeight: Typography.weight.semibold,
  },
});

export default SwipeActionRow;
