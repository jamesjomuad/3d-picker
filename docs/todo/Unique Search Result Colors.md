## 4. Unique Search Result Colors

Every matching path must have its own distinct color.

Requirements:

1. Create a predefined, visually distinguishable color palette suitable for the Angle Board's light and dark themes.
2. Assign colors deterministically based on result order.
3. All cells belonging to the same matching path must use the same color.
4. Different matching paths must use different colors until the palette is exhausted.
5. Reuse palette colors only after all available colors have been assigned.
6. Display a matching color indicator beside each result in the results list.
7. Tapping a result should emphasize its corresponding path without removing other search results.

### Overlapping paths

A cell may belong to multiple matching paths.

Do not simply overwrite its color with the last matching path's color.

Use a visual treatment that preserves multiple path identities:

- Split-color backgrounds, colored segments, or another clear multi-color indicator.
- Keep the treatment readable at the existing cell size.
- Avoid changing the grid dimensions.

### Selection and search interaction

- Search highlights must remain independent of manual cell selection.
- Preserve existing selected-cell styling.
- Clearing the search must remove all search highlights.
- Changing the query must recalculate colors and matching paths.
- Do not modify the existing drag-selection implementation.

### Architecture

Keep the palette and color assignment logic separate from the search algorithm and UI components.

Suggested files:

- `search-color-palette.js`
- `search-highlight-utils.js`

Do not hardcode colors inside individual cell components.
