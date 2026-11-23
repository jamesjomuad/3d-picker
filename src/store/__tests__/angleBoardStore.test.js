import { useAngleBoardStore } from '../angleBoardStore';

const selection = () => useAngleBoardStore.getState().selectedCells;
const keys = () => [...selection()].sort();

beforeEach(() => {
  useAngleBoardStore.setState({ selectedCells: new Set() });
});

describe('initial state', () => {
  it('starts with an empty selection', () => {
    useAngleBoardStore.setState({ selectedCells: new Set() });

    expect(selection()).toBeInstanceOf(Set);
    expect(selection().size).toBe(0);
  });
});

describe('setSelection', () => {
  it('stores the cells it is given', () => {
    useAngleBoardStore.getState().setSelection(new Set(['0,0', '1,2']));

    expect(keys()).toEqual(['0,0', '1,2']);
    expect(selection().size).toBe(2);
  });

  it('replaces the previous selection instead of adding to it', () => {
    const { setSelection } = useAngleBoardStore.getState();
    setSelection(new Set(['0,0', '0,1']));
    setSelection(new Set(['5,5']));

    expect(keys()).toEqual(['5,5']);
  });

  it('accepts a plain array of keys', () => {
    useAngleBoardStore.getState().setSelection(['2,1', '2,2']);

    expect(selection()).toBeInstanceOf(Set);
    expect(keys()).toEqual(['2,1', '2,2']);
  });

  it('keeps a zero digit cell', () => {
    useAngleBoardStore.getState().setSelection(new Set(['0,1']));

    expect(selection().has('0,1')).toBe(true);
  });

  it('stores its own Set rather than the caller’s reference', () => {
    const cells = new Set(['0,0']);
    useAngleBoardStore.getState().setSelection(cells);
    cells.add('0,1');

    expect(selection().has('0,1')).toBe(false);
  });
});

describe('clearSelection', () => {
  it('empties the selection', () => {
    const { setSelection, clearSelection } = useAngleBoardStore.getState();
    setSelection(new Set(['0,0', '1,1']));
    clearSelection();

    expect(selection().size).toBe(0);
  });

  it('leaves a fresh Set behind', () => {
    const { setSelection, clearSelection } = useAngleBoardStore.getState();
    setSelection(new Set(['0,0']));
    const before = selection();
    clearSelection();

    expect(selection()).not.toBe(before);
  });
});
