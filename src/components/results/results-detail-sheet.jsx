import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AppIcon } from '@/components/ui/app-icon';
import {
  formatCombination,
  getRecordStatus,
} from '@/services/lottery-normalize';

const SOURCE_LABELS = {
  latest: 'Latest results endpoint',
  history: 'History endpoint',
};

function DetailRow({ label, value, theme }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text selectable style={[styles.detailValue, { color: theme.text }]}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Bottom sheet with the full detail of one draw.
 *
 * @param {Object} props
 * @param {boolean} props.visible
 * @param {Object|null} props.record - normalized draw record
 * @param {() => void} props.onClose
 */
export function ResultsDetailSheet({ visible, record, onClose }) {
  const theme = useTheme();
  const { height } = useWindowDimensions();

  if (!record) return null;

  const status = getRecordStatus(record);
  const sources = record.sources
    .map((source) => SOURCE_LABELS[source] ?? source)
    .join(', ');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close details">
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.backgroundElement,
              paddingBottom: Spacing.five,
            },
          ]}
          onStartShouldSetResponder={() => true}>
          <ScrollView
            style={{ maxHeight: Math.max(320, Math.round(height * 0.76)) }}
            contentContainerStyle={styles.sheetContent}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.eyebrow}>
              {record.lottery === '3DL' ? '3D Lotto' : record.lottery} · {record.drawDate}
            </ThemedText>

            <View style={styles.digitsRow}>
              {record.result.map((digit, index) => (
                <Text key={index} style={[styles.digit, { color: theme.text }]}>
                  {digit}
                </Text>
              ))}
            </View>
            <Text style={[styles.combination, { color: theme.textSecondary }]}>
              Winning combination {formatCombination(record.result)}
            </Text>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <DetailRow label="Draw number" value={record.drawNumber} theme={theme} />
            <DetailRow label="Draw date" value={record.drawDate} theme={theme} />
            <DetailRow label="Draw time" value={record.drawTime} theme={theme} />
            <DetailRow label="Jackpot" value={record.jackpot ? `₱${record.jackpot}` : null} theme={theme} />
            <DetailRow label="Total winners" value={record.totalWinners} theme={theme} />
            <DetailRow label="Status" value={status} theme={theme} />
            <DetailRow
              label="Provisional"
              value={
                record.provisional === null
                  ? null
                  : record.provisional
                    ? 'Yes'
                    : 'No'
              }
              theme={theme}
            />
            <DetailRow label="Last verified" value={record.lastVerifiedAt} theme={theme} />
            <DetailRow
              label="Last capture"
              value={record.lastSuccessfulCaptureAt}
              theme={theme}
            />
            <DetailRow label="Collected" value={record.collectedAt} theme={theme} />
            <DetailRow label="Source" value={sources} theme={theme} />

            {record.conflict && (
              <View
                style={[
                  styles.conflictBox,
                  { borderColor: theme.destructive, backgroundColor: theme.background },
                ]}>
                <Text style={[styles.conflictTitle, { color: theme.destructive }]}>
                  Sources disagree on this draw
                </Text>
                <Text style={[styles.conflictText, { color: theme.text }]}>
                  The combination shown is the first one saved. Other reported
                  values are kept below and never overwrite it.
                </Text>
                {record.conflictSnapshots.map((snapshot, index) => (
                  <Text
                    key={index}
                    selectable
                    style={[styles.conflictSnapshot, { color: theme.textSecondary }]}>
                    {snapshot.sources.join('+')}: {formatCombination(snapshot.result)}
                    {snapshot.jackpot ? ` · ₱${snapshot.jackpot}` : ''}
                  </Text>
                ))}
              </View>
            )}
          </ScrollView>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.closeButton,
              { borderColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <AppIcon name="xmark" size="small" tone="text" />
              <Text style={[styles.closeText, { color: theme.text }]}>Close</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  sheetContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  eyebrow: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  digitsRow: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  digit: {
    fontSize: Typography.size.hero,
    lineHeight: Typography.lineHeight.hero,
    fontWeight: Typography.weight.bold,
    fontVariant: ['tabular-nums'],
  },
  combination: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.one,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  detailLabel: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
  },
  detailValue: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
    flexShrink: 1,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  conflictBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
    padding: Spacing.two,
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  conflictTitle: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
    fontWeight: Typography.weight.bold,
  },
  conflictText: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
  },
  conflictSnapshot: {
    fontSize: Typography.size.caption,
    lineHeight: Typography.lineHeight.caption,
  },
  closeButton: {
    minHeight: 48,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: Typography.size.bodyLarge,
    fontWeight: Typography.weight.semibold,
  },
  pressed: {
    opacity: 0.7,
  },
});
