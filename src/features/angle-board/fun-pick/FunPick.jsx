import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FoldableCard } from '@/components/ui/foldable-card';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getPathReference } from '@/utils/cell-reference';

import { FUN_PICK_DIRECTION_OPTIONS } from './fun-pick-utils';
import { useFunPick } from './useFunPick';

const COPY_FEEDBACK_MS = 1600;

/**
 * Fun Pick card
 *
 * Generates random angle-walk combinations from the current Angle Board
 * selection: each step turns exactly 90 degrees from the previous one.
 * Takes the same `grid` + `selection` pair the board and the
 * summary card take, so it can be mounted beside any board. Presentation
 * only: the batch and direction rule live in `useFunPick`, the walk itself
 * in `fun-pick-utils`. The Copy button puts the generated digits on the
 * clipboard, one combination per line.
 *
 * @param {Object} props
 * @param {number[][]} props.grid - the board's digits, read row-major
 * @param {Set<string>} props.selection - selected "row,col" keys
 * @param {Object} [props.style] - Additional card styles
 */
export function FunPick({ grid, selection, style }) {
  const theme = useTheme();
  const { combinations, generate, clear, direction, setDirection } = useFunPick({ grid, selection });

  const [showRules, setShowRules] = useState(false);
  // Distinguishes "nothing generated yet" from "generated, but the
  // selection cannot produce any combination".
  const [hasGenerated, setHasGenerated] = useState(false);
  const [copyStatus, setCopyStatus] = useState('idle');
  const resetTimer = useRef(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    []
  );

  const handleCopy = useCallback(async () => {
    if (combinations.length === 0) return;

    try {
      await Clipboard.setStringAsync(combinations.map((combination) => combination.digits).join('\n'));
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }

    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyStatus('idle'), COPY_FEEDBACK_MS);
  }, [combinations]);

  const copyLabel = copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy';

  const handleGenerate = () => {
    generate();
    setHasGenerated(true);
  };

  const handleClear = () => {
    clear();
    setHasGenerated(false);
  };

  const directionLabel =
    FUN_PICK_DIRECTION_OPTIONS.find((option) => option.value === direction)?.label ?? 'All directions';

  return (
    <FoldableCard style={style} title="Fun Pick" subtitle={directionLabel} defaultExpanded={false}>
      <View style={styles.body}>
        <View style={styles.actions}>
          <Button size="sm" onPress={handleGenerate}>
            Generate
          </Button>
          <Button
            size="sm"
            variant={showRules ? 'secondary' : 'outline'}
            onPress={() => setShowRules((value) => !value)}>
            Generation Rules
          </Button>
        </View>

        {showRules && (
          <View style={styles.rules}>
            {FUN_PICK_DIRECTION_OPTIONS.map((option) => {
              const selected = option.value === direction;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setDirection(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.rulePill,
                    {
                      backgroundColor: selected ? theme.primary : theme.backgroundElement,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}>
                  <ThemedText type="small" themeColor={selected ? 'primaryText' : 'textSecondary'}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}

        {combinations.length > 0 ? (
          <>
            <View style={styles.results}>
              {combinations.map((combination) => (
                <View key={combination.path.map((cell) => `${cell.row},${cell.column}`).join(';')}>
                  <ThemedText type="smallBold">{combination.digits}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.pathText}>
                    {getPathReference(combination.path)}
                  </ThemedText>
                </View>
              ))}
            </View>

            <View style={styles.actions}>
              <Button size="sm" onPress={handleGenerate}>
                Generate Again
              </Button>
              <Button size="sm" variant="outline" onPress={handleCopy}>
                {copyLabel}
              </Button>
              <Button size="sm" variant="outline" onPress={handleClear}>
                Clear
              </Button>
            </View>
          </>
        ) : (
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            {hasGenerated
              ? 'The current selection cannot form a combination under these rules. Select more cells that form an L or V angle, or change the direction rules.'
              : 'Select cells on the board, then generate random angle walks through them.'}
          </ThemedText>
        )}
      </View>
    </FoldableCard>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rules: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  rulePill: {
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  results: {
    gap: Spacing.two,
  },
  pathText: {
    fontSize: 12,
    lineHeight: 16,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
