# Feature: Combination Search — Angle Board

Add a Combination Search feature to the main Picker (Home) screen.

The search finds digit sequences whose consecutive digits are located in neighboring cells on the 10×10 Angle Board.

## 1. Search UI

Add a search input above the Angle Board.

Requirements:

- Accept digit combinations from 0–9.
- Allow multiple digits.
- Provide a clear button.
- Search should update when submitted or when the user pauses typing.
- Display the number of matching paths.
- Provide an empty state when no matches are found.
- Preserve the existing Angle Board layout and selection functionality.

## 2. Neighboring Rules

Use all eight directions:

- Up
- Down
- Left
- Right
- Upper-left
- Upper-right
- Lower-left
- Lower-right

Two cells are neighbors when their row and column differences are each at most 1, excluding the same cell.

## 3. Search Algorithm

Implement a dedicated, pure JavaScript search engine.

Suggested location:

`src/features/angle-board/search/combination-search.js`

Algorithm:

1. Find every cell matching the first digit.
2. For each starting cell, inspect its eight neighboring cells.
3. Continue recursively or iteratively for each subsequent digit.
4. Only follow cells matching the next digit.
5. Do not reuse a cell within the same path.
6. Stop when the entire combination is matched.
7. Return every valid matching path.

Each result should include:

- Matched digit sequence.
- Ordered cell coordinates.
- Start coordinate.
- End coordinate.

Use zero-based internal indexes and Excel-style coordinates for display.

Example result:

{
"digits": "123",
"path": [
{ "row": 0, "column": 0 },
{ "row": 1, "column": 1 },
{ "row": 2, "column": 2 }
]
}

## 4. Highlight Search Results

Highlight all cells belonging to matching paths on the Angle Board.

Requirements:

- Distinguish search highlighting from normal cell selection.
- Keep the existing selection behavior working.
- If multiple paths overlap, highlight the shared cells correctly.
- Do not allow search highlighting to overwrite the current selection.
- Clear search highlights when the query is cleared.

If practical, provide a way to navigate between matching paths and emphasize the currently selected result.

## 5. Result Summary

Display:

- Search combination.
- Total matching paths.
- Matching coordinates.

Example:

Combination: 123
Matches: 4

A1 → B2 → C3
D4 → E5 → F6

## 6. Architecture

Keep search logic separate from UI and gesture handling.

Suggested structure:

src/features/angle-board/search/

- combination-search.js
- combination-search-utils.js
- combination-search.test.js

The search function must accept the grid and digit combination as arguments.

Do not couple it directly to Zustand or React components.

## 7. Performance

- Support the 10×10 grid efficiently.
- Avoid searching on every keystroke if it causes unnecessary work.
- Use a short debounce or explicit search submission.
- Avoid unnecessary Zustand updates.
- Do not recreate the grid or remount the Angle Board during searches.

## 8. Tests

Test:

- Horizontal matches.
- Vertical matches.
- Diagonal matches in all four directions.
- Reverse-direction matches.
- Multiple starting positions.
- Overlapping matching paths.
- Repeated digits.
- Zero-valued digits.
- No matches.
- Grid boundaries.
- Paths cannot reuse cells.
- Invalid search input.

## Restrictions

- Preserve working cell selection and drag selection.
- Do not modify gesture architecture.
- Keep JavaScript / ESM only.
- No new dependencies.
- Keep Expo Router navigation.
- Keep local-first architecture.

## Final Report

Report the search algorithm, UI changes, highlighting behavior, files changed, test results, and Android verification.
