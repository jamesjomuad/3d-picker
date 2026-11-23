import { useCallback, useState } from 'react';

import { FUN_PICK_DIRECTIONS, generateCombinations } from './fun-pick-utils';

/**
 * Fun Pick generation hook
 *
 * Owns the ephemeral state the Fun Pick card needs: the chosen direction
 * rule and the last generated batch. It reads the board through props —
 * the same `grid` + `selection` pair the board and the summary card take —
 * so the feature stays reusable outside the Picker screen and never touches
 * a store. `generate` is rebuilt whenever the data or the rule changes, so
 * a press always reflects the latest selection.
 *
 * @param {Object} props
 * @param {number[][]} props.grid - the board's digits, read row-major
 * @param {Set<string>} props.selection - selected "row,col" keys
 * @returns {{
 *   combinations: Array<{ digits: string, path: Array<Object>, start: Object, end: Object }>,
 *   generate: () => void,
 *   clear: () => void,
 *   direction: string,
 *   setDirection: (direction: string) => void,
 * }}
 */
export function useFunPick({ grid, selection }) {
  const [direction, setDirection] = useState(FUN_PICK_DIRECTIONS.all);
  const [combinations, setCombinations] = useState([]);

  const generate = useCallback(() => {
    setCombinations(generateCombinations(grid, selection, { direction }));
  }, [grid, selection, direction]);

  const clear = useCallback(() => {
    setCombinations([]);
  }, []);

  return { combinations, generate, clear, direction, setDirection };
}
