/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    border: '#D8D8DB',
    primary: '#f48c06',
    primaryText: '#ffffff',
    match: '#FFB340',
    lotteryBall: '#FFD34D',
    lotteryBallBorder: '#E59400',
    lotteryBallText: '#4A2B00',
    destructive: '#FF453A',
    disabled: '#F0F0F3',
    disabledText: '#B0B4BA',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#46423f',
    backgroundSelected: '#35322e',
    textSecondary: '#B0B4BA',
    border: '#3A3D41',
    primary: '#f48c06',
    primaryText: '#ffffff',
    match: '#FFB340',
    lotteryBall: '#FFD34D',
    lotteryBallBorder: '#E59400',
    lotteryBallText: '#4A2B00',
    destructive: '#FF453A',
    disabled: '#212225',
    disabledText: '#60646C',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * Typography tokens
 * Single source of truth for text size, leading and weight.
 * Names describe role, never raw pixels, so a scale change happens once here.
 * Digits use the mono family via `Typography.family.mono` to keep tabular
 * alignment and leading zeros visually stable.
 */
export const Typography = {
  family: Fonts,
  size: {
    caption: 12,
    body: 14,
    bodyLarge: 16,
    subtitle: 18,
    title: 22,
    section: 28,
    headline: 32,
    hero: 48,
  },
  lineHeight: {
    caption: 16,
    body: 20,
    bodyLarge: 24,
    subtitle: 24,
    title: 28,
    section: 34,
    headline: 38,
    hero: 52,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

/** Minimum touch target by platform. iOS 44pt, Android 48dp. */
export const TouchTarget = Platform.select({ ios: 44, android: 48, default: 44 });

/** Shared interaction feedback. Opacity-only, so state changes never shift layout. */
export const Interaction = {
  pressedOpacity: 0.7,
  disabledOpacity: 0.5,
};

/** Icon sizes. Use these instead of ad-hoc pixel values. */
export const IconSize = {
  inline: 14,
  small: 16,
  action: 20,
  navigation: 24,
  prominent: 28,
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
};

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
