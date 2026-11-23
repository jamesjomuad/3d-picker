import { Alert, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Collapsible } from '@/components/ui/collapsible';
import { Spacing } from '@/constants/theme';
import { useBasketStore } from '@/store/basketStore';
import { getPathReference } from '@/utils/cell-reference';

/**
 * Selection Basket section of the Fun Pick card.
 *
 * An expandable list of the picks collected from the results, each with
 * its digits leading and its board reference secondary, plus Share and
 * Clear actions. Reads and writes only the basket store, so its contents
 * are independent of the generated batch, the search field and the active
 * filter: generating again, searching or leaving the screen changes
 * nothing here.
 *
 * Sharing uses React Native's built-in `Share` API, which opens the native
 * Android share sheet — Messenger and any other text-capable app receive
 * the same plain-text list. Sharing never clears the basket.
 */
export function BasketSection() {
  const entries = useBasketStore((state) => state.entries);
  const remove = useBasketStore((state) => state.remove);
  const clear = useBasketStore((state) => state.clear);

  const handleClear = () => {
    Alert.alert('Clear Basket', `Remove all ${entries.length} picks from the basket?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clear },
    ]);
  };

  const handleShare = async () => {
    if (entries.length === 0) return;

    try {
      await Share.share({
        title: '3D Picker – Selection Basket',
        message: buildShareText(entries),
      });
    } catch (error) {
      // The Android sheet can reject when dismissed; the basket is intact
      // either way, so there is nothing to recover from.
      console.warn('Share dismissed or failed:', error);
    }
  };

  return (
    <Collapsible title="🧺 Selection Basket" count={entries.length}>
      {entries.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
          No picks yet. Add combinations from the results list and they collect here —
          they stay in the basket even when you generate again.
        </ThemedText>
      ) : (
        <>
          <View style={styles.list}>
            {entries.map((entry, index) => (
              <View key={entry.digits} style={styles.row}>
                <View style={styles.rowText}>
                  <ThemedText type="smallBold" style={styles.digits}>
                    {index + 1}. {entry.digits}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.pathText}>
                    {getPathReference(entry.path)}
                  </ThemedText>
                </View>
                <Button size="sm" variant="outline" onPress={() => remove(entry.digits)}>
                  Remove
                </Button>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <Button size="sm" onPress={handleShare}>
              Share Basket
            </Button>
            <Button size="sm" variant="outline" onPress={handleClear}>
              Clear Basket
            </Button>
          </View>
        </>
      )}
    </Collapsible>
  );
}

/**
 * The numbered plain-text list sent through the share sheet: app name,
 * total, one line per pick with its board reference, closing credit.
 *
 * @param {Array<{ digits: string, path: Array }>} entries - basket entries
 * @returns {string}
 */
function buildShareText(entries) {
  const lines = entries.map(
    (entry, index) => `${index + 1}. ${entry.digits} (${getPathReference(entry.path)})`
  );

  return [
    '3D Picker – Selection Basket',
    '',
    `Total Picks: ${entries.length}`,
    '',
    ...lines,
    '',
    'Generated using 3D Picker.',
  ].join('\n');
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  digits: {
    fontSize: 16,
    lineHeight: 21,
    fontVariant: ['tabular-nums'],
  },
  pathText: {
    fontSize: 12,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
  },
});
