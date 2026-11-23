# Angle Board Refactor and Drag Fill

**Status:** Refactor and fill feature complete and verified by lint, unit tests and an Android bundle export. **Not verified on an Android device** — the development machine has no Android SDK, `adb` or emulator.

**Date:** 2026-11-23

---

## 1. Before and after

### Before

`src/components/board/angle-board-grid.jsx` (380 lines) was the whole feature in one file: layout measurement, the PanResponder, header rendering, cell rendering, the drag highlight math and the overlay rectangle. It reached into the Zustand store directly, so the board could only ever be the Picker screen's board.

`src/components/board/editable-board-grid.jsx` (207 lines) was the second board, written for the library's edit sheet. It re-declared the same geometry constants, re-implemented header rendering, copied the frame overlay and the cell styles, and had no selection at all. The two files were free to drift.

The store owned selection *logic*: `selectRect`, `selectRows`, `selectCols` each called the selection engine and wrote the result. That is a component behaviour living in a data layer.

Coordinates had one display rule per consumer, and the digit rule lived in two places (whole-board validation, and a hand-rolled check inside the cell editor).

### After

Three layers with one job each, plus one component family that owns the board.

| Layer | Files | Job |
| --- | --- | --- |
| Component | `src/components/angle-board/` | Draw a board, read gestures on it, report what they mean. No store, no routes. |
| Logic | `src/utils/selection.js`, `board-layout.js`, `board-fill.js`, `cell-reference.js`, `selection-summary.js`, `board-validation.js` | Pure functions: what a drag selects, how big a cell is, what a fill writes, how a coordinate reads, what a legal digit is. |
| State | `src/store/angleBoardStore.js`, `src/store/libraryStore.js` | Hold the selection Set; hold and persist saved boards. |
| Data | `src/services/board-storage.js`, `data/angle-board.json` | Load and save the board library. |

```
src/components/angle-board/
├── index.js                        # the public surface: AngleBoard, SelectedCellsCard
├── angle-board.jsx                 # composition: owns the hooks, wires props
├── angle-board-grid.jsx            # rows, headers, cells (presentational)
├── angle-board-cell.jsx            # one digit, read-only
├── angle-board-edit-cell.jsx       # one digit, with its single-character field
├── angle-board-headers.jsx         # corner, A–J column labels, 1–10 row labels
├── angle-board-selection.jsx       # drag overlay + the hairline frame
├── selected-cells-card.jsx         # digits, coordinates, range, type, Copy
└── hooks/
    ├── use-angle-board-gestures.js # measure + PanResponder + what a drag means
    └── use-angle-board-editing.js  # which cell is in its field, and committing it
```

Removed: `src/components/board/` entirely (`board-card.jsx` and `board-preview.jsx` moved to `src/components/library/`, where they belong — they are library chrome, not the board), `src/store/boardStore.js` and its test.

---

## 2. Public API

Screens import from the barrel and nothing deeper:

```js
import { AngleBoard, SelectedCellsCard } from '@/components/angle-board';
```

```
<AngleBoard
  grid               number[][]    the digits
  selection          Set<string>   "row,col" keys, owned by the caller
  onSelectionChange  (cells) =>    read-only mode: called once per commit
  editable           boolean       false
  onCellChange       (changes) =>  editable mode: { "row,col": digit }
  style                           optional container style
/>
```

Deliberately absent: cell size (measured), drag state (transient), theme (from `useTheme`), board identity (the caller's business), a toolbar (the "Clear selection" link stays in the Picker — a generic board has no opinion about it).

`onCellChange` takes a **map** whether the change was one typed digit or a hundred filled ones, so an owner has exactly one write path.

---

## 3. Selection and fill semantics

| Gesture | Read-only | Editable |
| --- | --- | --- |
| Tap one cell | select it | open its single-digit field |
| Drag a block | select the block | **fill** the block |
| Drag a row/column header | select the row/column | fill the row/column |
| Release **or** terminate | commit | commit |

A fill takes its pattern from the **current selection when that selection is a solid rectangle the drag touches** — Excel's fill handle. Otherwise the target is its own pattern and nothing changes (there is nothing to extend yet).

```
select A1:B1  →  drag A1:C2        fills rows 2 with the same 1x2 pattern
                          (6,0)        (6,0,6)
                                      (6,0,6)
```

Tiling wraps cyclically in both axes (`wrap(offset, size) = ((offset % size) + size) % size`), so extending up or left repeats the pattern the same way extending down or right does. Growing a 2-row block by 3 rows repeats those 2 rows; shrinking a selection crops it without rewriting the surviving digits. Only cells whose digit actually changes are reported, and the store applies a whole fill as **one** board write and one persist (`libraryStore.applyCells`).

The rule "one digit per cell" exists once, in `board-validation.js` (`isValidDigit`, `parseDigit`); `validateGrid` and the cell field both use it.

Note this is cyclic tiling, not Excel's arithmetic series extension (a selected `1, 2` fills `3, 4, 5`). Series filling is a separate feature and is not implemented.

---

## 4. The coordinate contract (and why it now covers both modes)

`evt.nativeEvent.locationX/locationY` are relative to the **deepest view that was touched**, not to the view that owns the responder. That is the root cause documented in `Drag Selection - Root Cause and Fix.md`, and the reason every child of the gesture container carries `pointerEvents="none"`.

In the old editable grid each cell was a `Pressable`. Making the new edit cells `Pressable` too would have been the obvious choice — and would have silently killed fills, because the moment a cell accepts the touch it takes the gesture origin with it. So **rows are `pointerEvents="none"` in both modes**, and the editable board reads taps from the same gesture that reads drags:

```js
// angle-board-grid.jsx
// The board itself reads touches, in both modes: a cell that took the
// touch would take the gesture origin too, and coordinates would stop
// meaning "inside the board" (see the hook's contract).
pointerEvents="none"
```

The keyboard still works: a one-cell drag opens the field, and the field's own `TextInput` receives focus (`autoFocus`) rather than a touch from us.

---

## 5. What the store does now

`angleBoardStore.js` holds `selectedCells` and two actions — `setSelection(cells)`, `clearSelection()`. It imports no logic. It copies whatever it is given, so a caller cannot mutate the store's Set behind its back.

The engine calls that used to sit inside the store (`calculateRectSelection` etc.) are now made by the gesture hook, which reports a finished cell set through `onSelectionChange`. That is the difference that lets the board exist in the edit sheet without the store's permission.

---

## 6. Consumers

**Picker (`src/app/index.jsx`)** — read-only board plus the summary card. Selection lives in `angleBoardStore` because the card and the Clear link both need it:

```jsx
<AngleBoard grid={board.grid} selection={selection} onSelectionChange={setSelection} />
<SelectedCellsCard grid={board.grid} selection={selection} style={styles.selectionCard} />
```

**Boards (`src/app/boards.jsx`)** — the edit sheet renders the *same* component in editable mode with its own selection, which is what makes filling possible there:

```jsx
<AngleBoard
  grid={editingBoard.grid}
  selection={editSelection}
  onSelectionChange={setEditSelection}
  editable
  onCellChange={handleCellChange}
/>
```

`openEditSheet`/`closeEditSheet` clear `editSelection` along with the board id: a leftover pattern from the previous board would fill this one with those digits.

---

## 7. Tests, lint, build

| Check | Result |
| --- | --- |
| `npx jest` | **212 passed, 11 suites** (145 / 6 before the refactor) |
| `npx expo lint` | **0 errors**, 1 warning — `'ReplaceTool' is defined but never used` in `boards.jsx`, from work in progress on the Replace tool, not from this change |
| `npx expo export --platform android` | succeeded — `entry-125fb24a….hbc`, 3.9 MB Hermes bundle |
| TypeScript files | none added; `npx tsc --noEmit` silent because there is no TS config |

New coverage: `board-layout` (cell sizing, selection rects), `board-validation` (digit rules, grid shape), `board-fill` (tiling, crop, extend up/left, row/column targets, `getFillSource` solid-vs-irregular and non-overlapping, no-mutation), `selection-bounds` (`getSelectionBounds`, `isSolidRectangle`), `angleBoardStore`, and `angle-board.test.jsx` — component tests through `react-test-renderer` for props, headers, highlights, the read-only/editable split, `getGestureOutcome` for every gesture shape, and the editing hook (typed digit → `{ "0,0": 9 }`, invalid digit → `Alert` + no report, `cancelEdit`).

Supporting changes: `react-test-renderer@19.3.0` added as an exact devDependency (`npx expo install react-test-renderer` fails ERESOLVE — 19.3.1 wants react ^19.3.1 while RN 0.88.1 pins 19.3.0); `jest.config.js` maps CSS to `test/style-mock.js` because the template's `constants/theme.js` imports `global.css`; `eslint.config.js` test-globals globs widened to `.jsx`.

### What is NOT covered

React Native's host `View` strips responder props from the test tree, so **no test can dispatch a touch**. The gesture *wiring* (`panHandlers` attached, rows `pointerEvents="none"`, a one-cell drag yields `tap`) is asserted; the touch pipeline itself is not. Coordinate mapping is covered where it can be — by 38 pure `selection.js` tests that feed the same numbers the native layer produces.

---

## 8. Open items

1. **Android device verification** of both selection and fill. The gesture code is a move of existing, working behaviour, not a rewrite of it; the fill path is new and untested on hardware.
2. `src/services/board-loader.js` is dead — `loadBoard`/`clearBoardCache`/`getBoardDimensions` have no callers since the Picker started reading the library store. Kept for now; delete on request.
3. The Picker's board now comes from `libraryStore.activeBoardId` (from the user's WIP commit `cebfcbb`), but the selection is **not** cleared when the active board changes. Keys are positional, so a stale selection can light unrelated cells on a different board.
4. Board library screen and Picker both keep their own `contentPadding`/`contentWidth` handling; a `Screen` wrapper was deliberately not introduced until a third non-trivial screen needs one.

---

## 9. Files touched

**Created:** `src/components/angle-board/{index.js, angle-board.jsx, angle-board-grid.jsx, angle-board-edit-cell.jsx, angle-board-headers.jsx, angle-board-selection.jsx, hooks/use-angle-board-gestures.js, hooks/use-angle-board-editing.js, __tests__/angle-board.test.jsx}`, `src/store/angleBoardStore.js`, `src/utils/{board-layout.js, board-fill.js}`, `src/utils/__tests__/{board-layout.test.js, board-validation.test.js, board-fill.test.js, selection-bounds.test.js}`, `src/store/__tests__/angleBoardStore.test.js`, `test/style-mock.js`.

**Moved:** `board/angle-board-cell.jsx` → `angle-board/angle-board-cell.jsx`; `angle-board/SelectedCellsCard.jsx` → `angle-board/selected-cells-card.jsx` (props `board`/`selectedCells` → `grid`/`selection`); `board/{board-card.jsx, board-preview.jsx}` → `library/`.

**Deleted:** `board/angle-board-grid.jsx`, `board/editable-board-grid.jsx`, `store/boardStore.js`, `store/__tests__/boardStore.test.js`.

**Modified:** `src/app/index.jsx`, `src/app/boards.jsx`, `src/store/libraryStore.js` (+ test), `src/utils/selection.js` (`getSelectionBounds`, `isSolidRectangle`), `src/utils/board-validation.js`, `src/utils/__tests__/selection-summary.test.js`, `AGENTS.md`, `eslint.config.js`, `jest.config.js`, `package.json`, `package-lock.json`.
