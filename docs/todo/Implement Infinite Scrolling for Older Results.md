# Implement Infinite Scrolling for Older Results

The Results page currently stops displaying older lottery results at October. It should automatically fetch additional historical results from the existing PCSO Lotto API v2 as the user scrolls down.

Implement cursor-based pagination with infinite scrolling, reusing the existing API integration and SQLite database infrastructure.

## 1. Inspect the existing implementation

Before changing code:

- Read `AGENTS.md`.
- Inspect the Results page and its current list rendering.
- Inspect the existing PCSO Lotto API v2 service.
- Inspect the existing SQLite Results repository, tables, and synchronization logic.
- Identify how the initial Results page data is loaded and ordered.
- Identify why the list currently stops at October.
- Check whether pagination metadata (`pageInfo.nextCursor`) is already being stored or discarded.

Do not rebuild the API integration or SQLite infrastructure.

## 2. API pagination

Use the existing PCSO Lotto API v2 endpoint:

`GET https://pcsolotto.org/api/v2/draws`

Use the documented parameters:

- `limit`: Maximum 200 records per request.
- `cursor`: Numeric cursor from the previous response's `pageInfo.nextCursor`.
- Existing game filters, if needed, must be preserved.

Pagination requirements:

- Read `pageInfo.nextCursor` from every API response.
- Use that cursor for the next request.
- Continue fetching until the API indicates there are no more pages.
- Do not hardcode October or any other date as a pagination boundary.
- Do not invent cursors or derive them from dates.
- Respect the API's actual pagination contract.

## 3. Infinite scrolling

When the user approaches the bottom of the Results list:

1. Detect that the user is nearing the end of the currently loaded results.
2. Check whether another page is available.
3. Request the next page using the saved cursor.
4. Persist the returned draws through the existing SQLite repository.
5. Update the displayed Results list.
6. Continue allowing the user to scroll into older results.

Use the existing list implementation and its pagination capabilities where possible.

Avoid triggering requests on every scroll event. Use an appropriate end-reached threshold and pagination guards.

## 4. SQLite integration

The existing Results database implementation must remain the source of persisted Results data.

- Save newly fetched historical draws into the existing Results tables.
- Reuse existing insert/upsert operations.
- Preserve existing draw IDs and game identifiers.
- Prevent duplicate records.
- Preserve leading zeros when displaying three-digit winning numbers.
- Preserve existing draw dates, game codes, slots, and other metadata.
- Ensure the list reflects newly persisted records.
- Maintain newest-first chronological ordering.
- Do not create another database, table, or database initialization system unless the existing schema genuinely requires a minimal migration.

Do not modify unrelated Collection database functionality.

## 5. Loading and error states

Provide appropriate states at the bottom of the Results list:

**Loading**

- Show a compact loading indicator at the bottom.
- Keep existing results visible.
- Do not replace the entire page with a loading screen.

**No more results**

- Stop pagination when the API returns no next cursor or otherwise indicates the end.
- Do not keep requesting the API.

**Network error**

- Keep all previously loaded results visible.
- Show a compact error message and Retry action.
- Retry using the correct cursor without restarting the entire Results page.

**Empty response**

- Handle empty pages safely.
- Avoid infinite pagination loops if the API returns an unchanged cursor or repeated page.

## 6. Pagination safeguards

Implement safeguards for:

- Preventing simultaneous pagination requests.
- Preventing duplicate requests for the same cursor.
- Preventing repeated processing of the same draw IDs.
- Detecting an unchanged or invalid next cursor.
- Handling network interruption.
- Handling app backgrounding or navigation away during a request.
- Preventing stale responses from overwriting newer data.

Ensure that retrying a failed request does not skip historical records.

## 7. Preserve existing Results UI

Do not redesign the Results page.

Preserve:

- Existing compact date-grouped layout.
- Three draw columns: 2PM, 5PM, and 9PM.
- Yellow lottery balls for available winning numbers.
- Pending, Upcoming, and unknown states.
- Leading-zero formatting.
- Existing filters and search.
- Existing date and draw ordering.
- Current visual styling and theme support.

New historical results should appear seamlessly as the user scrolls.

## 8. Performance

- Avoid reloading the entire Results dataset after every page.
- Avoid unnecessary re-renders of existing date groups.
- Use stable keys.
- Reuse existing list virtualization.
- Keep scrolling smooth while older pages are loaded.
- Avoid repeated full-dataset sorting when incremental merging is sufficient.

## 9. Verification

Test the following:

1. Initial Results load displays existing locally stored records.
2. Scrolling near the bottom triggers the next API request.
3. The correct `nextCursor` is used.
4. Older results are persisted into the existing SQLite database.
5. Newly fetched records appear in chronological order.
6. Multiple pages can be loaded consecutively.
7. Duplicate records are not displayed.
8. Pagination stops when no more pages are available.
9. Network failure shows Retry without losing existing results.
10. Reopening the app retains previously fetched historical results.
11. Scrolling remains smooth with a larger historical dataset.
12. Existing Results filters and UI remain functional.

Run the relevant tests, database verification, and lint checks.

## Project constraints

- Expo SDK 58.
- React Native and Expo Router.
- JavaScript / ESM only. No TypeScript, `.ts`, `.tsx`, or `tsconfig.json`.
- npm only.
- Reuse the existing PCSO Lotto API v2 integration.
- Reuse the existing Results SQLite infrastructure.
- Local-first architecture.
- No backend, authentication, cloud database, or synchronization service.
- No unnecessary dependencies.
- Do not introduce PanelUI.
- Avoid unrelated refactoring.

## Final report

Summarize:

1. Why historical results previously stopped at October.
2. How cursor-based pagination was implemented.
3. How API responses are persisted and merged into SQLite.
4. How duplicate requests and records are prevented.
5. Files changed.
6. Tests and verification results.

**Important:** The Results API integration and SQLite database are already implemented. Extend the existing implementation. Do not rebuild either system.
