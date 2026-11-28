import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LotteryCombination } from '@/components/results/lottery-combination';
import {
  Interaction,
  Spacing,
  TouchTarget,
  Typography,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  DRAW_SESSIONS,
  formatDrawDate,
} from '@/utils/results-history';

export const ResultsHistoryHeader = memo(function ResultsHistoryHeader({ width }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.row,
        styles.header,
        { width, borderBottomColor: theme.border },
      ]}>
      <View style={styles.dateColumn}>
        <Text style={[styles.headerText, { color: theme.textSecondary }]}>
          DRAW DATE
        </Text>
      </View>
      {DRAW_SESSIONS.map((session) => (
        <View key={session.key} style={styles.sessionColumn}>
          <Text style={[styles.headerText, { color: theme.textSecondary }]}>
            {session.label}
          </Text>
        </View>
      ))}
    </View>
  );
});

/** One date row with three session cells. Missing sessions stay empty. */
export const ResultsHistoryRow = memo(function ResultsHistoryRow({
  group,
  width,
  onSelectRecord,
}) {
  const theme = useTheme();
  const fullDate = formatDrawDate(group.date);

  return (
    <View
      style={[
        styles.row,
        { width, borderBottomColor: theme.border },
      ]}>
      <View style={styles.dateColumn}>
        <Text
          accessible
          accessibilityLabel={fullDate}
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}
          style={[styles.dateText, { color: theme.text }]}>
          {formatDrawDate(group.date, { compact: true })}
        </Text>
      </View>

      {DRAW_SESSIONS.map((session) => {
        const record = group.sessions[session.key];
        const cellLabel = record
          ? `${fullDate}, ${session.label} draw`
          : `${fullDate}, ${session.label} draw unavailable`;

        return (
          <Pressable
            key={session.key}
            disabled={!record}
            onPress={record ? () => onSelectRecord?.(record) : undefined}
            accessibilityRole={record ? 'button' : 'text'}
            accessibilityLabel={cellLabel}
            style={({ pressed }) => [
              styles.sessionColumn,
              styles.sessionCell,
              pressed && record && styles.pressed,
            ]}>
            {record ? (
              <LotteryCombination
                result={record.result}
                size={20}
                gap={2}
                accessibilityLabel={`${session.label}: ${
                  Array.isArray(record.result) ? record.result.join('') : 'result unavailable'
                }`}
              />
            ) : (
              <Text
                maxFontSizeMultiplier={1.2}
                style={[styles.placeholder, { color: theme.textSecondary }]}>
                —
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
});

const DATE_COLUMN_FLEX = 1.35;
const SESSION_COLUMN_FLEX = 1;

const styles = StyleSheet.create({
  row: {
    minHeight: TouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    minHeight: TouchTarget,
  },
  dateColumn: {
    flex: DATE_COLUMN_FLEX,
    minWidth: 0,
    paddingRight: Spacing.one,
    justifyContent: 'center',
  },
  sessionColumn: {
    flex: SESSION_COLUMN_FLEX,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionCell: {
    minHeight: TouchTarget - Spacing.two,
  },
  headerText: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    fontWeight: Typography.weight.semibold,
    letterSpacing: 0.4,
  },
  dateText: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
  },
  placeholder: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
  },
  pressed: {
    opacity: Interaction.pressedOpacity,
  },
});
