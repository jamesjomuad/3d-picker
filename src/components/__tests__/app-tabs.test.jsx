import { act } from 'react';
import TestRenderer from 'react-test-renderer';

import AppTabs from '@/components/app-tabs';
import { useContextualSheetStore } from '@/store/contextualSheetStore';

jest.mock('expo-router/native-tabs', () => {
  const React = require('react');
  const { View } = require('react-native');

  function MockNativeTabs({ children, hidden }) {
    return React.createElement(View, { testID: 'native-tabs', hidden }, children);
  }

  function MockTrigger({ children, name }) {
    return React.createElement(View, { testID: `tab-${name}` }, children);
  }

  function MockPart({ children, ...props }) {
    return React.createElement(View, props, children);
  }

  MockNativeTabs.Trigger = MockTrigger;
  MockNativeTabs.Trigger.Label = MockPart;
  MockNativeTabs.Trigger.Icon = MockPart;
  MockNativeTabs.Trigger.Badge = MockPart;

  return { NativeTabs: MockNativeTabs };
});

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/store/basketStore', () => ({
  useBasketStore: (selector) => selector({ entries: [] }),
}));

global.IS_REACT_ACT_ENVIRONMENT = true;

describe('AppTabs', () => {
  beforeEach(() => {
    act(() => {
      useContextualSheetStore.setState({
        visible: false,
        title: '',
        actions: [],
        onCancel: null,
      });
    });
  });

  it('hides the native tab bar only while a contextual sheet is visible', () => {
    let tree;
    act(() => {
      tree = TestRenderer.create(<AppTabs />);
    });

    const nativeTabs = () => tree.root.findByProps({ testID: 'native-tabs' });
    expect(nativeTabs().props.hidden).toBe(false);

    act(() => {
      useContextualSheetStore.setState({ visible: true });
    });
    expect(nativeTabs().props.hidden).toBe(true);

    act(() => {
      useContextualSheetStore.setState({ visible: false });
    });
    expect(nativeTabs().props.hidden).toBe(false);

    act(() => tree.unmount());
  });
});
