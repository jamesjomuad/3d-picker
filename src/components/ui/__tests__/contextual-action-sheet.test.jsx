/**
 * Focused checks for the reusable contextual action sheet.
 *
 * The sheet is self-contained and content-sized. These tests mock the
 * animation and gesture plumbing so layout and dismissal contracts stay
 * visible without pulling in native drivers.
 */

import { act, createRef } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import TestRenderer from 'react-test-renderer';

import { ContextualActionSheet } from '@/components/ui/contextual-action-sheet';

jest.mock('react-native', () => {
  const React = require('react');
  const actual = jest.requireActual('react-native');

  function MockModal({ children, visible, onRequestClose }) {
    return React.createElement(
      actual.View,
      { testID: 'contextual-sheet-modal', visible, onRequestClose },
      children
    );
  }

  return {
    Modal: MockModal,
    Platform: actual.Platform,
    Pressable: actual.Pressable,
    ScrollView: actual.ScrollView,
    StyleSheet: actual.StyleSheet,
    Text: actual.Text,
    View: actual.View,
    useWindowDimensions: () => ({ width: 400, height: 800 }),
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');

  const Animated = {
    View: React.forwardRef(function MockAnimatedView(props, ref) {
      return React.createElement(View, { ...props, ref });
    }),
  };
  Animated.View.displayName = 'MockAnimatedView';

  return {
    __esModule: true,
    default: Animated,
    Extrapolation: { CLAMP: 'clamp' },
    interpolate: jest.fn(() => 0),
    runOnJS: jest.fn((fn) => fn),
    useAnimatedStyle: jest.fn((factory) => factory()),
    useSharedValue: (initial) => {
      const ref = React.useRef({ value: initial });
      return {
        get: () => ref.current.value,
        set: (next) => {
          ref.current.value = typeof next === 'function' ? next() : next;
        },
      };
    },
    withSpring: jest.fn((next) => next),
    withTiming: jest.fn((next, _config, callback) => {
      callback?.();
      return next;
    }),
  };
});

jest.mock('react-native-gesture-handler', () => {
  function MockGestureDetector({ children }) {
    return children;
  }

  return {
    GestureDetector: MockGestureDetector,
    usePanGesture: jest.fn(() => ({})),
  };
});

jest.mock('@/components/ui/app-icon', () => {
  const React = require('react');
  const { View } = require('react-native');

  function MockAppIcon({ name, tone }) {
    return React.createElement(View, { testID: 'app-icon', name, tone });
  }

  return { AppIcon: MockAppIcon };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 20, left: 0 }),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#000000',
    backgroundElement: '#222222',
    border: '#333333',
    destructive: '#ff0000',
    primaryText: '#ffffff',
    text: '#eeeeee',
  }),
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

function textValues(tree) {
  return tree.root.findAllByType(Text).map((node) => node.props.children);
}

function actionByLabel(tree, label) {
  return tree.root.findByProps({ accessibilityLabel: label });
}

function buttonLabels(tree) {
  return Array.from(
    new Set(
      tree.root
        .findAllByProps({ accessibilityRole: 'button' })
        .map((node) => node.props.accessibilityLabel)
    )
  );
}

const actions = [
  {
    id: 'select-all',
    label: 'Select All',
    icon: 'checkmark',
    onPress: jest.fn(),
  },
  {
    id: 'remove-selected',
    label: 'Remove Selected',
    icon: 'trash',
    onPress: jest.fn(),
    destructive: true,
  },
  {
    id: 'disabled-action',
    label: 'Disabled Action',
    onPress: jest.fn(),
    disabled: true,
  },
];

beforeEach(() => {
  actions.forEach((action) => action.onPress.mockClear());
});

describe('ContextualActionSheet', () => {
  it('renders the live title and ordered actions without fixed height', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(
        <ContextualActionSheet
          visible
          title="2 picks selected"
          actions={actions}
          onCancel={jest.fn()}
        />
      );
    });

    expect(textValues(tree)).toContain('2 picks selected');
    expect(buttonLabels(tree)).toEqual(['Select All', 'Remove Selected', 'Disabled Action', 'Cancel']);

    expect(tree.root.findByProps({ testID: 'contextual-sheet-modal' }).props.visible).toBe(true);

    const root = tree.root.findByProps({ testID: 'contextual-action-sheet-root' });
    const rootStyle = StyleSheet.flatten(root.props.style);
    expect(rootStyle.flex).toBe(1);
    expect(rootStyle.justifyContent).toBe('flex-end');

    const container = tree.root.findByProps({ accessibilityViewIsModal: true });
    const containerStyle = StyleSheet.flatten(container.props.style);
    expect(containerStyle.maxHeight).toBe(360);
    expect(containerStyle.height).toBeUndefined();
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);

    act(() => tree.unmount());
  });

  it('routes backdrop dismissal through Cancel', () => {
    const onCancel = jest.fn();
    const onDismiss = jest.fn();
    let tree;
    act(() => {
      tree = TestRenderer.create(
        <ContextualActionSheet
          visible
          title="1 pick selected"
          actions={actions}
          onCancel={onCancel}
          onDismiss={onDismiss}
        />
      );
    });

    act(() => {
      actionByLabel(tree, 'Dismiss actions').props.onPress();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => tree.unmount());
  });

  it('routes Android back through Cancel', () => {
    const onCancel = jest.fn();
    const onDismiss = jest.fn();
    let tree;
    act(() => {
      tree = TestRenderer.create(
        <ContextualActionSheet
          visible
          title="1 pick selected"
          actions={actions}
          onCancel={onCancel}
          onDismiss={onDismiss}
        />
      );
    });

    act(() => {
      tree.root.findByProps({ testID: 'contextual-sheet-modal' }).props.onRequestClose();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => tree.unmount());
  });

  it('keeps disabled actions inert', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(
        <ContextualActionSheet visible title="1 pick selected" actions={actions} />
      );
    });

    const disabled = actionByLabel(tree, 'Disabled Action');
    expect(disabled.props.disabled).toBe(true);
    expect(disabled.props.accessibilityState).toEqual({ disabled: true });
    expect(disabled.props.onPress).toBeUndefined();

    act(() => tree.unmount());
  });

  it('styles the destructive action differently', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(
        <ContextualActionSheet visible title="1 pick selected" actions={actions} />
      );
    });

    const destructive = actionByLabel(tree, 'Remove Selected');
    const actionStyle = StyleSheet.flatten(destructive.props.style({ pressed: false }));
    const labelStyle = StyleSheet.flatten(
      tree.root.findByProps({ children: 'Remove Selected' }).props.style
    );

    expect(actionStyle.backgroundColor).toBe('#ff0000');
    expect(labelStyle.color).toBe('#ffffff');
    expect(tree.root.findByProps({ testID: 'app-icon', name: 'trash' })).toBeTruthy();

    act(() => tree.unmount());
  });

  it('dismisses once before invoking Cancel', () => {
    const onCancel = jest.fn();
    const onDismiss = jest.fn();
    let tree;
    act(() => {
      tree = TestRenderer.create(
        <ContextualActionSheet
          visible
          title="1 pick selected"
          actions={actions}
          onCancel={onCancel}
          onDismiss={onDismiss}
        />
      );
    });

    act(() => {
      actionByLabel(tree, 'Cancel').props.onPress();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => tree.unmount());
  });

  it('keeps a long action list scrollable without stretching rows', () => {
    const manyActions = Array.from({ length: 8 }, (_, index) => ({
      id: `action-${index}`,
      label: `Action ${index}`,
      onPress: jest.fn(),
    }));
    let tree;
    act(() => {
      tree = TestRenderer.create(
        <ContextualActionSheet visible title="8 picks selected" actions={manyActions} />
      );
    });

    const list = tree.root.findByType(ScrollView);
    expect(StyleSheet.flatten(list.props.style).flexGrow).toBe(0);
    expect(StyleSheet.flatten(list.props.style).flexShrink).toBe(1);
    expect(StyleSheet.flatten(list.props.contentContainerStyle).flexGrow).toBe(0);
    expect(buttonLabels(tree)).toHaveLength(9);

    act(() => tree.unmount());
  });

  it('sizes one to four actions from their rows', () => {
    [1, 2, 3, 4].forEach((count) => {
      const sampleActions = Array.from({ length: count }, (_, index) => ({
        id: `action-${index}`,
        label: `Action ${index}`,
        onPress: jest.fn(),
      }));
      let tree;
      act(() => {
        tree = TestRenderer.create(
          <ContextualActionSheet visible title={`${count} picks selected`} actions={sampleActions} />
        );
      });

      expect(buttonLabels(tree)).toHaveLength(count + 1);
      expect(tree.root.findAllByType(ScrollView)).toHaveLength(count > 3 ? 1 : 0);

      act(() => tree.unmount());
    });
  });

  it('does not render without actions', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(<ContextualActionSheet visible title="1 pick selected" />);
    });

    expect(tree.toJSON()).toBeNull();

    act(() => tree.unmount());
  });

  it('exposes imperative dismiss through its forwarded ref', () => {
    const ref = createRef();
    const callback = jest.fn();
    const onCancel = jest.fn();
    let tree;
    act(() => {
      tree = TestRenderer.create(
        <ContextualActionSheet ref={ref} visible title="1 pick selected" actions={actions} onCancel={onCancel} />
      );
    });

    act(() => {
      ref.current.dismiss(callback);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    act(() => tree.unmount());
  });
});
