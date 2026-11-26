import { act } from 'react';
import { Alert } from 'react-native';
import TestRenderer from 'react-test-renderer';

import { AngleBoard } from '../angle-board';
import { useAngleBoardEditing } from '../hooks/use-angle-board-editing';
import {
  exceedsTapTolerance,
  getGestureOutcome,
  isDoubleTap,
} from '../hooks/use-angle-board-gestures';
import { SelectedCellsCard } from '../selected-cells-card';

import { computeFill } from '@/utils/board-fill';
import { HEADER_HEIGHT, HEADER_WIDTH } from '@/utils/board-layout';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));

// React 19 wants this flag before `act` runs.
global.IS_REACT_ACT_ENVIRONMENT = true;

const GRID = [
  [6, 0, 3, 8],
  [4, 2, 7, 5],
  [1, 8, 9, 4],
];
const ROWS = GRID.length;
const COLS = GRID[0].length;
const CELL_COUNT = ROWS * COLS;

/** A drag the gesture layer would produce, for testing what a drag means. */
const drag = (startRow, startCol, endRow, endCol, mode = 'cell') => ({
  startRow,
  startCol,
  endRow,
  endCol,
  mode,
});

const render = (props) => {
  let tree;
  act(() => {
    tree = TestRenderer.create(<AngleBoard {...props} />);
  });
  return tree;
};

/** Composite instances of a named component, `memo` wrappers included. */
const findAllByName = (tree, name) =>
  tree.root.findAll((node) => {
    const { type } = node;
    if (typeof type === 'function') return type.name === name;
    if (type && typeof type === 'object') return type.type?.name === name;
    return false;
  });

/** Host tree: the wrapper the board measures, the container, and the row views. */
const hostRows = (tree) => {
  const wrapper = tree.toJSON();
  const container = wrapper.children[0];
  return { wrapper, container, rows: container.children[0].children };
};

/** Every string a rendered tree prints, in order. */
const printedText = (tree) => {
  const walk = (node) => {
    if (node == null) return [];
    if (Array.isArray(node)) return node.flatMap(walk);
    if (typeof node === 'string') return [node];
    return walk(node.children);
  };
  return walk(tree.toJSON());
};

const CELL_SIZE = 50;

/** Measure the board so touch coordinates map to known cells. */
const layoutBoard = (tree) => {
  act(() => {
    hostRows(tree).wrapper.props.onLayout({
      nativeEvent: { layout: { width: HEADER_WIDTH + COLS * CELL_SIZE, height: 300 } },
    });
  });
  return hostRows(tree).container.props;
};

/** Center of a grid cell, in container coordinates. */
const cellPoint = (row, col) => ({
  x: HEADER_WIDTH + col * CELL_SIZE + CELL_SIZE / 2,
  y: HEADER_HEIGHT + row * CELL_SIZE + CELL_SIZE / 2,
});

/** Center of a row-header or column-header cell. */
const rowHeaderPoint = (row) => ({ x: HEADER_WIDTH / 2, y: cellPoint(row, 0).y });
const colHeaderPoint = (col) => ({ x: cellPoint(0, col).x, y: HEADER_HEIGHT / 2 });

/** PanResponder event with the touch history its wrappers expect. */
const touchEvent = ({ x, y }, timestamp = 1) => {
  const touch = { identifier: 0, locationX: x, locationY: y, pageX: x, pageY: y, target: null };
  return {
    nativeEvent: { locationX: x, locationY: y, touches: [touch], changedTouches: [touch] },
    touchHistory: {
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: timestamp,
      touchBank: [{
        touchActive: true,
        currentTimeStamp: timestamp,
        currentPageX: x,
        currentPageY: y,
        previousPageX: x,
        previousPageY: y,
        startPageX: x,
        startPageY: y,
        startTimeStamp: timestamp,
      }],
    },
  };
};

/** Call a responder callback that may update React state. */
const fire = (handler, event) => {
  let result;
  act(() => {
    result = handler(event);
  });
  return result;
};

describe('AngleBoard — read-only mode', () => {
  it('renders a cell for every grid value', () => {
    const tree = render({ grid: GRID });
    const cells = findAllByName(tree, 'AngleBoardCell');

    expect(cells).toHaveLength(CELL_COUNT);
    expect(cells.map((cell) => cell.props.value)).toEqual(GRID.flat());
    expect(findAllByName(tree, 'AngleBoardEditCell')).toHaveLength(0);
    tree.unmount();
  });

  it('labels columns A-D and rows 1-3', () => {
    const tree = render({ grid: GRID });
    const labels = findAllByName(tree, 'AngleBoardHeaderCell').map((header) =>
      String(header.props.label)
    );

    // Column labels come first (the corner cell is blank chrome), then one per row.
    expect(labels.slice(0, COLS)).toEqual(['A', 'B', 'C', 'D']);
    expect(labels.slice(COLS)).toEqual(['1', '2', '3']);
    tree.unmount();
  });

  it('marks the cells the owner reports as selected', () => {
    const tree = render({ grid: GRID, selection: new Set(['0,0', '2,3']) });
    const selected = findAllByName(tree, 'AngleBoardCell').filter((cell) => cell.props.isSelected);

    expect(selected).toHaveLength(2);
    expect(selected.map((cell) => cell.props.value)).toEqual([6, 4]);
    tree.unmount();
  });

  it('starts every cell at a usable size before any layout event', () => {
    const tree = render({ grid: GRID });
    const [cell] = findAllByName(tree, 'AngleBoardCell');

    expect(cell.props.cellSize).toBeGreaterThan(0);
    tree.unmount();
  });

  it('makes the container the only touch target', () => {
    const tree = render({ grid: GRID });
    const { wrapper, container, rows } = hostRows(tree);

    // The wrapper is what gets measured; the container is what the gesture
    // responder is bound to, so it must stay interactive...
    expect(typeof wrapper.props.onLayout).toBe('function');
    expect(container.props.pointerEvents).toBeUndefined();
    // ...while every row stays transparent. React Native reports gesture
    // coordinates relative to the view that was touched, so a row that accepted
    // touches would move the origin and break the cell mapping. This is the
    // contract behind `docs/reports/Drag Selection - Root Cause and Fix.md`.
    expect(rows).toHaveLength(1 + ROWS);
    expect(rows.every((row) => row.props.pointerEvents === 'none')).toBe(true);
    tree.unmount();
  });

  it('does not report a selection just by rendering', () => {
    const onSelectionChange = jest.fn();
    const tree = render({ grid: GRID, onSelectionChange });

    expect(onSelectionChange).not.toHaveBeenCalled();
    tree.unmount();
  });
});

describe('AngleBoard — editable mode', () => {
  it('swaps the display cells for editable ones', () => {
    const tree = render({ grid: GRID, editable: true, onCellChange: jest.fn() });

    expect(findAllByName(tree, 'AngleBoardEditCell')).toHaveLength(CELL_COUNT);
    expect(findAllByName(tree, 'AngleBoardCell')).toHaveLength(0);
    tree.unmount();
  });

  it('keeps every row transparent, because the board reads the touches', () => {
    const tree = render({ grid: GRID, editable: true, onCellChange: jest.fn() });
    const { rows } = hostRows(tree);

    // Same contract as read-only mode: a cell that took the touch would take the
    // gesture origin, and a tap or a fill could no longer be placed on the board.
    expect(rows.every((row) => row.props.pointerEvents === 'none')).toBe(true);
    const [cell] = findAllByName(tree, 'AngleBoardEditCell');
    expect(cell.props.onPress).toBeUndefined();
    expect(cell.props.onTouchStart).toBeUndefined();
    tree.unmount();
  });

  it('opens the field on a one-cell drag', () => {
    expect(
      getGestureOutcome({
        grid: GRID,
        selection: new Set(),
        drag: drag(1, 2, 1, 2, 'cell'),
        editable: true,
      })
    ).toEqual({ type: 'tap', cell: { row: 1, col: 2 } });
  });

  it('fills on a drag that spans cells, and on a whole row', () => {
    const block = getGestureOutcome({
      grid: GRID,
      selection: new Set(),
      drag: drag(0, 0, 1, 1, 'cell'),
      editable: true,
    });
    expect(block.type).toBe('fill');
    expect(block.target).toEqual({ startRow: 0, startCol: 0, endRow: 1, endCol: 1, mode: 'cell' });
    // Nothing selected to take a pattern from, so the block is its own source:
    // filling with itself changes no digits.
    expect(block.source).toEqual(block.target);

    const row = getGestureOutcome({
      grid: GRID,
      selection: new Set(),
      drag: drag(1, 1, 2, 1, 'row'),
      editable: true,
    });
    expect(row.type).toBe('fill');
    // A row drag covers the whole width, so it fills rather than opening a field.
    expect(row.target).toEqual({ startRow: 1, startCol: 1, endRow: 2, endCol: 1, mode: 'row' });
  });

  it('takes the fill pattern from a selected block the drag touches', () => {
    // Selected: A1:B1 (row 0, columns 0-1). Dragged: rows 0-1 of those columns,
    // which grows the selection down — Excel repeats the selected row.
    const outcome = getGestureOutcome({
      grid: GRID,
      selection: new Set(['0,0', '0,1']),
      drag: drag(0, 0, 1, 1, 'cell'),
      editable: true,
    });

    expect(outcome.type).toBe('fill');
    expect(outcome.source).toEqual({ startRow: 0, startCol: 0, endRow: 0, endCol: 1, mode: 'cell' });
    expect(computeFill(GRID, outcome.source, outcome.target)).toEqual({
      '1,0': 6,
      '1,1': 0,
    });
  });

  it('selects cells the way it does when read-only', () => {
    const outcome = getGestureOutcome({
      grid: GRID,
      selection: new Set(),
      drag: drag(0, 0, 0, 1, 'cell'),
      editable: false,
    });

    expect(outcome.type).toBe('selection');
    expect([...outcome.cells].sort()).toEqual(['0,0', '0,1']);
  });
});

describe('double-tap activation', () => {
  const pendingTap = { key: 'cell:1:2', time: 1000, x: 40, y: 60 };

  it('accepts a second tap on the same target inside the window', () => {
    expect(isDoubleTap(pendingTap, 'cell:1:2', 1200)).toBe(true);
  });

  it('rejects different targets and taps outside the window', () => {
    expect(isDoubleTap(pendingTap, 'cell:1:3', 1200)).toBe(false);
    expect(isDoubleTap(pendingTap, 'cell:1:2', 1400)).toBe(false);
    expect(isDoubleTap(null, 'cell:1:2', 1200)).toBe(false);
  });

  it('treats small movement as a tap and larger movement as a scroll', () => {
    expect(exceedsTapTolerance({ x: 40, y: 60 }, { x: 45, y: 60 })).toBe(false);
    expect(exceedsTapTolerance({ x: 40, y: 60 }, { x: 60, y: 60 })).toBe(true);
  });
});

describe('AngleBoard — gesture negotiation', () => {
  let nowSpy;

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('leaves a single tap to the scroll parent without selecting', () => {
    const onSelectionChange = jest.fn();
    const tree = render({ grid: GRID, onSelectionChange });
    const props = layoutBoard(tree);

    expect(fire(props.onStartShouldSetResponderCapture, touchEvent(cellPoint(0, 0)))).toBe(false);
    expect(onSelectionChange).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('cancels a pending tap when the touch moves like a scroll', () => {
    const onSelectionChange = jest.fn();
    const tree = render({ grid: GRID, onSelectionChange });
    const props = layoutBoard(tree);
    const start = cellPoint(0, 0);

    fire(props.onStartShouldSetResponderCapture, touchEvent(start, 1));
    fire(
      props.onMoveShouldSetResponderCapture,
      touchEvent({ x: start.x + 30, y: start.y + 10 }, 2)
    );

    expect(fire(props.onStartShouldSetResponderCapture, touchEvent(start, 3))).toBe(false);
    expect(onSelectionChange).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('selects one cell on the second tap', () => {
    const onSelectionChange = jest.fn();
    const tree = render({ grid: GRID, onSelectionChange });
    const props = layoutBoard(tree);
    const event = touchEvent(cellPoint(1, 2));

    expect(fire(props.onStartShouldSetResponderCapture, event)).toBe(false);
    expect(fire(props.onStartShouldSetResponderCapture, event)).toBe(true);
    fire(props.onResponderGrant, event);
    fire(props.onResponderRelease, event);

    expect(onSelectionChange).toHaveBeenLastCalledWith(new Set(['1,2']));
    act(() => tree.unmount());
  });

  it('extends a double tap into a rectangular selection', () => {
    const onSelectionChange = jest.fn();
    const tree = render({ grid: GRID, onSelectionChange });
    const props = layoutBoard(tree);
    const start = touchEvent(cellPoint(0, 0), 1);

    fire(props.onStartShouldSetResponderCapture, start);
    fire(props.onStartShouldSetResponderCapture, start);
    fire(props.onResponderGrant, start);
    fire(props.onResponderMove, touchEvent(cellPoint(1, 1), 2));
    fire(props.onResponderRelease, touchEvent(cellPoint(1, 1), 3));

    expect(onSelectionChange).toHaveBeenLastCalledWith(
      new Set(['0,0', '0,1', '1,0', '1,1'])
    );
    act(() => tree.unmount());
  });

  it('selects a whole row or column from a header double tap', () => {
    const onSelectionChange = jest.fn();
    const tree = render({ grid: GRID, onSelectionChange });
    const props = layoutBoard(tree);
    const row = touchEvent(rowHeaderPoint(1), 1);

    fire(props.onStartShouldSetResponderCapture, row);
    fire(props.onStartShouldSetResponderCapture, row);
    fire(props.onResponderGrant, row);
    fire(props.onResponderRelease, row);

    expect(onSelectionChange).toHaveBeenLastCalledWith(
      new Set(['1,0', '1,1', '1,2', '1,3'])
    );

    const col = touchEvent(colHeaderPoint(2), 4);
    fire(props.onStartShouldSetResponderCapture, col);
    fire(props.onStartShouldSetResponderCapture, col);
    fire(props.onResponderGrant, col);
    fire(props.onResponderRelease, col);

    expect(onSelectionChange).toHaveBeenLastCalledWith(
      new Set(['0,2', '1,2', '2,2'])
    );
    act(() => tree.unmount());
  });

  it('opens the editor on an editable double tap', () => {
    const tree = render({ grid: GRID, editable: true, onCellChange: jest.fn() });
    const props = layoutBoard(tree);
    const event = touchEvent(cellPoint(1, 2));

    fire(props.onStartShouldSetResponderCapture, event);
    fire(props.onStartShouldSetResponderCapture, event);
    fire(props.onResponderGrant, event);
    fire(props.onResponderRelease, event);

    const editing = findAllByName(tree, 'AngleBoardEditCell').find(
      (cell) => cell.props.isEditing
    );
    expect(editing.props.editValue).toBe('');
    act(() => tree.unmount());
  });
});

describe('AngleBoard — editing the selected cell', () => {
  // The editor lives in a hook the board owns, and its only door is the gesture,
  // so this drives the hook directly through a render-less harness.
  let editor = null;

  function EditorHarness({ grid, onCellChange }) {
    editor = useAngleBoardEditing({ grid, onCellChange });
    return null;
  }

  const openEditor = (props) => {
    let tree;
    act(() => {
      tree = TestRenderer.create(<EditorHarness {...props} />);
    });
    return tree;
  };

  beforeEach(() => {
    editor = null;
  });

  it('reports a typed digit as a change map and closes', () => {
    const onCellChange = jest.fn();
    const tree = openEditor({ grid: GRID, onCellChange });

    act(() => editor.beginEdit(0, 0));
    expect(editor.editingCell).toEqual({ row: 0, col: 0 });
    // The field opens empty so typing replaces the digit directly.
    expect(editor.editValue).toBe('');

    act(() => editor.setEditValue('9'));
    act(() => editor.commitEdit());

    expect(onCellChange).toHaveBeenCalledWith({ '0,0': 9 });
    expect(editor.editingCell).toBeNull();
    tree.unmount();
  });

  it('rejects a value that is not a digit without reporting a change', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onCellChange = jest.fn();
    const tree = openEditor({ grid: GRID, onCellChange });

    act(() => editor.beginEdit(0, 1));
    act(() => editor.setEditValue('x'));
    act(() => editor.commitEdit());

    expect(onCellChange).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Invalid Value', 'Please enter a digit from 0 to 9');
    expect(editor.editingCell).toBeNull();
    alert.mockRestore();
    tree.unmount();
  });

  it('closes without reporting anything when the board cancels the edit', () => {
    const onCellChange = jest.fn();
    const tree = openEditor({ grid: GRID, onCellChange });

    act(() => editor.beginEdit(2, 3));
    act(() => editor.cancelEdit());

    expect(onCellChange).not.toHaveBeenCalled();
    expect(editor.editingCell).toBeNull();
    tree.unmount();
  });
});

describe('AngleBoard — header highlights', () => {
  const headerFlags = (tree) => ({
    rows: findAllByName(tree, 'AngleBoardRowHeader').map((header) => header.props.highlighted),
    cols: findAllByName(tree, 'AngleBoardHeaderCell')
      .slice(0, COLS)
      .map((header) => header.props.highlighted),
  });

  it('lights the axes of a fully selected row', () => {
    const tree = render({ grid: GRID, selection: new Set([0, 1, 2, 3].map((col) => `1,${col}`)) });

    expect(headerFlags(tree)).toEqual({
      rows: [false, true, false],
      cols: [true, true, true, true],
    });
    tree.unmount();
  });

  it('lights the touched axes of a partial selection', () => {
    // Pre-existing engine rule: a header is lit when its axis holds any
    // selected cell, so a two-cell drag still marks that row and those columns.
    const tree = render({ grid: GRID, selection: new Set(['1,0', '1,1']) });

    expect(headerFlags(tree)).toEqual({
      rows: [false, true, false],
      cols: [true, true, false, false],
    });
    tree.unmount();
  });

  it('leaves every header alone with nothing selected', () => {
    const tree = render({ grid: GRID });

    expect(headerFlags(tree)).toEqual({
      rows: [false, false, false],
      cols: [false, false, false, false],
    });
    tree.unmount();
  });
});

describe('SelectedCellsCard', () => {
  const renderCard = (props) => {
    let tree;
    act(() => {
      tree = TestRenderer.create(<SelectedCellsCard {...props} />);
    });
    return tree;
  };

  it('asks the user to select something while the board is empty', () => {
    const tree = renderCard({ grid: GRID, selection: new Set() });
    const text = printedText(tree);

    expect(text).toContain('Double-tap or double-tap and drag on the board to select cells.');
    expect(text).not.toContain('Range: ');
    tree.unmount();
  });

  it('shows one chip per selected cell, in row-major order', () => {
    const tree = renderCard({ grid: GRID, selection: new Set(['0,0', '0,1', '0,2', '0,3']) });
    const digits = printedText(tree).filter((value) => /^[0-9]$/.test(value));

    // Chips first, then the single-digit Insights stats row: 4 cells,
    // 4 unique digits, 0 repeated, 0 combinations (a straight row cannot
    // bend), 0 start cells.
    expect(digits).toEqual(['6', '0', '3', '8', '4', '4', '0', '0', '0']);
    tree.unmount();
  });

  it('prints the spreadsheet coordinates and range of the selection', () => {
    const tree = renderCard({ grid: GRID, selection: new Set(['0,0', '0,1', '0,2', '0,3']) });
    const text = printedText(tree);

    expect(text).toContain('A1  B1  C1  D1');
    expect(text).toContain('Range: ');
    expect(text).toContain('A1:D1');
    expect(text).toContain('Entire row');
    expect(text).not.toContain('Double-tap or double-tap and drag on the board to select cells.');
    tree.unmount();
  });
});
