# Feature: Combination Search — Angle Board

Add a Combination Search feature to the main Picker (Home) screen.

The search finds digit sequences whose consecutive digits are located in neighboring cells on the 10×10 Angle Board.

**Status: implemented.** Verified by lint and unit tests. Not verified on an Android device (no SDK/emulator on the development machine). Full details: `docs/reports/Combination Search - Implementation and Tests.md`.

## 1. Search UI

Add a search input above the Angle Board.

- [x] Accept digit combinations from 0–9.
- [x] Allow multiple digits.
- [x] Provide a clear button.
- [x] Search updates when submitted or when the user pauses typing (300 ms debounce).
- [x] Display the number of matching paths.
- [x] Provide an empty state when no matches are found.
- [x] Preserve the existing Angle Board layout and selection functionality.

## 2. Neighboring Rules

Use all eight directions:

- [x] Up
- [x] Down
- [x] Left
- [x] Right
- [x] Upper-left
- [x] Upper-right
- [x] Lower-left
- [x] Lower-right

Two cells are neighbors when their row and column differences are each at most 1, excluding the same cell.

## 3. Search Algorithm

Implement a dedicated, pure JavaScript search engine.

Location: `src/utils/combination-search.js` — the project keeps shared logic in `src/utils/` (per AGENTS.md directory conventions), so the suggested `src/features/angle-board/search/` was adapted, not created.

- [x] Find every cell matching the first digit.
- [x] For each starting cell, inspect its eight neighboring cells.
- [x] Continue recursively for each subsequent digit (depth-first search).
- [x] Only follow cells matching the next digit.
- [x] Do not reuse a cell within the same path.
- [x] Stop when the entire combination is matched.
- [x] Return every valid matching path.

Each result includes:

- [x] Matched digit sequence (`digits`).
- [x] Ordered cell coordinates (`path`, zero-based `{ row, column }`).
- [x] Start coordinate (`start`).
- [x] End coordinate (`end`).
- [x] Zero-based internal indexes, Excel-style coordinates for display (`getPathReference` in `src/utils/cell-reference.js`).

## 4. Highlight Search Results

Highlight all cells belonging to matching paths on the Angle Board.

- [x] Distinguish search highlighting from normal cell selection (separate `highlights` prop; matches tint with the primary colour, selection keeps its own fill).
- [x] Keep the existing selection behaviour working (selection always wins over highlighting; gestures untouched).
- [x] Overlapping paths highlight shared cells correctly (one Set of all path cells).
- [x] Search highlighting never overwrites the current selection (highlighting is presentation-only and screen-local; the selection store is never written by search).
- [x] Clear search highlights when the query is cleared.
- [x] Navigate between matching paths and emphasise the current one — tapping a result row emphasises that path's cells on the board (solid primary fill). A separate per-path colour palette is deferred to `docs/todo/Unique Search Result Colors.md`.

## 5. Result Summary

- [x] Search combination (`Combination: 123`).
- [x] Total matching paths (`Matches: N`).
- [x] Matching coordinates, one row per path (`A1 → B2 → C3`).

## 6. Architecture

- [x] Search logic separate from UI and gesture handling.
- [x] Engine lives in `src/utils/combination-search.js`; UI in `src/components/search/` (`combination-search-bar.jsx`, `combination-search-results.jsx`); `useDebouncedValue` in `src/hooks/`.
- [x] The search function accepts the grid and digit combination as arguments.
- [x] Not coupled to Zustand or React components.

## 7. Performance

- [x] Supports the 10×10 grid efficiently (DFS with visited-cell Set, capped at 500 paths per search).
- [x] No search on every keystroke — 300 ms debounce, plus explicit submit.
- [x] No unnecessary Zustand updates — all search state is screen-local.
- [x] The Angle Board is never remounted during searches — the bar and results card are siblings of the board, and `highlights` is `undefined` (zero cost) when there are no results.

## 8. Tests

All in `src/utils/__tests__/combination-search.test.js` (plus `getPathReference` cases in `cell-reference.test.js`):

- [x] Horizontal matches.
- [x] Vertical matches.
- [x] Diagonal matches in all four directions.
- [x] Reverse-direction matches.
- [x] Multiple starting positions.
- [x] Overlapping matching paths.
- [x] Repeated digits.
- [x] Zero-valued digits.
- [x] No matches.
- [x] Grid boundaries.
- [x] Paths cannot reuse cells.
- [x] Invalid search input.

## Restrictions

- [x] Preserve working cell selection and drag selection.
- [x] Do not modify gesture architecture (only a presentation-only `highlights` prop was added to the board component).
- [x] JavaScript / ESM only.
- [x] No new dependencies.
- [x] Expo Router navigation untouched.
- [x] Local-first architecture untouched.

## Final Report

See `docs/reports/Combination Search - Implementation and Tests.md` — algorithm, UI changes, highlighting behaviour, files changed, test results, and the Android verification status.
