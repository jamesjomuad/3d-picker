import { useCallback, useState } from 'react';

import { FUN_PICK_DIRECTIONS, FUN_PICK_LENGTH, generateCombinations } from './fun-pick-utils';

/**
 * Fun Pick generation hook
 *
 * Owns the last generated batch. Generation always walks all eight step
 * families; Direction filter chips narrow the visible results. Combinations
 * are always 3D. The board comes through props — the same `grid` + `selection`
 * pair the board and the summary card take — so the feature stays reusable
 * outside the Picker screen and never touches a store. `generate` is rebuilt
 * whenever the data changes, so a press always reflects the latest selection.
 *
 * @param {Object} props
 * @param {number[][]} props.grid - the board's digits, read row-major
 * @param {Set<string>} props.selection - selected "row,col" keys
 * @returns {{
 *   combinations: Array<{ digits: string, path: Array<Object>, start: Object, end: Object }>,
 *   generate: () => void,
 *   clear: () => void,
 * }}
 */
export function useFunPick({ grid, selection }) {
  const [combinations, setCombinations] = useState([]);

  const generate = useCallback(() => {
    setCombinations(
      generateCombinations(grid, selection, {
        direction: FUN_PICK_DIRECTIONS.all,
        length: FUN_PICK_LENGTH,
      })
    );
  }, [grid, selection]);

  const clear = useCallback(() => {
    setCombinations([]);
  }, []);

  return { combinations, generate, clear };
}
