import React from 'react';
import { act, create } from 'react-test-renderer';
import { AppState, FlatList, Text } from 'react-native';

import ResultsScreen from '@/app/(tabs)/results';

let mockUseResultsStore;
let mockState;
const mountedRoots = new Set();

jest.mock('expo-router', () => ({
  useFocusEffect: () => {},
}));

jest.mock('@/store/resultsStore', () => ({
  cancelResultsRequests: jest.fn(),
  useResultsStore: (selector) => mockUseResultsStore(selector),
}));

const { cancelResultsRequests: mockCancelResultsRequests } = jest.requireMock(
  '@/store/resultsStore'
);

jest.mock('@/components/results/results-history-row', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  const SESSION_KEYS = ['2pm', '5pm', '9pm'];

  return {
    ResultsHistoryHeader: () => React.createElement(Text, null, 'HEADER'),
    ResultsHistoryRow: ({ group, onSelectRecord }) => {
      const firstRecord = SESSION_KEYS.map((key) => group.sessions[key]).find(Boolean);
      const values = SESSION_KEYS.map((key) => {
        const record = group.sessions[key];
        return record ? record.result.join('') : '—';
      });

      return React.createElement(
        Pressable,
        {
          testID: `row-${group.date}`,
          onPress: () => onSelectRecord(firstRecord),
        },
        React.createElement(Text, null, `${group.date}: ${values.join('|')}`)
      );
    },
  };
});

jest.mock('@/components/results/results-detail-sheet', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    ResultsDetailSheet: ({ visible, record }) =>
      React.createElement(
        Text,
        { testID: 'detail-sheet' },
        visible ? `DETAIL:${record?.id}` : 'NO_DETAIL'
      ),
  };
});

jest.mock('@/components/ui/app-icon', () => ({ AppIcon: () => null }));

jest.mock('@/components/ui/button', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  return {
    Button: ({ children, onPress, disabled }) =>
      React.createElement(
        Pressable,
        { onPress, disabled, accessibilityRole: 'button' },
        React.createElement(Text, null, children)
      ),
  };
});

jest.mock('@/components/themed-text', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    ThemedText: ({ children }) => React.createElement(Text, null, children),
  };
});

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#ffffff',
    backgroundElement: '#f1f1f1',
    border: '#cccccc',
    primary: '#007aff',
    primaryText: '#ffffff',
    text: '#111111',
    textSecondary: '#666666',
  }),
}));

jest.mock('@/hooks/use-screen-insets', () => ({
  useScreenInsets: () => ({ contentPadding: {}, contentWidth: 360 }),
}));

function makeRecord(id, drawDate, gameCode, digits) {
  return {
    id,
    sourceId: id,
    drawDate,
    drawTime: null,
    gameCode,
    gameName: '3D Lotto',
    result: digits,
    sources: ['latest'],
  };
}

function makeState(overrides = {}) {
  return {
    records: [
      makeRecord('2pm-1', '2026-11-27', '3d_lotto_2pm', ['0', '3', '7']),
      makeRecord('5pm-1', '2026-11-27', '3d_lotto_5pm', ['0', '0', '5']),
      makeRecord('2pm-2', '2026-11-26', '3d_lotto_2pm', ['1', '2', '3']),
      makeRecord('5pm-2', '2026-11-26', '3d_lotto_5pm', ['4', '5', '6']),
      makeRecord('9pm-2', '2026-11-26', '3d_lotto_9pm', ['7', '8', '9']),
    ],
    drawDates: ['2026-11-27', '2026-11-26'],
    dateFilter: 'all',
    isLoaded: true,
    isRefreshing: false,
    isLoadingMore: false,
    hasMore: true,
    nextCursor: null,
    gameCodes: ['3d_lotto_2pm'],
    historyCursors: {},
    displayLimit: 200,
    lastSyncAt: '2026-11-27T10:00:00.000Z',
    totalCount: 5,
    error: null,
    olderError: null,
    emptyOlderPage: false,
    load: jest.fn(),
    setDateFilter: jest.fn(),
    refresh: jest.fn(),
    loadOlder: jest.fn(),
    showMoreLocal: jest.fn(),
    ...overrides,
  };
}

function textContent(node) {
  const searchRoot = node.root ?? node;
  return searchRoot
    .findAllByType(Text)
    .map((textNode) => {
      const children = textNode.props.children;
      return Array.isArray(children) ? children.join('') : String(children ?? '');
    })
    .join('');
}

function findPressableByLabel(root, label) {
  return root.root.findAll(
    (candidate) =>
      candidate.props?.accessibilityRole === 'button' &&
      typeof candidate.props.onPress === 'function' &&
      textContent(candidate) === label
  )[0];
}

function findRowByTestId(root, testID) {
  return root.root
    .findAllByProps({ testID })
    .find((candidate) => typeof candidate.props.onPress === 'function');
}

function renderScreen() {
  let root;
  act(() => {
    root = create(React.createElement(ResultsScreen));
  });
  mountedRoots.add(root);
  return root;
}

describe('Results screen SQLite integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({
      remove: jest.fn(),
    }));
    mockState = makeState();
    mockUseResultsStore = jest.fn((selector) => selector(mockState));
  });

  afterEach(() => {
    for (const root of mountedRoots) {
      act(() => root.unmount());
    }
    mountedRoots.clear();
    jest.restoreAllMocks();
  });

  it('renders cached records grouped into three sessions and refreshes after hydration', () => {
    const coldState = makeState({
      records: [],
      drawDates: [],
      isLoaded: false,
      totalCount: 0,
    });
    mockState = coldState;

    const root = renderScreen();

    expect(coldState.load).toHaveBeenCalledTimes(1);
    expect(coldState.refresh).not.toHaveBeenCalled();

    mockState = makeState({
      load: coldState.load,
      refresh: coldState.refresh,
    });
    act(() => {
      root.update(React.createElement(ResultsScreen));
    });

    expect(coldState.refresh).toHaveBeenCalledTimes(1);

    const firstRow = findRowByTestId(root, 'row-2026-11-27');
    const label = textContent(firstRow);
    expect(label).toContain('037');
    expect(label).toContain('005');
    expect(label).toContain('—');

    expect(findRowByTestId(root, 'row-2026-11-26')).toBeDefined();
  });

  it('opens details for a selected draw and applies date filters', () => {
    const root = renderScreen();

    const row = findRowByTestId(root, 'row-2026-11-27');
    act(() => row.props.onPress());
    expect(root.root.findByProps({ testID: 'detail-sheet' }).props.children).toBe('DETAIL:2pm-1');

    const dateChip = findPressableByLabel(root, '2026-11-27');
    act(() => dateChip.props.onPress());
    expect(mockState.setDateFilter).toHaveBeenCalledWith('2026-11-27');

    mockState = makeState({
      dateFilter: '2026-11-27',
      setDateFilter: mockState.setDateFilter,
    });
    act(() => {
      root.update(React.createElement(ResultsScreen));
    });

    const clearChip = findPressableByLabel(root, 'Clear filter');
    act(() => clearChip.props.onPress());
    expect(mockState.setDateFilter).toHaveBeenLastCalledWith('all');
  });

  it('loads older pages only for the unfiltered history view', () => {
    const root = renderScreen();

    const list = root.root.findByType(FlatList);
    act(() => list.props.onEndReached());
    expect(mockState.loadOlder).toHaveBeenCalledTimes(1);

    mockState = makeState({
      loadOlder: mockState.loadOlder,
      dateFilter: '2026-11-27',
    });
    act(() => {
      root.update(React.createElement(ResultsScreen));
    });
    act(() => list.props.onEndReached());
    expect(mockState.loadOlder).toHaveBeenCalledTimes(1);
  });

  it('reveals cached rows when network history is exhausted', () => {
    mockState = makeState({ hasMore: false, totalCount: 600 });
    const root = renderScreen();

    const list = root.root.findByType(FlatList);
    act(() => list.props.onEndReached());

    expect(mockState.showMoreLocal).toHaveBeenCalledTimes(1);
    expect(mockState.loadOlder).not.toHaveBeenCalled();
  });

  it('offers a footer action to reveal cached rows after network history is exhausted', () => {
    mockState = makeState({ hasMore: false, totalCount: 600 });
    const root = renderScreen();

    const showMore = findPressableByLabel(root, 'Show more saved');
    expect(showMore).toBeDefined();
    act(() => showMore.props.onPress());

    expect(mockState.showMoreLocal).toHaveBeenCalledTimes(1);
  });

  it('does not auto-load another page after an empty page', () => {
    mockState = makeState({ emptyOlderPage: true });
    const root = renderScreen();

    const list = root.root.findByType(FlatList);
    act(() => list.props.onEndReached());
    expect(mockState.loadOlder).not.toHaveBeenCalled();
  });

  it('shows Retry for a failed older page', () => {
    mockState = makeState({
      olderError: 'Could not load older results. Saved results are unchanged.',
    });
    const root = renderScreen();

    expect(textContent(root)).toContain(mockState.olderError);
    const retry = findPressableByLabel(root, 'Retry');
    expect(retry).toBeDefined();
    act(() => retry.props.onPress());
    expect(mockState.loadOlder).toHaveBeenCalledTimes(1);
  });

  it('shows Continue for an empty page with more history', () => {
    mockState = makeState({ emptyOlderPage: true });
    const root = renderScreen();

    expect(textContent(root)).toContain('No new draws in this page');
    const continueButton = findPressableByLabel(root, 'Continue');
    expect(continueButton).toBeDefined();
    act(() => continueButton.props.onPress());
    expect(mockState.loadOlder).toHaveBeenCalledTimes(1);
  });

  it('shows the end state when no more history remains', () => {
    mockState = makeState({ hasMore: false });
    const root = renderScreen();

    expect(textContent(root)).toContain('End of available history');
  });

  it('cancels in-flight requests when the app goes to the background', () => {
    let listener;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, nextListener) => {
      listener = nextListener;
      return { remove: jest.fn() };
    });

    renderScreen();
    act(() => listener('background'));

    expect(mockCancelResultsRequests).toHaveBeenCalledTimes(1);
  });
});
