import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
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

import { AppIcon } from '@/components/ui/app-icon';
import {
  BorderRadius,
  BottomTabInset,
  Interaction,
  Spacing,
  TouchTarget,
  Typography,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const BACKDROP_OPACITY = 0.3;
const DISMISS_DURATION_MS = 180;
const SHEET_SPRING = { damping: 24, stiffness: 240, mass: 0.9 };
const DRAG_ACTIVATION = 10;
const DRAG_SLOP = 16;
const DRAG_DISMISS_THRESHOLD = 64;
const DRAG_LIMIT = 128;
const HANDLE_AREA_HEIGHT = 24;
const MAX_SHEET_HEIGHT_RATIO = 0.45;
const SCROLLABLE_ACTION_COUNT = 3;
const FULL_SCREEN = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Compact sheet for actions on a current context, such as a selection.
 *
 * Presentation is independent of the snap-point `BottomSheet`. Height comes
 * from the header, action rows, and Cancel row. `maxHeight` is only a safeguard;
 * long lists scroll inside the action area while header and Cancel stay fixed.
 * Callers own the state those actions change; no data or domain logic belongs
 * here.
 *
 * @typedef {Object} ContextualAction
 * @property {string} id - Stable key for the action
 * @property {string} label - Visible and spoken label
 * @property {string} [icon] - Key from the app symbol map
 * @property {() => void} onPress - Action handler
 * @property {boolean} [destructive=false] - Uses destructive styling
 * @property {boolean} [disabled=false] - Shows a disabled action
 */

/**
 * @param {Object} props
 * @param {boolean} props.visible - Whether the sheet is shown
 * @param {string} [props.title] - Heading, ideally the live context count
 * @param {ContextualAction[]} [props.actions=[]] - Ordered actions
 * @param {() => void} [props.onCancel] - Backdrop, Back, swipe or Cancel intent
 * @param {() => void} [props.onDismiss] - Called after any dismiss animation
 * @param {number} [props.bottomInset] - Override the computed navigation offset
 */
export const ContextualActionSheet = forwardRef(function ContextualActionSheet(
  {
    visible,
    title,
    actions = [],
    onCancel,
    onDismiss,
    bottomInset,
  },
  ref
) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const dismissedRef = useRef(false);
  const dismissCallbackRef = useRef(null);
  const translateY = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  const hasActions = actions.length > 0;
  const resolvedBottomInset = bottomInset ?? insets.bottom + BottomTabInset + Spacing.one;

  const finishDismiss = useCallback(
    (source) => {
      if (source === 'back' || source === 'backdrop' || source === 'gesture') {
        onCancel?.();
      }
      onDismiss?.();
      dismissCallbackRef.current?.();
      dismissCallbackRef.current = null;
    },
    [onCancel, onDismiss]
  );

  const requestClose = useCallback(
    (callback = null, source = 'imperative') => {
      if (dismissedRef.current) return;
      dismissedRef.current = true;
      dismissCallbackRef.current = callback;
      translateY.set(
        withTiming(windowHeight, { duration: DISMISS_DURATION_MS }, () => {
          runOnJS(finishDismiss)(source);
        })
      );
    },
    [finishDismiss, translateY, windowHeight]
  );

  useImperativeHandle(
    ref,
    () => ({
      dismiss: (callback = null) => requestClose(callback, 'imperative'),
    }),
    [requestClose]
  );

  useEffect(() => {
    if (!visible) return;
    dismissedRef.current = false;
    dismissCallbackRef.current = null;
    translateY.set(0);
  }, [translateY, visible]);

  const panGesture = usePanGesture({
    activeOffsetY: [-DRAG_ACTIVATION, DRAG_ACTIVATION],
    failOffsetX: [-DRAG_SLOP, DRAG_SLOP],
    shouldCancelWhenOutside: false,
    onActivate: () => {
      'worklet';
      dragStartY.set(translateY.get());
    },
    onUpdate: (event) => {
      'worklet';
      const nextY = dragStartY.get() + event.translationY;
      translateY.set(Math.min(DRAG_LIMIT, Math.max(0, nextY)));
    },
    onDeactivate: (event) => {
      'worklet';
      if (event.canceled || event.translationY <= DRAG_DISMISS_THRESHOLD) {
        translateY.set(withSpring(0, SHEET_SPRING));
        return;
      }
      runOnJS(requestClose)(null, 'gesture');
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.get(),
      [0, windowHeight * 0.5],
      [BACKDROP_OPACITY, 0],
      Extrapolation.CLAMP
    ),
  }));

  const handleCancelPress = useCallback(() => {
    requestClose(() => onCancel?.(), 'cancel');
  }, [onCancel, requestClose]);

  if (!visible || !hasActions) return null;

  const actionRows = actions.map((action) => {
    const destructive = action.destructive === true;
    const disabled = action.disabled === true;
    const backgroundColor = destructive ? theme.destructive : theme.backgroundElement;
    const foregroundColor = destructive ? theme.primaryText : theme.text;

    return (
      <Pressable
        key={action.id}
        onPress={disabled ? undefined : action.onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={action.label}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          styles.action,
          { backgroundColor },
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ]}>
        {action.icon ? (
          <AppIcon
            name={action.icon}
            size="small"
            tone={destructive ? 'primaryText' : 'text'}
          />
        ) : null}
        <Text style={[styles.actionText, { color: foregroundColor }]}>{action.label}</Text>
      </Pressable>
    );
  });

  const actionArea =
    actions.length > SCROLLABLE_ACTION_COUNT ? (
      <ScrollView
        style={styles.actionList}
        contentContainerStyle={styles.actionListContent}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        {actionRows}
      </ScrollView>
    ) : (
      <View style={[styles.actionList, styles.actionListContent]}>{actionRows}</View>
    );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => requestClose(null, 'back')}>
      <View testID="contextual-action-sheet-root" style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={styles.backdropPress}
            onPress={() => requestClose(null, 'backdrop')}
            accessibilityLabel="Dismiss actions"
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.container,
            {
              marginBottom: resolvedBottomInset,
              maxHeight: Math.round(windowHeight * MAX_SHEET_HEIGHT_RATIO),
              backgroundColor: theme.background,
              borderTopColor: theme.border,
              paddingLeft: insets.left + Spacing.three,
              paddingRight: insets.right + Spacing.three,
            },
            sheetStyle,
          ]}>
          <GestureDetector gesture={panGesture}>
            <View style={styles.handleArea} importantForAccessibility="no">
              <View style={[styles.handleBar, { backgroundColor: theme.border }]} />
            </View>
          </GestureDetector>

          <View style={styles.content}>
            {title ? (
              <View style={styles.titleBlock}>
                <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
              </View>
            ) : null}

            {actionArea}

            <Pressable
              onPress={handleCancelPress}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => [
                styles.cancel,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.cancelText, { color: theme.text }]}>Cancel</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...FULL_SCREEN,
  },
  backdropPress: {
    flex: 1,
  },
  container: {
    alignSelf: 'stretch',
    flexShrink: 1,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  handleArea: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: HANDLE_AREA_HEIGHT,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.half,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: BorderRadius.full,
  },
  content: {
    flexShrink: 1,
    minHeight: 0,
    gap: Spacing.one,
  },
  titleBlock: {
    paddingHorizontal: Spacing.one,
  },
  title: {
    fontSize: Typography.size.subtitle,
    lineHeight: Typography.lineHeight.subtitle,
    fontWeight: Typography.weight.semibold,
    textAlign: 'center',
  },
  actionList: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
  },
  actionListContent: {
    flexGrow: 0,
    gap: Spacing.one,
  },
  action: {
    minHeight: TouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.md,
  },
  actionText: {
    flexShrink: 1,
    fontSize: Typography.size.bodyLarge,
    lineHeight: Typography.lineHeight.bodyLarge,
    fontWeight: Typography.weight.semibold,
    textAlign: 'center',
  },
  cancel: {
    minHeight: TouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.one,
  },
  cancelText: {
    fontSize: Typography.size.bodyLarge,
    lineHeight: Typography.lineHeight.bodyLarge,
    fontWeight: Typography.weight.semibold,
  },
  pressed: {
    opacity: Interaction.pressedOpacity,
  },
  disabled: {
    opacity: Interaction.disabledOpacity,
  },
});
