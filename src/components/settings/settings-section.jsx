import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Grouped settings panel
 *
 * The PanelUI-style grouped surface the Settings page is built from: an
 * uppercase section caption above one bordered panel that holds SettingsRow
 * children and draws hairline separators between them, so rows never
 * repeat their own borders. `notes` renders below the panel inside the
 * same section — that is where ComingSoonCards live, keeping the panel
 * itself reserved for interactive rows and avoiding card-inside-card
 * nesting.
 *
 * @param {Object} props
 * @param {string} props.title - Section caption (e.g. "Appearance")
 * @param {React.ReactNode} [props.children] - SettingsRow elements
 * @param {React.ReactNode} [props.notes] - Content below the panel (foldable cards)
 * @param {string} [props.footer] - Small explanatory line under the group
 */
export function SettingsSection({ title, children, notes, footer }) {
  const theme = useTheme();
  const rows = [children].flat().filter((child) => child != null && child !== false);

  return (
    <View style={styles.section}>
      <ThemedText themeColor="textSecondary" style={styles.caption}>
        {title.toUpperCase()}
      </ThemedText>
      {rows.length > 0 && (
        <View
          style={[
            styles.panel,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          {rows.map((child, index) => (
            <Fragment key={child.key ?? index}>
              {index > 0 && (
                <View style={[styles.separator, { backgroundColor: theme.border }]} />
              )}
              {child}
            </Fragment>
          ))}
        </View>
      )}
      {notes ? <View style={styles.notes}>{notes}</View> : null}
      {footer ? (
        <ThemedText themeColor="textSecondary" style={styles.footer}>
          {footer}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    gap: Spacing.two,
  },
  caption: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginLeft: Spacing.one,
  },
  panel: {
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 46,
  },
  notes: {
    gap: Spacing.two,
  },
  footer: {
    fontSize: 12,
    lineHeight: 17,
    marginLeft: Spacing.one,
  },
});
