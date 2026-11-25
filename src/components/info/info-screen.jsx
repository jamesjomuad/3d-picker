import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { BorderRadius, MaxContentWidth, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shared reading surface for in-app informational screens.
 *
 * Uses the native stack header for back navigation, so it adds no tab-bar
 * padding of its own. Content is grouped into bordered cards that match the
 * Settings panels.
 *
 * @param {Object} props
 * @param {string} props.title - Page heading
 * @param {string} [props.intro] - Short lead paragraph
 * @param {Array<{ title: string, items: Array<string | { text: string, detail?: string, icon?: string }> }>} props.sections
 * @param {React.ReactNode} [props.footer] - Links or notes below the cards
 */
export function InfoScreen({ title, intro, sections = [], footer }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + Spacing.four },
      ]}>
      <View style={[styles.inner, { width: MaxContentWidth }]}>
        <ThemedText type="subtitle">{title}</ThemedText>
        {intro ? (
          <ThemedText themeColor="textSecondary" style={styles.intro}>
            {intro}
          </ThemedText>
        ) : null}

        {sections.map((section) => (
          <View
            key={section.title}
            style={[
              styles.card,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}>
            <ThemedText type="smallBold">{section.title}</ThemedText>
            {section.items.map((item, index) => {
              const normalized = typeof item === 'string' ? { text: item } : item;
              return (
                <View key={`${section.title}-${index}`} style={styles.item}>
                  <AppIcon name={normalized.icon ?? 'checkmark.circle'} size="small" tone="textSecondary" />
                  <View style={styles.itemCopy}>
                    <ThemedText>{normalized.text}</ThemedText>
                    {normalized.detail ? (
                      <ThemedText themeColor="textSecondary" style={styles.detail}>
                        {normalized.detail}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </ScrollView>
  );
}

/**
 * External link styled like an in-app text link.
 * @param {{ href: string, children: React.ReactNode }} props
 */
export function InfoLink({ href, children }) {
  return (
    <ThemedText
      type="linkPrimary"
      accessibilityRole="link"
      onPress={() => Linking.openURL(href)}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    flexGrow: 1,
  },
  inner: {
    flexShrink: 1,
    gap: Spacing.three,
    maxWidth: '100%',
  },
  intro: {
    fontSize: Typography.size.bodyLarge,
    lineHeight: Typography.lineHeight.bodyLarge,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  itemCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  detail: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
  },
  footer: {
    gap: Spacing.two,
  },
});
