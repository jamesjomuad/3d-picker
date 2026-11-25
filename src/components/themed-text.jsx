import { Platform, StyleSheet, Text } from 'react-native';

import { Fonts, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ThemedText({ style, type = 'default', themeColor, ...rest }) {
  const theme = useTheme();
  const color = themeColor
    ? theme[themeColor]
    : type === 'linkPrimary'
      ? theme.primary
      : theme.text;

  return <Text style={[{ color }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  small: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
    fontWeight: Typography.weight.medium,
  },
  smallBold: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
    fontWeight: Typography.weight.bold,
  },
  default: {
    fontSize: Typography.size.bodyLarge,
    lineHeight: Typography.lineHeight.bodyLarge,
    fontWeight: Typography.weight.medium,
  },
  title: {
    fontSize: Typography.size.hero,
    lineHeight: Typography.lineHeight.hero,
    fontWeight: Typography.weight.semibold,
  },
  subtitle: {
    fontSize: Typography.size.headline,
    lineHeight: Typography.lineHeight.headline,
    fontWeight: Typography.weight.semibold,
  },
  link: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.bodyLarge,
  },
  linkPrimary: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.bodyLarge,
  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: Typography.size.caption,
    fontWeight: Platform.select({ android: Typography.weight.bold }) ?? Typography.weight.medium,
  },
});
