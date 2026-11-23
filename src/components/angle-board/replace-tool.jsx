import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DigitSelector } from '@/components/ui/digit-selector';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { computeReplace } from '@/utils/board-replace';

/**
 * Replace tool panel for the Edit Board sheet.
 *
 * Lets the user pick a find digit and a replacement digit, see how many
 * cells match, and execute a Replace All with a confirmation step.
 *
 * @param {Object} props
 * @param {number[][]} props.grid - current board grid
 * @param {() => void} props.onReplaceAll - called with `{ count, changes }` when
 *   the user confirms the replacement
 * @param {() => void} props.onClose - called to collapse the panel
 */
export function ReplaceTool({ grid, onReplaceAll, onClose }) {
  const theme = useTheme();

  const [findDigit, setFindDigit] = useState(null);
  const [replaceDigit, setReplaceDigit] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const { count, changes, sameDigit, noMatches } = useMemo(() => {
    if (findDigit === null || replaceDigit === null) {
      return { count: 0, changes: {}, sameDigit: false, noMatches: false };
    }

    const result = computeReplace(grid, findDigit, replaceDigit);
    return {
      ...result,
      sameDigit: findDigit === replaceDigit,
      noMatches: result.count === 0,
    };
  }, [grid, findDigit, replaceDigit]);

  const canReplace = findDigit !== null && replaceDigit !== null && !sameDigit && !noMatches;

  const handleReplaceAll = () => {
    if (!canReplace) return;
    setConfirmVisible(true);
  };

  const handleConfirm = () => {
    setConfirmVisible(false);
    onReplaceAll({ count, changes });
    onClose();
  };

  const handleCancel = () => {
    setConfirmVisible(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Replace</Text>
        <Button variant="ghost" size="sm" onPress={onClose}>
          Close
        </Button>
      </View>

      <DigitSelector
        label="Find digit"
        value={findDigit}
        onSelect={setFindDigit}
      />

      <View style={styles.separator} />

      <DigitSelector
        label="Replace with"
        value={replaceDigit}
        onSelect={setReplaceDigit}
      />

      <View style={styles.statusRow}>
        {findDigit === null || replaceDigit === null ? (
          <Text style={[styles.status, { color: theme.textSecondary }]}>
            Select both digits to see matches
          </Text>
        ) : sameDigit ? (
          <Text style={[styles.status, { color: theme.textSecondary }]}>
            Both digits are the same — no changes needed
          </Text>
        ) : noMatches ? (
          <Text style={[styles.status, { color: theme.textSecondary }]}>
            No cells contain {findDigit}
          </Text>
        ) : (
          <Text style={[styles.status, { color: theme.text }]}>
            {count} cell{count !== 1 ? 's' : ''} contain{count === 1 ? 's' : ''} {findDigit}
          </Text>
        )}
      </View>

      <Button
        variant="primary"
        onPress={handleReplaceAll}
        disabled={!canReplace}>
        Replace All
      </Button>

      <ConfirmDialog
        visible={confirmVisible}
        title="Confirm Replace"
        message={
          `Replace all ${count} occurrence${count !== 1 ? 's' : ''} of ` +
          `${findDigit} with ${replaceDigit}?`
        }
        confirmLabel="Replace"
        cancelLabel="Cancel"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  statusRow: {
    minHeight: 20,
    justifyContent: 'center',
  },
  status: {
    fontSize: 14,
    lineHeight: 20,
  },
});
