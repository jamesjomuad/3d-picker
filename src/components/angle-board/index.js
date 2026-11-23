/**
 * Angle Board — public surface
 *
 * Screens import the board and its summary card from here and nothing deeper:
 * the grid, cells, header chrome, overlays and hooks inside this folder are
 * private parts of the component. Shared data rules (the selection engine, cell
 * references, layout geometry, validation) are utilities under `src/utils`, not
 * re-exported here, so a screen that needs them asks for them by name.
 *
 * ```jsx
 * <AngleBoard grid={board.grid} selection={selectedCells} onSelectionChange={setSelection} />
 * <SelectedCellsCard grid={board.grid} selection={selectedCells} />
 * ```
 */

export { AngleBoard } from './angle-board';
export { SelectedCellsCard } from './selected-cells-card';
