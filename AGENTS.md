# AGENTS.md — 3D Picker

This is the central development guide for the 3D Picker project. All coding agents (OpenCode, Claude Code, etc.) must read and follow this document before making changes.

## 1. Project Overview

**Project:** 3D Picker
**Platform:** Android (initial target)
**Type:** Local-first mobile application, no backend

3D Picker is centered around an **Angle Board** — a manually defined 2D digit grid used for exploring and selecting number combinations.

The Angle Board is **NOT** a historical lottery draw result. It is an independent digit arrangement.

### Initial Scope

- Display the Angle Board.
- Allow users to interact with grid cells.
- Support digit and cell selection.
- Establish a foundation for future number-picking features.

### Out of Scope (Do NOT Implement Unless Explicitly Requested)

- Historical draw tracking.
- Prediction features.
- Backend services.
- Authentication.
- Cloud synchronization.

## 2. Technology Stack

### Installed Versions

| Package                        | Version  |
| ------------------------------ | -------- |
| expo                           | ~58.0.26 |
| react                          | 19.3.0   |
| react-native                   | 0.88.1   |
| expo-router                    | ~58.0.32 |
| react-native-reanimated        | 4.7.1    |
| react-native-gesture-handler   | ~3.3.0   |
| react-native-safe-area-context | ~5.11.1  |
| react-native-screens           | ~4.30.1  |

### Language and File Conventions

- **JavaScript only.** ES Modules throughout.
- **No TypeScript.** No `.ts` files, no `.tsx` files, no `tsconfig.json`.
- **`.jsx`** for screens and React components (files containing JSX).
- **`.js`** for application logic, utilities, hooks, stores, constants, and configuration.
- Existing TypeScript scaffold files from `create-expo-app` must be converted to JavaScript.

### Package Management

- Use **npm** and **npx**. Never Bun.
- Always use `npx expo install <package>` instead of `npm install` — it resolves SDK-compatible versions.
- Avoid unnecessary dependencies. Prefer Expo-recommended modules over third-party libraries.
- Check available skills and existing dependencies before adding anything new.

### State Management

- **Zustand** for shared application state (to be installed when needed).
- Keep temporary UI state (e.g., animations, focus) local to components.
- Keep persistent board data separate from ephemeral interaction state.

### Expo SDK Notes

Expo ships breaking changes every SDK release. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

### Commands

```bash
npx expo install <package>  # ALWAYS use instead of npm add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo start --android    # start targeting Android
npx expo lint               # lint
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint before declaring any task done.

## 3. Architecture Guidelines

### Directory Structure

```
src/
├── app/                  # Expo Router screens and layouts
│   ├── _layout.jsx       # Root layout (tab navigator, theme provider)
│   ├── index.jsx         # Home / Angle Board screen
│   └── ...               # Additional routes
├── components/           # Reusable UI components
│   ├── angle-board/      # Angle Board family (board, grid, cells, headers, card, hooks)
│   ├── library/          # Board library components (board card, preview)
│   └── ui/               # Generic UI primitives (Button, Text, etc.)
├── store/                # Zustand stores
├── data/                 # Static data files (angle-board.json)
├── hooks/                # Custom React hooks
├── services/             # Data loading and processing
├── utils/                # Pure utility functions and validators
└── constants/            # Design tokens, configuration, enumerations
```

### Separation of Concerns

- **Screens (`src/app/`):** Route definitions and screen composition. Import components and hooks; contain minimal logic.
- **Components (`src/components/`):** Reusable, self-contained UI elements. Accept data via props; do not access stores directly unless they are clearly "connected" container components.
- **State (`src/store/`):** Zustand stores for shared application state. One store per domain (`angleBoardStore.js` for selection, `libraryStore.js` for saved boards). Keep stores focused: selection logic lives in `src/utils/selection.js`, not in the store.
- **Data (`data/`):** Static JSON data files.
- **Services (`src/services/`):** Data loading, parsing, and transformation logic.
- **Utils (`src/utils/`):** Pure functions — validation, formatting, math. No side effects.
- **Constants (`src/constants/`):** Design tokens (colors, spacing, typography), configuration values, enumerations.
- **Hooks (`src/hooks/`):** Custom hooks that encapsulate reusable behavior.

### Rules

- Keep non-route code (components, hooks, utils) outside `src/app/`.
- Avoid oversized stores. Split by domain when a store grows beyond ~100 lines.
- Avoid duplicated logic. Extract shared behavior into hooks or utilities.
- Avoid unnecessary abstractions. Do not wrap simple operations in factory functions or HOCs.
- Avoid tightly coupled components. Pass data through props; use stores only for truly shared state.

### Navigation

- Use **Expo Router** for all navigation. Routes live in `src/app/`.
- Every file in `src/app/` is a screen. `_layout.jsx` files define navigators.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

### Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`). Run EAS CLI as `npx eas-cli@latest <command>`.
Docs: https://docs.expo.dev/eas/index.md

### Native Configuration

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:android` locally, or `eas build --profile development`.

## 4. Angle Board Data

### Data File

The initial data source is `data/angle-board.json`.

It contains exactly one board object:

```json
{
  "name": "Angle Board 001",
  "grid": [
    [6, 0, 3, 8, 1, 0, 7, 4, 9, 5],
    [4, 2, 7, 5, 2, 6, 8, 3, 6, 8],
    [1, 8, 9, 4, 3, 9, 5, 2, 7, 1],
    [7, 3, 0, 1, 6, 7, 0, 4, 5, 0],
    [4, 6, 2, 8, 5, 2, 1, 9, 1, 6],
    [2, 1, 3, 4, 9, 8, 6, 5, 3, 9],
    [7, 4, 0, 6, 1, 3, 4, 0, 6, 7],
    [0, 2, 4, 7, 0, 9, 2, 9, 8, 3],
    [3, 6, 5, 8, 5, 7, 8, 6, 1, 4],
    [8, 1, 9, 4, 3, 1, 5, 0, 7, 2]
  ]
}
```

### Data Model Rules

- Do **not** wrap the board in a `boards` array.
- Do **not** add a redundant `dimensions` property.
- Derive `rows` using `grid.length`.
- Derive `columns` using `grid[0].length`.
- Preserve zero (`0`) as a valid digit. It is not empty or null.
- Validate that all rows have equal lengths.
- Validate that all cells contain integers from 0 through 9.
- Keep the board data model independent from future draw-result records. The board is a static grid, not a result set.

### Validation

All grid data must pass validation before use. Implement validation in `src/utils/` or `src/services/`:

```js
// Required validations:
// - grid is a non-empty array of arrays
// - all rows have the same length
// - every cell is an integer between 0 and 9 (inclusive)
```

## 5. UI/UX Standards

### Design Principles

The Angle Board grid is the primary interface. Everything else supports it.

**Prioritize:**

- Readability and visual hierarchy — digits must be clear and legible.
- Touch-friendly interactive cells — minimum 44×44dp touch targets.
- Consistent spacing and alignment — use design tokens from `src/constants/theme.js`.
- Responsive layouts — the grid should fill available width with appropriate padding.
- Accessibility — sufficient color contrast, touch target sizes, and screen reader support.
- Visual feedback — clear selected/hovered/pressed states for interactive cells.
- Smooth interactions and efficient rendering — no jank on scroll or selection.

**Avoid:**

- Excessive rounded corners.
- Unnecessary gradients.
- Oversized cards or containers.
- Decorative UI that competes with the grid.
- Duplicated styling logic — centralize in components or design tokens.
- Inconsistent spacing and typography.

### Design Tokens

Prefer reusable components and centralized design tokens over inline styles. Colors, spacing, and typography should be defined once in `src/constants/theme.js` (to be converted from the existing `theme.ts`).

### Components

- Prefer small, focused components over monolithic screens.
- Use `React.memo` for components that re-render frequently with the same props (e.g., individual grid cells).
- Use `useMemo` and `useCallback` only when beneficial — do not memoize everything by default.

## 6. Coding Standards

### General

- Use **functional React components** and **hooks**. No class components.
- Use **ES Modules** (`import`/`export`) throughout. No CommonJS (`require`/`module.exports`).
- Keep components focused and reasonably small. If a component exceeds ~150 lines, consider splitting.
- Use descriptive variable and function names. `handleCellPress` over `onPress` or `fn`.
- Avoid deeply nested conditional logic. Extract into early returns, guard clauses, or helper functions.
- Avoid duplicated business logic. Extract into shared utilities or hooks.

### React-Specific

- Use `useMemo` and `useCallback` only when they prevent measurable performance issues — not as a default.
- Keep platform-specific behavior explicit with `Platform.OS` checks or platform-specific file extensions (`.android.jsx`, `.ios.jsx`, `.web.jsx`).
- Handle empty, invalid, and unexpected data safely. Always validate before rendering.
- Never suppress errors without a clear reason. Let errors surface during development.

### State

- Use Zustand selectors to avoid unnecessary re-renders:

  ```js
  // Good — only re-renders when selectedCells changes
  const selectedCells = useBoardStore((state) => state.selectedCells);

  // Bad — re-renders on any store change
  const store = useBoardStore();
  ```

- Keep component-local state (`useState`) for ephemeral UI concerns (animation progress, input focus).
- Keep Zustand stores for data that multiple components need (board state, selection state).

## 7. Performance

- Avoid unnecessary React re-renders. Profile with React DevTools when uncertain.
- Use appropriate Zustand selectors (see above).
- Avoid recreating large arrays and objects during rendering. Define constants outside components or memoize them.
- Keep the grid responsive on lower-end Android devices. The 10×10 grid must render smoothly.
- Avoid premature optimization. Measure first, optimize second.
- Avoid unnecessary dependencies. Every dependency adds bundle size and potential compatibility issues.

## 8. Testing and Quality Assurance

### Before Completing Any Task

1. Run the project's lint command: `npx expo lint`
2. Run relevant tests (when test infrastructure is set up).
3. Validate data structures and business logic.
4. Test important interactions manually.
5. Check for regressions in existing functionality.
6. Verify Android compatibility.

### Test Priorities

Add tests for important logic, especially:

- Grid data validation (row lengths, cell value range).
- Selection behavior (single cell, multi-cell, deselect).
- Store state transitions.

**Do not claim tests passed unless they were actually executed.**

## 9. Agent Skills

Use the Agent Skills standard with project-local `SKILL.md` files.

### Before Creating Skills

1. Inspect existing installed skills.
2. Reuse relevant skills where available.
3. Avoid duplicating instructions already covered by this `AGENTS.md`.

### Recommended Skill Areas

Place project-local skills under `.agents/skills/` when appropriate:

- Expo development (SDK 58 specifics).
- React Native development (mobile-first patterns).
- React Native UI/UX (touch targets, platform styling).
- Zustand state management (store patterns, selectors).
- JavaScript ESM (module conventions for this project).
- Testing (validation logic, interaction tests).

Ensure OpenCode can discover or reference them.

## 10. Development Workflow

For every task, follow this sequence:

1. **Inspect** relevant existing code before editing.
2. **Understand** the current implementation and dependencies.
3. **Identify** the smallest appropriate change.
4. **Follow** existing project conventions.
5. **Avoid** unrelated refactoring.
6. **Avoid** adding dependencies without justification.
7. **Implement** and test the changes.
8. **Summarize** modified files and test results.

For larger changes, explain the implementation plan before modifying files.

Do not overwrite existing configuration without understanding its purpose.

## 11. Project Scope and Constraints

### Current Scope

- **Android** is the initial target platform.
- **Local-first** architecture.
- **No backend.**
- **No authentication.**
- **No cloud synchronization.**
- **No database** at this stage.
- **JSON** is the initial Angle Board data source.

### Future Features

Future features must be introduced **incrementally** and only when explicitly requested. Do not preemptively build infrastructure for features that have not been scoped.

## 12. Maintenance

This `AGENTS.md` is the central source of project-specific development rules.

All coding agents must read and follow it before making changes.

**Keep this document accurate as the project evolves.** Update it when:

- Architectural decisions change.
- New conventions are established.
- Dependencies are added or removed.
- The scope expands beyond the initial plan.

## 13. Navigation Guidelines

### Default Expo Router Tabs

The application must retain the default Expo Router tab navigation generated by `create-expo-app@latest`.

Requirements:

- Preserve the existing `(tabs)` route group.
- Keep the existing bottom tab navigator.
- Do not replace it with a custom navigation library or navigation implementation.
- Do not remove the default navigation structure unless explicitly requested.
- Follow the existing Expo Router file-based routing conventions.
- Keep tab configuration in the existing `_layout.jsx` file.
- Use Expo Router for navigation between screens.

### Initial Tab Structure

Adapt the default tabs to the 3D Picker application:

- **Picker** — Main screen containing the Angle Board.
- **Boards** — Future Angle Board management.
- **Settings** — Application preferences.

The Picker tab should be the default landing screen.

### Navigation Design

- Retain native-feeling bottom tab navigation.
- Use appropriate icons.
- Keep labels visible and concise.
- Respect Android safe areas and system navigation.
- Maintain consistent light and dark theme behavior.

### Important Restrictions

- Do not introduce React Navigation separately; Expo Router already uses React Navigation.
- Do not create another bottom tab implementation inside individual screens.
- Do not move the main Picker screen outside the existing tab group.
- Avoid unnecessary nested navigators.
- Do not modify Expo Router configuration without a clear requirement.

Before changing navigation, inspect the existing generated Expo template and preserve its working configuration.
