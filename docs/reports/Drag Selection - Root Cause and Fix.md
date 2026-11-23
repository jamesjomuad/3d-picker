# Drag Selection — Root Cause and Fix

**Status:** Code fix applied and verified at the JS/native-source level. **Not yet verified on an Android device** (no Android SDK, `adb` or emulator on the development machine).

**Date:** 2026-11-23

---

## 1. Exact root cause

`evt.nativeEvent.locationX/locationY` are **not** relative to the view that owns the PanResponder. React Native reports them relative to the **deepest view that was touched** — here, a single grid cell.

Verified in RN 0.88.1's own native sources:

| Platform | File | Behaviour |
| --- | --- | --- |
| Fabric (JS payload) | `ReactCommon/react/renderer/components/view/BaseTouch.cpp` | `locationX = touch.offsetPoint.x` |
| iOS Fabric | `React/Fabric/RCTSurfaceTouchHandler.mm` | `offsetPoint = [uiTouch locationInView:activeTouch.componentView]` (deepest Fabric view) |
| iOS Paper | `React/Base/RCTTouchHandler.m` | `locationX` converted `toView:touchView` (per-touch deepest view) |
| Android | `ReactAndroid/.../events/TouchesHelper.kt` | comment: *"locationX,Y values are relative to the target view"* |

So a tap on a ~35px cell delivered `locationX ≈ 17`, and the handler's first act was:

```js
const gridX = x - headerWidth;   // 17 - 28 = -11
if (gridX < 0 || gridY < 0) return null;
```

`touchToCell()` returned `null` for **every touch on a cell**, and `onPanResponderGrant` did `if (!cell) return;` — before `clearSelection()`, before `setDragState()`. No gesture state was ever created, so release had nothing to commit. Taps and drags were both dead; the store was never touched.

## 2. Which layer was failing

**Touch handling / gesture layer**, at the boundary where it hands coordinates to the coordinate mapper. The mapper (`touchToCell`), the selection engine (`calculateRectSelection` etc.) and the Zustand store were all correct — they were simply never called with valid input.

## 3. Why the previous fixes did not work

| Commit | What it addressed | Why it missed |
| --- | --- | --- |
| `fa20e72` | "stabilize PanResponder, prevent stale closures" | The closure was never stale — the handler was being called with the wrong coordinate space. The gesture reached the code the whole time. |
| `a719751` | "capture phase to stop ScrollView intercepting" | The ScrollView was never stealing the touch. The container was already the responder; it just computed a null cell. |

Both commits changed behaviour that was already working, so the observable symptom was unchanged. The 43 passing unit tests fed container-relative coordinates **by construction**, so they validated the arithmetic while the real payload was in a different space.

## 4. Files changed

| File | Change |
| --- | --- |
| `src/components/board/angle-board-grid.jsx` | Root fix + defects 5–8 below |
| `src/utils/selection.js` | New `touchToDragState()` — full point→gesture mapping, now unit-testable |
| `src/utils/__tests__/selection.test.js` | +38 tests (coordinate round trip, boundaries, header mapping) |
| `src/store/__tests__/boardStore.test.js` | **new** — 22 selection-engine tests |

### The root fix

Every child of the responder container is now `pointerEvents="none"`. Both platforms' hit-testers then skip the subtree and the **container itself becomes the touch target**, which puts `locationX/Y` back into container space:

- Android `TouchTargetHelper.kt`: `PointerEvents.NONE -> null` (view and children cannot be the target).
- iOS `RCTViewComponentView.mm`: `hitTest:` returns `nil` and `betterHitTest` falls through to the container.

A comment in the component documents the contract so the props are not removed as "unused".

### Further defects found in the same gesture path

1. **Row/column header drag could never start.** `onPanResponderGrant` called `touchToCell()` for header zones, but a touch left of the grid (`x < 28`) or above it (`y < 24`) always returns `null`, so it bailed. Headers now derive their row/column from the axis they carry.
2. **Store updates ran inside a `setState` updater** on release. Updaters execute during render, so `selectRect()` notified subscribers mid-render. The gesture is now read from a ref and committed outside any updater.
3. **No `onPanResponderTerminate`.** A forced termination (navigator, native modal) left the gesture stuck with highlights on and nothing committed.
4. **The board measured its own intrinsic width** (always `28 + 10 × 35 = 378`), so cell size never shrank and the board overflowed a 360dp screen — the last column sat partly off-screen and was untouchable. It now measures a stretching wrapper.

## 5. Verification performed

- `npx jest` → **81 passed, 2 suites** (was 43).
- `npx expo lint` → **0 errors, 0 warnings**.
- `npx expo export --platform android` → **Android bundle builds successfully** (3.8MB Hermes bytecode), confirming the modified component compiles and the module graph is intact.

New coverage:

- All 100 cells round-trip at cellSize 24, 30, 35 and 50.
- Exact cell corners, in-cell boundary, far-edge clamping, negative coordinates.
- Full-row and full-column starts from every one of the 10 headers; corner rejection; header boundary.
- Store transitions: cell / rect / row / column / clear / count / isSelected, including reversed drag directions and zero-valued cells.

## 6. Android verification — not performed

**Drag selection has not been tested on a device, and is not claimed to be fixed.**

This machine has no Android SDK, no `adb` on PATH, `ANDROID_HOME`/`ANDROID_SDK_ROOT` unset and no emulator install. An APK cannot be installed or a touch gesture driven from here.

To verify, run `npx expo start --android` (or a development build) and check:

1. Tap one cell → exactly 1 selected, header labels highlight.
2. Press a cell, drag right → live overlay grows, release → range stays.
3. Drag up-left from a lower cell → same rectangle.
4. Drag a **row header** vertically → whole rows.
5. Drag a **column header** horizontally → whole columns.
6. Tap the corner → nothing changes.
7. Page still scrolls when dragging the margin beside the board.

The strongest claim available without a device: given the payload RN's own native code produces for a cell touch (`touchToCell(17, 17, …) → null`), the old code could not have selected anything, and it no longer receives that payload.

### Residual risks not exercised

- The container grabs the touch on **down**, so the page may feel unscrollable when the finger starts on the board (pre-existing behaviour, unchanged).
- Real touch jitter at cell borders may feel slightly different once tested on hardware.
