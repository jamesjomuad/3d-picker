import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/icon-button';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const DEFAULT_SNAP_POINTS = [0.5, 1];
const SHEET_SPRING = { damping: 24, stiffness: 240, mass: 0.9 };
const DISMISS_DURATION_MS = 180;
const DRAG_ACTIVATION = 10;
const DRAG_SLOP = 16;

/**
 * Shared bottom sheet with handle-only dragging.
 *
 * Snap points are ascending fractions of screen height. Children own their
 * scrolling; this component never attaches gestures to content. Dismissal is
 * requested through `onClose`, so callers decide how to dismiss the screen.
 *
 * @param {Object} props
 * @param {boolean} [props.visible=true] - Whether the sheet is mounted
 * @param {number[]} [props.snapPoints=DEFAULT_SNAP_POINTS] - Ascending height fractions
 * @param {number} [props.initialSnapIndex=0] - Initial index into `snapPoints`
 * @param {() => void} props.onClose - Called after the dismiss animation
 * @param {(index: number) => void} [props.onSnapChange] - Called after snapping
 * @param {boolean} [props.dismissOnBackdropPress=true] - Backdrop closes sheet
 * @param {boolean} [props.dismissOnBackPress=true] - Android Back closes sheet
 * @param {boolean} [props.showHandle=true] - Show drag handle
 * @param {Object} [props.handleStyle] - Style applied to the handle bar
 * @param {number} [props.backdropOpacity=0.35] - Backdrop opacity at full height
 * @param {boolean} [props.showCloseButton=false] - Show floating close button
 * @param {string} [props.closeButtonLabel='Close sheet'] - Close button label
 * @param {React.ReactNode} [props.children] - Sheet content
 */
export function BottomSheet({
  visible = true,
  snapPoints = DEFAULT_SNAP_POINTS,
  initialSnapIndex = 0,
  onClose,
  onSnapChange,
  dismissOnBackdropPress = true,
  dismissOnBackPress = true,
  showHandle = true,
  handleStyle,
  backdropOpacity = 0.35,
  showCloseButton = false,
  closeButtonLabel = 'Close sheet',
  children,
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const dismissedRef = useRef(false);

  const points = snapPoints.length > 0 ? snapPoints : DEFAULT_SNAP_POINTS;
  const initialIndex = Math.max(0, Math.min(points.length - 1, initialSnapIndex));
  const backdropFadePoint = points[Math.min(1, points.length - 1)];

  const sheetY = useSharedValue((1 - points[initialIndex]) * windowHeight);
  const detentIndex = useSharedValue(initialIndex);
  const dragStartY = useSharedValue(0);
  const dragStartDetent = useSharedValue(initialIndex);

  useEffect(() => {
    if (!visible) return;
    dismissedRef.current = false;
    detentIndex.set(initialIndex);
    sheetY.set((1 - points[initialIndex]) * windowHeight);
  }, [detentIndex, initialIndex, points, sheetY, visible, windowHeight]);

  useEffect(() => {
    sheetY.set((1 - points[detentIndex.get()]) * windowHeight);
  }, [detentIndex, points, sheetY, windowHeight]);

  const snapToIndex = useCallback(
    (index) => {
      const nextIndex = Math.max(0, Math.min(points.length - 1, index));
      detentIndex.set(nextIndex);
      sheetY.set(withSpring((1 - points[nextIndex]) * windowHeight, SHEET_SPRING));
      onSnapChange?.(nextIndex);
    },
    [detentIndex, onSnapChange, points, sheetY, windowHeight]
  );

  const requestClose = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    sheetY.set(
      withTiming(windowHeight, { duration: DISMISS_DURATION_MS }, () => {
        runOnJS(onClose)();
      })
    );
  }, [onClose, sheetY, windowHeight]);

  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!dismissOnBackPress) return true;
      requestClose();
      return true;
    });
    return () => subscription.remove();
  }, [dismissOnBackPress, requestClose, visible]);

  const panGesture = usePanGesture({
    activeOffsetY: [-DRAG_ACTIVATION, DRAG_ACTIVATION],
    failOffsetX: [-DRAG_SLOP, DRAG_SLOP],
    shouldCancelWhenOutside: false,
    onActivate: () => {
      'worklet';
      dragStartY.set(sheetY.get());
      dragStartDetent.set(detentIndex.get());
    },
    onUpdate: (event) => {
      'worklet';
      const maxY = windowHeight * (1 - points[0]);
      const nextY = dragStartY.get() + event.translationY;
      sheetY.set(Math.min(maxY, Math.max(0, nextY)));
    },
    onDeactivate: (event) => {
      'worklet';
      const current = dragStartDetent.get();
      if (event.canceled) {
        runOnJS(snapToIndex)(current);
        return;
      }
      if (event.translationY > DRAG_ACTIVATION) {
        if (current === 0) {
          runOnJS(requestClose)();
        } else {
          runOnJS(snapToIndex)(current - 1);
        }
        return;
      }
      if (event.translationY < -DRAG_ACTIVATION) {
        runOnJS(snapToIndex)(Math.min(current + 1, points.length - 1));
        return;
      }
      runOnJS(snapToIndex)(current);
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({
    height: windowHeight - sheetY.get(),
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      sheetY.get(),
      [0, windowHeight * (1 - backdropFadePoint)],
      [backdropOpacity, 0],
      Extrapolation.CLAMP
    ),
  }));

  if (!visible) return null;

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          style={styles.backdropPress}
          onPress={dismissOnBackdropPress ? requestClose : undefined}
          disabled={!dismissOnBackdropPress}
          accessibilityLabel={closeButtonLabel}
        />
      </Animated.View>

      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          {
            backgroundColor: theme.background,
            borderTopColor: theme.border,
            paddingTop: Spacing.one,
            paddingLeft: insets.left + Spacing.three,
            paddingRight: insets.right + Spacing.three,
            paddingBottom: insets.bottom,
          },
          sheetStyle,
        ]}>
        {showHandle && (
          <GestureDetector gesture={panGesture}>
            <View style={styles.handleArea} importantForAccessibility="no">
              <View style={[styles.handleBar, { backgroundColor: theme.border }, handleStyle]} />
            </View>
          </GestureDetector>
        )}
        <View style={styles.content}>{children}</View>
      </Animated.View>

      {showCloseButton && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.floatingClose, { bottom: insets.bottom + Spacing.three }]}>
          <View
            style={[
              styles.floatingCloseSurface,
              { backgroundColor: theme.backgroundElement, shadowColor: theme.border },
            ]}>
            <IconButton
              symbol="xmark"
              size="md"
              variant="filled"
              onPress={requestClose}
              accessibilityLabel={closeButtonLabel}
            />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropPress: {
    flex: 1,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  handleArea: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 48,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: BorderRadius.full,
  },
  content: {
    flex: 1,
    minHeight: 0,
    gap: Spacing.two,
  },
  floatingClose: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  floatingCloseSurface: {
    borderRadius: BorderRadius.full,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
});
