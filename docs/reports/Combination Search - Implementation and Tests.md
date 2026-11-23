# Combination Search — Implementation and Tests

**Status:** Feature complete and verified by lint and unit tests. **Not verified on an Android device** — the development machine has no Android SDK, `adb` or emulator.

**Date:** 2026-11-23

Spec: `docs/todo/Feature - Combination Search — Angle Board.md` (now a completed checklist).

---

## 1. The algorithm

Depth-first search over the board, in `src/utils/combination-search.js` — pure JS, no React, no Zustand, grid and combination in, results out.

1. Scan the grid row-major for every cell holding the first digit.
2. From each start, walk the eight neighbour directions in a fixed order (NW, N, NE, W, E, SW, S, SE), following only cells that hold the next digit.
3. A `Set` of visited `"row,col"` keys forbids reusing a cell within one path.
4. Reaching the last digit records the path; the walk then backtracks and keeps going, so every path is returned, not just the first.

Each result is exactly the shape the spec asked for:

```js
{ digits: '123', path: [{ row: 0, column: 0 }, ...], start: { row, column }, end: { row, column } }
```

Search state is capped (`MAX_RESULTS = 500`, configurable per call). Path counts on a 10×10 board grow exponentially with the number of digits, so the cap stops a pathological query instead of freezing the UI. The fixed direction order makes the result order deterministic — which matters later, because per-path colours can then be assigned by index and stay stable.

Input handling: `parseCombination` accepts a digit string or an array of digits and returns `null` for anything else (empty, letters, non-integers, digits outside 0–9, wrong types), and the search returns `[]` on a `null` parse. Zero is a normal digit.

## 2. UI changes

All on the Picker screen (`src/app/index.jsx`), which owns the search state locally — nothing was added to any store:

- **`src/components/search/combination-search-bar.jsx`** — above the board: label, digit-only `TextInput` (`number-pad`, search return key, 44 dp tall), an absolutely positioned × clear button, and an inline "Digits only (0-9)" error. Submits on keyboard search.
- **`src/components/search/combination-search-results.jsx`** — a card below the board, shown only for a non-empty valid query: `Combination: 123`, `Matches: N`, then one tappable row per path (`1. A1 → B2 → C3`, monospace), the active row boxed and bold. Empty state: "No matches found." Lists the first 100 paths with a "+N more paths" note; all of them still light up on the board.
- **`src/hooks/use-debounced-value.js`** — 300 ms debounce, so typing doesn't re-run the search per keystroke; submitting bypasses the wait.

Search updates on pause **or** submit, per spec. Clearing the field clears the query, the results and the highlights together. The board is a sibling that never remounts, and `highlights` is `undefined` when there are no results, so an idle Picker pays nothing.

Navigation between paths is tap-to-emphasise: tapping a result row makes that path the active one, filling its cells solid on the board. Prev/next arrows were not added — the result list is the navigator already.

## 3. Highlighting

Added to the `AngleBoard` component as one presentation-only prop:

```jsx
highlights={{ cells: Set<"row,col">, active: Set<"row,col"> }}
```

- `angle-board.jsx` passes the two Sets to the grid; selection keeps its own path entirely, so **search never writes to, reads from, or overwrites the selection** — the spec's hardest constraint.
- `angle-board-cell.jsx` precedence: **selected wins**, then `active` (solid `primary` background, `primaryText` digit), then `match` (`primary` at 30% alpha). Overlapping paths share cells in one flat Set, so a cell in five paths simply matches; emphasis comes from picking a path, not from counting them.
- Header row/column marks still reflect selection only, unchanged.
- Gesture handling was not touched: rows stay `pointerEvents="none"`, the PanResponder stays as it is, and selection highlighting keeps its drag/commit behaviour.

Per-path unique colours are deliberately **not** here — that's `docs/todo/Unique Search Result Colors.md`, a separate feature; the active/match split leaves room for it.

## 4. Files changed

**Created:** `src/utils/combination-search.js`, `src/utils/__tests__/combination-search.test.js`, `src/hooks/use-debounced-value.js`, `src/components/search/combination-search-bar.jsx`, `src/components/search/combination-search-results.jsx`, this report.

**Modified:** `src/app/index.jsx` (search state + two components + `highlights`), `src/components/angle-board/angle-board.jsx` (`highlights` prop), `src/components/angle-board/angle-board-grid.jsx` (`highlightCells`/`highlightActive` + `cellHighlight` helper), `src/components/angle-board/angle-board-cell.jsx` (`highlight` state), `src/utils/cell-reference.js` (`getPathReference`) and its test, `docs/todo/Feature - Combination Search — Angle Board.md` (checklist), `AGENTS.md` (search component family listed).

The spec's suggested `src/features/angle-board/search/` location was adapted to `src/utils/` — this project keeps shared pure logic there, and AGENTS.md has no `features/` layer.

## 5. Tests

`src/utils/__tests__/combination-search.test.js` hand-counts paths on 2×2 and 3×3 grids, covering every item in spec §8: horizontal, vertical, both descending diagonals plus the reverse runs (all four diagonal directions), reverse-order digits, multiple starts, overlapping paths kept separate, repeated digits (12 directed `1-1` pairs and 24 `1-1-1-1` traversals on an all-ones 2×2), zero digits, no matches, boundaries (no walking off the board, no jumping over a cell), no cell reuse (a five-digit combination on a four-cell board returns nothing), invalid input in both forms, the result shape (`digits`/`path`/`start`/`end`), and the limit. Plus four `getPathReference` cases appended to `cell-reference.test.js`.

| Check | Result |
| --- | --- |
| `npx jest` | **266 passed, 13 suites** (was 212 / 11; +`combination-search.test.js`, +`getPathReference` cases) |
| `npx expo lint` | **0 errors, 0 warnings** |
| Android device | **not performed** — no emulator/SDK here |

Run `npx expo start --android` to verify on a device: typing `159` on the Angle Board should light its diagonals, a row tap should not disturb the selection, and clearing the field should leave the board exactly as it was.
