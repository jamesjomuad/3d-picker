/**
 * Focused render-isolation checks for Collection selection mode.
 *
 * Selection state lives outside the persisted basket. Each row subscribes to
 * its own checked flag, so one toggle must not re-render sibling rows.
 */

import { Profiler, act } from 'react';
import TestRenderer from 'react-test-renderer';

import { CollectionRow } from '@/components/basket/collection-row';
import { useCollectionSelectionStore } from '@/store/collectionSelectionStore';

jest.mock('@/components/themed-text', () => ({
  ThemedText: ({ children }) => children,
}));

jest.mock('@/components/ui/app-icon', () => ({
  AppIcon: () => null,
}));

jest.mock('@/components/ui/swipe-action-row', () => ({
  SwipeActionRow: ({ children }) => children,
  closeAllSwipeActions: jest.fn(),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#ffffff',
    backgroundElement: '#f0f0f3',
    backgroundSelected: '#e0e1e6',
    border: '#d8d8db',
    destructive: '#ff453a',
    primary: '#f48c06',
    primaryText: '#ffffff',
    text: '#000000',
    textSecondary: '#60646c',
  }),
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

const first = {
  id: 'item-first',
  digits: '074',
  path: [
    { row: 1, column: 1 },
    { row: 2, column: 3 },
    { row: 3, column: 4 },
  ],
  addedAt: new Date(2026, 10, 23, 20, 35).toISOString(),
};

const second = {
  id: 'item-second',
  digits: '638',
  path: [
    { row: 4, column: 2 },
    { row: 5, column: 6 },
    { row: 6, column: 7 },
  ],
  addedAt: new Date(2026, 10, 23, 20, 36).toISOString(),
};

beforeEach(() => {
  useCollectionSelectionStore.setState({ selectionMode: false, selectedIds: new Set() });
});

describe('Collection selection render isolation', () => {
  it('does not re-render rows when selection mode toggles', () => {
    const renders = { first: 0, second: 0 };
    let tree;

    act(() => {
      tree = TestRenderer.create(
        <>
          <Profiler id="first" onRender={() => (renders.first += 1)}>
            <CollectionRow entry={first} width={320} onSelect={jest.fn()} />
          </Profiler>
          <Profiler id="second" onRender={() => (renders.second += 1)}>
            <CollectionRow entry={second} width={320} onSelect={jest.fn()} />
          </Profiler>
        </>
      );
    });

    expect(renders).toEqual({ first: 1, second: 1 });

    act(() => {
      useCollectionSelectionStore.getState().startSelection();
    });
    expect(renders).toEqual({ first: 1, second: 1 });

    act(() => {
      useCollectionSelectionStore.getState().cancelSelection();
    });
    expect(renders).toEqual({ first: 1, second: 1 });

    act(() => tree.unmount());
  });

  it('re-renders only the toggled row', () => {
    const renders = { first: 0, second: 0 };
    const onSelect = jest.fn();
    const onRequestRemove = jest.fn();
    let tree;

    act(() => {
      useCollectionSelectionStore.getState().startSelection();
      tree = TestRenderer.create(
        <>
          <Profiler id="first" onRender={() => (renders.first += 1)}>
            <CollectionRow
              entry={first}
              width={320}
              onSelect={onSelect}
              onRequestRemove={onRequestRemove}
            />
          </Profiler>
          <Profiler id="second" onRender={() => (renders.second += 1)}>
            <CollectionRow
              entry={second}
              width={320}
              onSelect={onSelect}
              onRequestRemove={onRequestRemove}
            />
          </Profiler>
        </>
      );
    });

    expect(renders).toEqual({ first: 1, second: 1 });

    act(() => {
      useCollectionSelectionStore.getState().toggleSelected('item-first');
    });

    expect(renders.first).toBe(2);
    expect(renders.second).toBe(1);

    act(() => tree.unmount());
  });

  it('toggles favorite by stable ID without selecting the row', () => {
    const onSelect = jest.fn();
    const onToggleFavorite = jest.fn();
    let tree;

    act(() => {
      tree = TestRenderer.create(
        <CollectionRow
          entry={first}
          width={320}
          onSelect={onSelect}
          onToggleFavorite={onToggleFavorite}
        />
      );
    });

    const star = tree.root.findByProps({ accessibilityLabel: 'Add 074 to favorites' });
    act(() => {
      star.props.onPress({ stopPropagation: jest.fn() });
    });

    expect(onToggleFavorite).toHaveBeenCalledWith('item-first', true);
    expect(onSelect).not.toHaveBeenCalled();

    act(() => tree.unmount());
  });
});
