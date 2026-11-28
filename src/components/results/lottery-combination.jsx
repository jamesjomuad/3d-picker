import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const DIGIT_PATTERN = /^[0-9]$/;

function digitsFrom(result) {
  if (!Array.isArray(result) || result.length !== 3) return null;
  const digits = result.map((value) => String(value));
  return digits.every((digit) => DIGIT_PATTERN.test(digit)) ? digits : null;
}

/** One compact yellow lottery ball. Digits stay strings, so zeros survive. */
export const LotteryBall = memo(function LotteryBall({ digit, size = 20 }) {
  const theme = useTheme();
  const value = String(digit ?? '');

  if (!DIGIT_PATTERN.test(value)) return null;

  return (
    <View
      style={[
        styles.ball,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.lotteryBall,
          borderColor: theme.lotteryBallBorder,
          shadowColor: theme.lotteryBallBorder,
        },
      ]}>
      <View
        style={[
          styles.highlight,
          {
            top: Math.max(1, size * 0.12),
            left: (size - size * 0.42) / 2,
            width: size * 0.42,
            height: Math.max(1, size * 0.16),
            borderRadius: size * 0.08,
            backgroundColor: theme.primaryText,
          },
        ]}
      />
      <Text
        maxFontSizeMultiplier={1.2}
        style={[
          styles.digit,
          {
            color: theme.lotteryBallText,
            fontSize: Math.max(10, Math.round(size * 0.58)),
            lineHeight: size,
          },
        ]}>
        {value}
      </Text>
    </View>
  );
});

/** Three lottery balls with one stable accessibility label. */
export const LotteryCombination = memo(function LotteryCombination({
  result,
  size = 20,
  gap = 2,
  accessibilityLabel,
}) {
  const theme = useTheme();
  const digits = digitsFrom(result);

  if (!digits) {
    return (
      <Text
        accessible
        accessibilityLabel={accessibilityLabel ?? 'Result unavailable'}
        maxFontSizeMultiplier={1.2}
        style={[styles.placeholder, { color: theme.textSecondary }]}>
        —
      </Text>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? `Winning combination ${digits.join('')}`}
      style={[styles.combination, { columnGap: gap }]}>
      {digits.map((digit, index) => (
        <LotteryBall key={`${index}-${digit}`} digit={digit} size={size} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  combination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ball: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.28,
    shadowRadius: 1,
    elevation: 1,
  },
  highlight: {
    position: 'absolute',
    opacity: 0.4,
  },
  digit: {
    fontFamily: Fonts.mono,
    fontWeight: Typography.weight.bold,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  placeholder: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
  },
});
