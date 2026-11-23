import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ANIMATION_DURATION_MS = 220;

/**
 * Foldable card container
 *
 * A Card-styled surface whose whole header toggles a smooth expand/collapse
 * of the content. Same header/body conventions as `Card` (backgroundElement
 * fill, hairline border, spacing tokens).
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Collapsible card content
 * @param {string} [props.title] - Header title
 * @param {string} [props.subtitle] - Optional header subtitle
 * @param {React.ReactNode} [props.icon] - Optional leading icon element
 * @param {React.ReactNode} [props.trailing] - Optional trailing content (before the chevron)
 * @param {boolean} [props.defaultExpanded=true] - Initial expanded state
 * @param {Object} [props.style] - Additional card styles
 */
export function FoldableCard({
  title,
  subtitle,
  icon,
  trailing,
  children,
  defaultExpanded = true,
  style,
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [contentHeight, setContentHeight] = useState(0);

  const progress = useSharedValue(defaultExpanded ? 1 : 0);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    progress.value = withTiming(next ? 1 : 0, { duration: ANIMATION_DURATION_MS });
  };

  const contentStyle = useAnimatedStyle(() => {
    // Fully expanded: fall back to natural layout so measured height never lags.
    if (progress.value >= 1) return { height: undefined, opacity: 1 };
    return { height: contentHeight * progress.value, opacity: progress.value };
  });

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${90 - 180 * progress.value}deg` }],
  }));

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: theme.border }, style]}>
      <Pressable
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={typeof title === 'string' ? title : undefined}
        style={({ pressed }) => [
          styles.header,
          expanded && { borderBottomColor: theme.border },
          pressed && styles.pressed,
        ]}>
        {icon ? icon : null}
        <View style={styles.titleBlock}>
          {title ? (
            <ThemedText type="smallBold" numberOfLines={1}>
              {title}
            </ThemedText>
          ) : null}
          {subtitle ? (
            <ThemedText themeColor="textSecondary" style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {trailing ? trailing : null}
        <Animated.View style={chevronStyle}>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={14}
            weight="bold"
            tintColor={theme.text}
          />
        </Animated.View>
      </Pressable>

      <Animated.View style={contentStyle}>
        <View style={styles.content} onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
          {children}
        </View>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  pressed: {
    opacity: 0.7,
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.half,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  content: {
    padding: Spacing.three,
  },
});
