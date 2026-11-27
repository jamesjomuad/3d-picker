import { useEffect, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const VISIBLE_DURATION_MS = 2200;
const FADE_DURATION_MS = 160;

/**
 * Short-lived, non-blocking status message near the bottom safe area.
 *
 * The screen owns visibility; this component only animates the message it is
 * given and calls onHide when the timer ends. It never captures touches, so
 * the board list stays usable while the toast is on screen.
 */
export function Toast({ message, onHide }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = useMemo(() => new Animated.Value(0), []);
  const translateY = useMemo(() => new Animated.Value(12), []);

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(12);

    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: FADE_DURATION_MS,
        useNativeDriver: true,
      }),
    ]);
    animation.start();

    const timer = setTimeout(onHide, VISIBLE_DURATION_MS);
    return () => {
      animation.stop();
      clearTimeout(timer);
    };
  }, [message, onHide, opacity, translateY]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          bottom: insets.bottom + Spacing.four,
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          opacity,
          transform: [{ translateY }],
        },
      ]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.primary }]}>
        <AppIcon name="checkmark" size="small" tone="primaryText" />
      </View>
      <ThemedText style={[styles.message, { color: theme.text }]}>{message}</ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '88%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  message: {
    flexShrink: 1,
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
    fontWeight: Typography.weight.medium,
  },
});
