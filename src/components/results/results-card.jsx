import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  formatCombination,
  getRecordStatus,
} from '@/services/lottery-normalize';

const STATUS_COLORS = {
  Conflicting: 'destructive',
  Provisional: 'match',
  Verified: 'primary',
  'Pending verification': 'textSecondary',
};

/**
 * One draw result row: three prominent digits plus date, time and status.
 *
 * @param {Object} props
 * @param {Object} props.record - normalized draw record
 * @param {() => void} props.onPress - opens the detail sheet
 */
function ResultsCardComponent({ record, onPress }) {
  const theme = useTheme();
  const status = getRecordStatus(record);
  const statusColor = theme[STATUS_COLORS[status]];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${record.lottery} result ${formatCombination(
        record.result
      )} on ${record.drawDate}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.topRow}>
        <Text style={[styles.lottery, { color: theme.textSecondary }]}>
          {record.lottery === '3DL' ? '3D Lotto' : record.lottery}
        </Text>
        <Text style={[styles.status, { color: statusColor }]}>{status}</Text>
      </View>

      <View style={styles.digitsRow}>
        {record.result.map((digit, index) => (
          <Text
            key={index}
            style={[styles.digit, { color: theme.text }]}>
            {digit}
          </Text>
        ))}
      </View>

      <View style={styles.metaRow}>
        <Text style={[styles.meta, { color: theme.textSecondary }]}>
          {record.drawDate}
          {record.drawTime ? ` · ${record.drawTime.slice(0, 5)}` : ''}
        </Text>
        {record.jackpot && (
          <Text style={[styles.meta, { color: theme.textSecondary }]}>
            ₱{record.jackpot}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export const ResultsCard = memo(ResultsCardComponent);

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
    padding: Spacing.three,
    gap: Spacing.two,
    minHeight: 48,
  },
  pressed: {
    opacity: 0.7,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lottery: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    fontWeight: Typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  status: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    fontWeight: Typography.weight.semibold,
  },
  digitsRow: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  digit: {
    fontSize: Typography.size.headline,
    lineHeight: Typography.lineHeight.headline,
    fontWeight: Typography.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
    fontVariant: ['tabular-nums'],
  },
});
