import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ANIMATION_DURATION_MS = 220;

const toggleAnimation = {
  duration: ANIMATION_DURATION_MS,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
};

/**
 * Foldable card container
 *
 * A Card-styled surface whose title area toggles the content open and shut.
 * Trailing actions stay outside the toggle, so the web tree never nests a
 * button inside another button. The fold is driven by LayoutAnimation around
 * a mount/unmount of the content — the New Architecture runs it on the UI
 * thread on both platforms, so no measurement or shared values are involved.
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

  const handleToggle = () => {
    LayoutAnimation.configureNext(toggleAnimation);
    setExpanded((value) => !value);
  };

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: theme.border }, style]}>
      <View style={[styles.header, expanded && { borderBottomColor: theme.border }]}>
        <Pressable
          onPress={handleToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={typeof title === 'string' ? title : undefined}
          style={({ pressed }) => [styles.headerToggle, pressed && styles.pressed]}>
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
        </Pressable>
        {trailing ? trailing : null}
        <View
          pointerEvents="none"
          style={{ transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={14}
            weight="bold"
            tintColor={theme.text}
          />
        </View>
      </View>

      {expanded && (
        <View style={styles.content}>
          {children}
        </View>
      )}
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
  headerToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.half,
  },
  subtitle: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
  },
  content: {
    padding: Spacing.three,
  },
});
