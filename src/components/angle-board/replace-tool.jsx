import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DigitSelector } from '@/components/ui/digit-selector';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getMatchingCells } from '@/utils/board-replace';

/**
 * Replace tool panel for the Edit Board sheet.
 *
 * Matching always reads the grid it is handed, and the sheet hands it the
 * snapshot captured when the editing session began — never the working board.
 * A digit written by an earlier replacement therefore cannot become a source
 * for the next one: replace 1 with 5, then 5 with 8, and the cell that started
 * as 1 keeps its 5.
 *
 * The matches are reported to the owner through `onMatchesChange` so the board
 * can tint those exact cells while the replacement is being configured.
 *
 * @param {Object} props
 * @param {number[][]} props.grid - original board snapshot for this editing session
 * @param {(result: { count: number, changes: Object<string, number> }) => void}
 *   props.onReplaceAll - called with the changes to apply when the user confirms
 * @param {() => void} props.onClose - called to collapse the panel
 * @param {(matches: Set<string>) => void} [props.onMatchesChange] - matching
 *   "row,col" keys of the find digit, for the board's highlight layer
 */
export function ReplaceTool({ grid, onReplaceAll, onClose, onMatchesChange }) {
  const theme = useTheme();

  const [findDigit, setFindDigit] = useState(null);
  const [replaceDigit, setReplaceDigit] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);

  // Matches depend on the find digit alone, so they are visible (and counted)
  // before a replacement digit is chosen.
  const matches = useMemo(() => getMatchingCells(grid, findDigit), [grid, findDigit]);
  const count = matches.length;
  const sameDigit = findDigit !== null && replaceDigit !== null && findDigit === replaceDigit;
  const canReplace = findDigit !== null && replaceDigit !== null && !sameDigit && count > 0;

  useEffect(() => {
    onMatchesChange?.(new Set(matches));
  }, [matches, onMatchesChange]);

  const handleReplaceAll = () => {
    if (!canReplace) return;
    setConfirmVisible(true);
  };

  const handleConfirm = () => {
    setConfirmVisible(false);
    const changes = {};
    for (const key of matches) changes[key] = replaceDigit;
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

      <View style={[styles.separator, { backgroundColor: theme.border }]} />

      <DigitSelector
        label="Replace with"
        value={replaceDigit}
        onSelect={setReplaceDigit}
      />

      <View style={styles.statusRow}>
        {findDigit === null ? (
          <Text style={[styles.status, { color: theme.textSecondary }]}>
            Select a digit to highlight its cells
          </Text>
        ) : count === 0 ? (
          <Text style={[styles.status, { color: theme.textSecondary }]}>
            No cells contain {findDigit}
          </Text>
        ) : replaceDigit === null ? (
          <Text style={[styles.status, { color: theme.text }]}>
            {count} matching cell{count === 1 ? '' : 's'} contain {findDigit}
          </Text>
        ) : sameDigit ? (
          <Text style={[styles.status, { color: theme.textSecondary }]}>
            Both digits are the same — no changes needed
          </Text>
        ) : (
          <>
            <Text style={[styles.status, { color: theme.text }]}>
              Replace {findDigit} → {replaceDigit}
            </Text>
            <Text style={[styles.statusDetail, { color: theme.textSecondary }]}>
              {count} matching cell{count === 1 ? '' : 's'}
            </Text>
          </>
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
          `Replace the ${count} cell${count === 1 ? '' : 's'} that originally held ` +
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
  statusDetail: {
    fontSize: 13,
    lineHeight: 18,
  },
});
