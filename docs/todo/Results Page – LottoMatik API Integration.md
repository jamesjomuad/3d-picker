# Feature: Results Page – LottoMatik API Integration

Implement a dedicated Results page in 3D Picker that displays the latest Philippine 3D Lotto draw results and provides access to historical results.

Use the two discovered LottoMatik API endpoints. The implementation must be local-first, reliable, and extensible to additional lottery sources in the future.

## 1. Inspect Existing Implementation

Before making changes:

- Inspect the existing Expo Router navigation and tab structure.
- Inspect the current Results page, if one exists.
- Review Zustand stores and existing local persistence/database architecture.
- Inspect existing theme, reusable components, loading states, and error handling.
- Review `AGENTS.md` and follow all project conventions.
- Check whether existing lottery result models or data structures can be reused.

Do not assume a particular database schema without inspecting the repository.

Do not install PanelUI. Use existing React Native components and styling architecture.

## 2. Data Sources

Use the following two endpoints.

### A. Latest Draw Results

Primary endpoint:

```http
GET https://lottomatik.pcso.gov.ph/api/backend/api/v1/draw-results/latest
```

Purpose:

- Retrieve the latest available lottery results.
- Keep the Results page updated.
- Detect newly published draws.
- Update existing records when appropriate.

### B. Historical Results

Historical endpoint:

```http
GET https://lottomatik.com/api/backend/api/v1/lottery-results/history?lottery=3DL&limit=30
```

Purpose:

- Retrieve the initial 30 historical 3D Lotto results.
- Populate the historical results list.
- Support loading older results using cursor pagination.

The observed response structure includes:

```json
{
  "items": [
    {
      "id": "3DLS0002220",
      "lottery": "3DL",
      "drawNumber": "S0002220",
      "result": ["1", "3", "0"],
      "drawDate": "2026-11-24",
      "drawTime": "21:00:00+08",
      "jackpot": "4500.0000",
      "totalWinners": "27",
      "provisional": true,
      "collectedAt": "...",
      "lastVerifiedAt": "...",
      "lastSuccessfulCaptureAt": "..."
    }
  ],
  "pageInfo": {
    "limit": 30,
    "hasNextPage": true,
    "nextCursor": "...",
    "asOf": "...",
    "expiresAt": "..."
  }
}
```

This is an observed response example, not a guaranteed permanent schema. Inspect the actual responses during implementation.

### Request requirements

Start with minimal GET requests:

```js
const response = await fetch(url, {
  method: "GET",
  headers: {
    Accept: "application/json",
  },
});

if (!response.ok) {
  throw new Error(`HTTP error: ${response.status}`);
}

const data = await response.json();
```

- Do not copy browser cookies from Chrome Network requests.
- Do not hardcode analytics or session cookies.
- Do not include unnecessary browser-generated headers.
- Do not hardcode browser User-Agent values.
- Only add `Referer`, `Origin`, or other headers if testing proves they are necessary.
- Do not introduce a backend or proxy server.
- Keep endpoint URLs centralized in one configuration location.

Test both endpoints independently before integrating them.

## 3. Investigate Cursor Pagination

The historical API response exposes:

- `pageInfo.limit`
- `pageInfo.hasNextPage`
- `pageInfo.nextCursor`
- `pageInfo.asOf`
- `pageInfo.expiresAt`

Before implementing pagination, inspect the API behavior and determine:

1. The exact query parameter used to submit `nextCursor`.
2. Whether the cursor is passed as a query parameter or another request value.
3. Whether `limit` can be customized.
4. How expired cursors are handled.
5. Whether the first-page request generates a fresh cursor.
6. Whether historical pagination returns older records in chronological order.

Do not guess the cursor parameter name.

Use the actual API behavior discovered during implementation.

### Pagination behavior

- Initial request retrieves 30 records.
- Load older records when the user reaches the bottom of the history list.
- Use the returned cursor.
- Stop requesting when `hasNextPage` is false.
- Prevent duplicate pagination requests.
- Prevent duplicate records when pages overlap.
- Handle expired cursors gracefully.
- If a cursor expires, restart from the first page when necessary and reconcile records by ID.
- Preserve already downloaded historical results.

Do not repeatedly request the first 30 records when older records are available through pagination.

## 4. Supported Lottery Types

Initially support:

- `3DL` – 3D Lotto.

The latest endpoint may return multiple lottery types.

Filter the data appropriately.

Keep the data model extensible for additional lottery types, but do not expand the initial UI scope beyond 3D Lotto unless existing functionality already supports them.

## 5. Result Normalization and Validation

Create a dedicated normalization layer between API responses and the application.

Responsibilities:

- Validate required fields.
- Normalize lottery identifiers.
- Normalize draw dates and times.
- Preserve the original API record ID.
- Preserve the draw number.
- Preserve winning digits.
- Normalize optional jackpot and winner information.
- Preserve provisional and verification metadata.
- Preserve source attribution.
- Handle missing optional fields.
- Identify duplicate records.
- Handle malformed responses safely.

### Winning number formatting

Never convert winning combinations into integers.

For example:

```js
["0", "3", "7"];
```

Must display as:

`037`

Leading zeros must always be preserved.

Do not assume all winning results have the same number of digits without checking the lottery type.

### Date and time

- Preserve the original draw date and time.
- Display dates in a readable local format.
- Respect the supplied timezone offset.
- Do not accidentally shift draw times when converting between timezones.
- Sort by the actual draw date and time, newest first.

## 6. Merge Latest and Historical Results

Both endpoints may return overlapping records.

Merge the results into one collection.

Requirements:

- Use the API record `id` as the preferred unique identifier.
- Do not create duplicates when the same draw appears in both endpoints.
- Preserve source attribution.
- Preserve useful verification metadata.
- Avoid silently overwriting conflicting results.
- If the same draw has different winning digits across sources, flag the conflict.
- Keep enough information to investigate conflicting records.

The Results page should present one record per draw, not one card per API response.

## 7. Results Page UI

Create a dedicated Results page following the existing application design system.

### A. Page Header

Display:

- Page title: Results
- Latest successful update timestamp
- Refresh action

The refresh action should retrieve the latest results.

Prevent overlapping refresh requests when the user taps repeatedly.

### B. Latest Results

Display the newest draws first.

Each result card should include:

- Lottery name
- Draw date
- Draw time
- Winning combination
- Jackpot, when available
- Total winners, when available
- Provisional/verification status
- Source attribution

For 3D Lotto, display the winning combination as three prominent individual digits.

Example:

`0   3   7`

Use compact cards with clear information hierarchy. Avoid oversized cards that waste screen space.

### C. Historical Results

Provide a scrollable historical results list.

Requirements:

- Group results by draw date where appropriate.
- Show the newest draws first.
- Load older records when the user reaches the bottom.
- Show a loading indicator during pagination.
- Show an appropriate end-of-history state.
- Prevent duplicate entries.
- Keep already loaded records visible while retrieving more history.

### D. Date Filtering

Allow users to browse results by date.

At minimum:

- Date-based filtering.
- Clear filter action.
- Preserve the normal newest-first ordering.

Avoid implementing complicated filters that are unnecessary for the initial release.

### E. Result Details

If a result is tapped, show a detail view or bottom sheet containing:

- Winning combination
- Lottery name
- Draw number
- Draw date and time
- Jackpot
- Total winners
- Provisional status
- Verification timestamps, when available
- Source information

Provide an external link to the original result source if a reliable URL can be constructed from verified page patterns.

Do not invent source URLs.

## 8. Result Verification and Reliability

Respect the API's verification fields.

Possible statuses:

- Provisional
- Verified
- Pending verification
- Conflicting

Important rules:

- Do not mark every result as verified.
- Do not assume `provisional: false` alone proves independent verification.
- Use actual verification metadata accurately.
- Do not invent verification states.
- Preserve the original source and timestamps.
- Clearly identify conflicting results.
- Never silently replace a previously stored winning combination.

If two sources disagree, display an appropriate warning rather than choosing one silently.

## 9. Local Persistence and Caching

Results must remain available offline.

Use the existing local persistence architecture.

Requirements:

- Save successfully retrieved results locally.
- Update existing records rather than creating duplicates.
- Preserve historical results.
- Use API record ID as the preferred unique identifier.
- Store source attribution.
- Store retrieval/synchronization timestamps.
- Load cached results immediately when opening the Results page.
- Refresh in the background when appropriate.
- Do not clear cached results when a request fails.
- Preserve existing data when pagination fails.

Do not introduce another database or persistence library.

## 10. Refresh and Loading States

Implement the following states:

### Initial loading

Use the existing skeleton/loading component when no cached results are available.

### Background refresh

Keep existing results visible while refreshing.

### Offline or request failure

Display cached results with a subtle message that the latest results could not be retrieved.

### Empty state

Explain that no results are currently available.

### Pagination loading

Show a small loading indicator at the bottom of the history list.

### End of history

Display a clear indication that no older results are available.

### API error

Show a friendly error message without exposing raw server responses.

Never replace valid cached results with an empty list when an API request fails.

## 11. Source Architecture

Keep the data layer separate from the Results UI.

Follow existing project conventions. A reasonable separation would be:

- LottoMatik latest-results API client.
- LottoMatik historical-results API client.
- Response normalization and validation.
- Result merging and conflict detection.
- Result repository and persistence.
- Results state management.
- Results screen and reusable result components.

The architecture should allow additional result providers to be integrated later without rewriting the Results screen.

Avoid unnecessary abstractions and overengineering.

## 12. Performance

- Avoid unnecessary re-renders when new historical records are loaded.
- Use efficient list rendering.
- Do not render all historical records inside a basic ScrollView if a virtualized list is more appropriate.
- Prevent duplicate network requests.
- Avoid fetching historical records repeatedly when they are already cached.
- Keep the UI responsive during refresh and pagination.

## 13. Technical Constraints

- Expo SDK 58.
- React Native.
- Expo Router.
- JavaScript / ESM only.
- No TypeScript or TSX.
- npm only.
- Existing Zustand architecture.
- Existing local persistence.
- No backend, authentication, or cloud database.
- No unnecessary dependencies.
- No PanelUI installation.
- Android-first UI.
- Preserve existing navigation and unrelated features.

## 14. Verification

Test the following:

1. Latest-results API request succeeds without cookies.
2. Historical API request retrieves 30 records.
3. Cursor pagination retrieves older records correctly.
4. Cursor expiration is handled safely.
5. Both API responses normalize correctly.
6. Only supported lottery records are displayed.
7. Leading zeros are preserved.
8. Results are sorted newest first.
9. Overlapping records do not create duplicates.
10. Conflicting records are identified.
11. Provisional and verification statuses are accurate.
12. Cached results load when offline.
13. Refresh failures do not remove existing results.
14. Historical results remain available after restarting the app.
15. Pagination does not trigger overlapping requests.
16. Date filtering works correctly.
17. Result details display the correct information.
18. Light and dark themes work correctly.
19. Existing navigation remains functional.

Run focused tests and lint checks appropriate to the changes.

## 15. Final Report

Provide a concise report containing:

- Files created or modified.
- Both API endpoints and their behavior.
- Actual response structures discovered.
- Cursor pagination parameter and behavior.
- Normalization and validation implementation.
- Duplicate and conflict handling.
- Local persistence implementation.
- Results page functionality.
- Historical-results limitations.
- Tests and verification performed.
- Any API restrictions or unresolved issues.

## Critical Requirements

1. Use the PCSO-hosted LottoMatik API for latest results.
2. Use the LottoMatik historical API for initial history and older records.
3. Implement real cursor pagination based on the API's actual response.
4. Preserve leading zeros in all winning combinations.
5. Keep results available offline through local persistence.
6. Respect provisional and verification metadata.
7. Never silently overwrite conflicting draw results.
8. Do not scrape the HTML page if the JSON API provides the required information.
9. Do not hardcode browser cookies or unnecessary headers.
10. Keep the architecture extensible for additional result providers.

Do not modify unrelated Angle Board, Fun Pick, Selection Basket, or board-generation functionality.
