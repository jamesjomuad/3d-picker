# Architecture Upgrade: Introduce SQLite for 3D Picker

We have decided to move from JSON file persistence to a local SQLite database.

Use `expo-sqlite`.

## 1. Inspect First

Inspect the actual project:

- Expo SDK and React Native versions.
- Existing JSON board storage.
- Board management implementation.
- Zustand stores.
- Data services.
- Application startup and Expo Router layouts.
- Existing tests.

Verify `expo-sqlite` compatibility with the installed Expo SDK.

Use `npx expo install expo-sqlite` only after confirming compatibility.

## 2. Database Architecture

Create a dedicated database layer:

src/database/

- connection.js
- index.js
- migrations/
- repositories/

Use SQLite as the single source of truth for persistent application data.

UI components must never execute SQL directly.

## 3. Initial Schema

### boards

- id TEXT PRIMARY KEY
- name TEXT NOT NULL
- grid_json TEXT NOT NULL
- is_favorite INTEGER NOT NULL DEFAULT 0
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

### app_settings

- key TEXT PRIMARY KEY
- value TEXT

### schema_migrations

- version INTEGER PRIMARY KEY
- applied_at TEXT NOT NULL

Add appropriate constraints and indexes.

Each board must have a valid 10×10 grid containing integer values from 0 through 9.

Store the grid as JSON text initially. Do not create 100 individual cell records per board.

## 4. Repository Layer

Implement board repository operations:

- getAllBoards()
- getBoardById(id)
- getActiveBoard()
- createBoard(board)
- updateBoard(id, changes)
- updateBoardGrid(id, grid)
- renameBoard(id, name)
- toggleFavorite(id)
- duplicateBoard(id)
- deleteBoard(id)
- setActiveBoard(id)

Implement settings repository operations:

- getSetting(key)
- setSetting(key, value)

Use parameterized SQL queries.

Use transactions where multiple database changes must succeed together.

## 5. Zustand Integration

Keep Zustand responsible for application state.

- Load boards from SQLite during initialization.
- Update the store after successful database operations.
- Do not maintain competing copies of persistent board data.
- Keep transient Angle Board selection state separate from persisted board data.
- Avoid unnecessary subscriptions and re-renders.

## 6. Migration from Existing JSON

Inspect the current JSON format and persistence implementation.

Create a safe, idempotent migration:

1. Detect existing board data.
2. Validate existing records.
3. Import valid boards into SQLite.
4. Preserve board IDs and grid contents where possible.
5. Preserve favorites and active board if they exist.
6. Avoid duplicate imports on subsequent launches.
7. Do not delete the original JSON data until migration has been verified.
8. Handle interrupted migration safely.

If existing data is a single-board format, migrate it into the new boards table.

## 7. Database Lifecycle

- Initialize SQLite once.
- Enable foreign key support.
- Apply migrations in order.
- Handle database errors properly.
- Avoid repeated database connections.
- Ensure application screens do not access an uninitialized database.
- Keep initialization compatible with Expo Router.

## 8. Testing

Test:

- Database initialization.
- Migration execution.
- Repeated migration execution.
- Board creation and retrieval.
- Board updates.
- Grid validation.
- Favorites.
- Duplication.
- Deletion.
- Active board persistence.
- Application restart and data recovery.
- Interrupted migration handling.

Run existing verification and lint commands.

## Restrictions

- JavaScript / ESM only.
- No TypeScript or TSX.
- No backend or cloud database.
- No authentication or synchronization.
- No ORM unless explicitly approved.
- No unnecessary dependencies.
- Preserve Expo Router navigation.
- Do not modify working Angle Board gesture behavior.
- Do not redesign unrelated screens.

## Final Report

Report:

1. Database architecture.
2. Schema and migration version.
3. Files created or changed.
4. JSON migration behavior.
5. Tests and verification results.
6. Remaining risks.

Do not implement unrelated features.
