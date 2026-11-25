import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ResultsCard } from '@/components/results/results-card';
import { ResultsDetailSheet } from '@/components/results/results-detail-sheet';
import { AppIcon } from '@/components/ui/app-icon';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useScreenInsets } from '@/hooks/use-screen-insets';
import { useTheme } from '@/hooks/use-theme';
import { useResultsStore } from '@/store/resultsStore';

const FILTER_ALL = 'all';

/**
 * Results tab: Philippine 3D Lotto draw results from LottoMatik.
 * Cached records render immediately; refresh updates them in the background
 * and a failed request keeps everything already on screen.
 */
export default function ResultsScreen() {
  const theme = useTheme();
  const { contentPadding, contentWidth } = useScreenInsets();

  const records = useResultsStore((state) => state.records);
  const isLoaded = useResultsStore((state) => state.isLoaded);
  const isRefreshing = useResultsStore((state) => state.isRefreshing);
  const isLoadingMore = useResultsStore((state) => state.isLoadingMore);
  const hasMore = useResultsStore((state) => state.hasMore);
  const lastSyncAt = useResultsStore((state) => state.lastSyncAt);
  const error = useResultsStore((state) => state.error);
  const load = useResultsStore((state) => state.load);
  const refresh = useResultsStore((state) => state.refresh);
  const loadOlder = useResultsStore((state) => state.loadOlder);

  const [dateFilter, setDateFilter] = useState(FILTER_ALL);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const hasAutoRefreshed = useRef(false);

  useEffect(() => {
    load();
  }, [load]);

  // Cached results render first, then one background refresh per screen visit.
  useEffect(() => {
    if (!isLoaded || hasAutoRefreshed.current) return;
    hasAutoRefreshed.current = true;
    refresh();
  }, [isLoaded, refresh]);

  const dates = useMemo(() => {
    const seen = new Set();
    for (const record of records) seen.add(record.drawDate);
    return [...seen];
  }, [records]);

  const visibleRecords = useMemo(() => {
    if (dateFilter === FILTER_ALL) return records;
    return records.filter((record) => record.drawDate === dateFilter);
  }, [records, dateFilter]);

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    refresh();
  }, [isRefreshing, refresh]);

  const handleEndReached = useCallback(() => {
    if (dateFilter !== FILTER_ALL) return;
    if (!hasMore || isLoadingMore || isRefreshing) return;
    loadOlder();
  }, [dateFilter, hasMore, isLoadingMore, isRefreshing, loadOlder]);

  const renderItem = useCallback(
    ({ item }) => (
      <View style={[styles.row, { width: contentWidth }]}>
        <ResultsCard record={item} onPress={() => setSelectedRecord(item)} />
      </View>
    ),
    [contentWidth]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const header = (
    <View style={[styles.header, { width: contentWidth }]}>
      <View style={styles.headerTop}>
        <View>
          <ThemedText type="subtitle">Results</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            {lastSyncAt
              ? `Updated ${new Date(lastSyncAt).toLocaleString()}`
              : 'Not updated yet'}
          </ThemedText>
        </View>
        <Button
          variant="outline"
          size="sm"
          onPress={handleRefresh}
          disabled={isRefreshing}
          loading={isRefreshing} icon="arrow.clockwise">
          Refresh
        </Button>
      </View>

      {error && (
        <View
          accessible
          accessibilityRole="alert"
          style={[styles.errorBox, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>{error}</Text>
        </View>
      )}

      {dates.length > 1 && (
        <View style={styles.filterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}>
            {[FILTER_ALL, ...dates].map((date) => {
              const isActive = dateFilter === date;
              return (
                <Pressable
                  key={date}
                  onPress={() => setDateFilter(date)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  style={({ pressed }) => [
                    styles.filterChip,
                    {
                      backgroundColor: isActive ? theme.primary : theme.backgroundElement,
                      borderColor: isActive ? theme.primary : theme.border,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: isActive ? theme.primaryText : theme.text },
                    ]}>
                    {date === FILTER_ALL ? 'All dates' : date}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {dateFilter !== FILTER_ALL && (
            <Pressable
              onPress={() => setDateFilter(FILTER_ALL)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.clearFilter, pressed && styles.pressed]}>
              <AppIcon name="xmark.circle" size="small" tone="primary" />
              <Text style={[styles.clearFilterText, { color: theme.primary }]}>
                Clear filter
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );

  const footer = (
    <View style={[styles.footer, { width: contentWidth }]}>
      {isLoadingMore && <ActivityIndicator color={theme.primary} />}
      {!hasMore && records.length > 0 && dateFilter === FILTER_ALL && (
        <Text style={[styles.endText, { color: theme.textSecondary }]}>
          End of available history
        </Text>
      )}
    </View>
  );

  const empty = !isLoaded ? (
    <View style={styles.loadingState}>
      <ActivityIndicator color={theme.primary} />
      <ThemedText themeColor="textSecondary">Loading results...</ThemedText>
    </View>
  ) : records.length === 0 ? (
    <View style={[styles.emptyState, { width: contentWidth }]}>
      <ThemedText type="smallBold">No results yet</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.emptyText}>
        {isRefreshing
          ? 'Fetching the latest draws…'
          : 'Draw results will appear here once they load.'}
      </ThemedText>
      {!isRefreshing && (
        <Button variant="outline" size="sm" onPress={handleRefresh} icon="arrow.clockwise">
          Try again
        </Button>
      )}
    </View>
  ) : (
    <View style={[styles.emptyState, { width: contentWidth }]}>
      <ThemedText themeColor="textSecondary">No draws match this date.</ThemedText>
      <Button variant="outline" size="sm" onPress={() => setDateFilter(FILTER_ALL)}>
        Clear filter
      </Button>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <FlatList
        data={visibleRecords}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={header}
        ListFooterComponent={records.length > 0 ? footer : null}
        ListEmptyComponent={empty}
        contentContainerStyle={[styles.contentContainer, contentPadding]}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews
      />

      <ResultsDetailSheet
        visible={!!selectedRecord}
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
    flexGrow: 1,
    paddingBottom: Spacing.six,
  },
  header: {
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  subtitle: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
  },
  errorBox: {
    borderRadius: BorderRadius.md,
    padding: Spacing.two,
  },
  errorText: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
  },
  filterRow: {
    gap: Spacing.two,
  },
  filterScroll: {
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  filterChip: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
    fontVariant: ['tabular-nums'],
  },
  clearFilter: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.one,
  },
  clearFilterText: {
    fontSize: Typography.size.body,
    fontWeight: Typography.weight.semibold,
  },
  row: {
    marginBottom: Spacing.two,
  },
  footer: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
  },
  endText: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.six,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.three,
  },
  emptyText: {
    fontSize: Typography.size.body,
    lineHeight: Typography.lineHeight.body,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
