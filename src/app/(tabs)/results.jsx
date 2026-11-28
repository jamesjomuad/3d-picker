import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ResultsDetailSheet } from '@/components/results/results-detail-sheet';
import {
  ResultsHistoryHeader,
  ResultsHistoryRow,
} from '@/components/results/results-history-row';
import { OptionSheet } from '@/components/settings/option-sheet';
import { AppIcon } from '@/components/ui/app-icon';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useScreenInsets } from '@/hooks/use-screen-insets';
import { useTheme } from '@/hooks/use-theme';
import { cancelResultsRequests, useResultsStore } from '@/store/resultsStore';
import {
  formatMonthLabel,
  getDateWindow,
  groupRecordsByDrawDate,
} from '@/utils/results-history';

const FILTER_ALL = 'all';

/**
 * Results tab: Philippine 3D Lotto draw results from PCSO Lotto API v2.
 * Cached records render immediately; refresh updates them in the background
 * and a failed request keeps everything already on screen.
 */
export default function ResultsScreen() {
  const theme = useTheme();
  const { contentPadding, contentWidth } = useScreenInsets();

  const records = useResultsStore((state) => state.records);
  const drawDates = useResultsStore((state) => state.drawDates);
  const drawMonths = useResultsStore((state) => state.drawMonths);
  const dateFilter = useResultsStore((state) => state.dateFilter);
  const monthFilter = useResultsStore((state) => state.monthFilter);
  const searchQuery = useResultsStore((state) => state.searchQuery);
  const isLoaded = useResultsStore((state) => state.isLoaded);
  const isRefreshing = useResultsStore((state) => state.isRefreshing);
  const isLoadingMore = useResultsStore((state) => state.isLoadingMore);
  const hasMore = useResultsStore((state) => state.hasMore);
  const totalCount = useResultsStore((state) => state.totalCount);
  const lastSyncAt = useResultsStore((state) => state.lastSyncAt);
  const error = useResultsStore((state) => state.error);
  const olderError = useResultsStore((state) => state.olderError);
  const emptyOlderPage = useResultsStore((state) => state.emptyOlderPage);
  const load = useResultsStore((state) => state.load);
  const setDateFilter = useResultsStore((state) => state.setDateFilter);
  const setMonthFilter = useResultsStore((state) => state.setMonthFilter);
  const setSearchQuery = useResultsStore((state) => state.setSearchQuery);
  const clearFilters = useResultsStore((state) => state.clearFilters);
  const refresh = useResultsStore((state) => state.refresh);
  const loadOlder = useResultsStore((state) => state.loadOlder);
  const showMoreLocal = useResultsStore((state) => state.showMoreLocal);

  const dates = drawDates;
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [monthSheetVisible, setMonthSheetVisible] = useState(false);
  const [datePage, setDatePage] = useState(0);
  const hasAutoRefreshed = useRef(false);

  const hasActiveFilter = Boolean(
    dateFilter !== FILTER_ALL || monthFilter !== FILTER_ALL || searchQuery
  );
  const isUnfilteredHistory = !hasActiveFilter;
  const dateWindow = getDateWindow(dates, datePage);
  const monthOptions = useMemo(() => [
    { value: FILTER_ALL, label: 'All months' },
    ...drawMonths.map((month) => ({
      value: month,
      label: formatMonthLabel(month),
    })),
  ], [drawMonths]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setDatePage(0);
  }, [dates, monthFilter, searchQuery]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState !== 'active') cancelResultsRequests();
    });
    return () => subscription.remove();
  }, []);

  useFocusEffect(
    useCallback(() => () => {
      cancelResultsRequests();
    }, [])
  );

  // Cached results render first, then one background refresh per screen visit.
  useEffect(() => {
    if (!isLoaded || hasAutoRefreshed.current) return;
    hasAutoRefreshed.current = true;
    refresh();
  }, [isLoaded, refresh]);

  // Records are already the active date page from SQLite. Keep the same
  // date-grouped table; only the source of the filtered rows changed.
  const visibleRows = useMemo(() => groupRecordsByDrawDate(records), [records]);
  const hasLocalMore = records.length < totalCount;

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    refresh();
  }, [isRefreshing, refresh]);

  const handleLoadOlderPress = useCallback(() => {
    if (!isUnfilteredHistory || isLoadingMore || isRefreshing) return;
    if (hasMore) {
      loadOlder();
      return;
    }
    if (hasLocalMore) showMoreLocal();
  }, [
    hasLocalMore,
    hasMore,
    isLoadingMore,
    isRefreshing,
    isUnfilteredHistory,
    loadOlder,
    showMoreLocal,
  ]);

  const handleShowOlderDates = useCallback(() => {
    setDatePage((page) => Math.min(page + 1, dateWindow.totalPages - 1));
  }, [dateWindow.totalPages]);

  const handleShowNewerDates = useCallback(() => {
    setDatePage((page) => Math.max(0, page - 1));
  }, []);

  const handleClearFilters = useCallback(() => {
    setDatePage(0);
    clearFilters();
  }, [clearFilters]);

  const handleEndReached = useCallback(() => {
    if (emptyOlderPage) return;
    handleLoadOlderPress();
  }, [emptyOlderPage, handleLoadOlderPress]);

  const renderItem = useCallback(
    ({ item }) => (
      <ResultsHistoryRow
        group={item}
        width={contentWidth}
        onSelectRecord={setSelectedRecord}
        hideDerivedStatus={hasActiveFilter}
      />
    ),
    [contentWidth, hasActiveFilter]
  );

  const keyExtractor = useCallback((item) => item.date, []);

  const header = (
    <View style={[styles.header, { width: contentWidth }]}>
      <View>
        <ThemedText type="subtitle">Results</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          {lastSyncAt
            ? `Updated ${new Date(lastSyncAt).toLocaleString()}`
            : 'Not updated yet'}
        </ThemedText>
      </View>

      {error && (
        <View
          accessible
          accessibilityRole="alert"
          style={[styles.errorBox, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>{error}</Text>
        </View>
      )}

      <View style={styles.searchRow}>
        <TextInput
          accessibilityLabel="Search results"
          placeholder="Search cached draws"
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          keyboardType="numeric"
          maxLength={60}
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
        />
        {Boolean(searchQuery) && (
          <Pressable
            onPress={() => setSearchQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            style={({ pressed }) => [styles.clearFilter, pressed && styles.pressed]}>
            <AppIcon name="xmark.circle" size="small" tone="primary" />
            <Text style={[styles.clearFilterText, { color: theme.primary }]}>
              Clear search
            </Text>
          </Pressable>
        )}
      </View>

      {hasActiveFilter && (
        <View style={styles.filterRow}>
          <Pressable
            onPress={handleClearFilters}
            accessibilityRole="button"
            style={({ pressed }) => [styles.clearFilter, pressed && styles.pressed]}>
            <AppIcon name="xmark.circle" size="small" tone="primary" />
            <Text style={[styles.clearFilterText, { color: theme.primary }]}>
              Clear all filters
            </Text>
          </Pressable>
        </View>
      )}

      {dates.length > 0 && (
        <View style={styles.dateFilterBlock}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}>
            <Pressable
              key={FILTER_ALL}
              onPress={() => setDateFilter(FILTER_ALL)}
              accessibilityRole="button"
              accessibilityState={{ selected: dateFilter === FILTER_ALL }}
              style={({ pressed }) => [
                styles.filterChip,
                {
                  backgroundColor: dateFilter === FILTER_ALL ? theme.primary : theme.backgroundElement,
                  borderColor: dateFilter === FILTER_ALL ? theme.primary : theme.border,
                },
                pressed && styles.pressed,
              ]}>
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: dateFilter === FILTER_ALL ? theme.primaryText : theme.text,
                  },
                ]}>
                All dates
              </Text>
            </Pressable>
            {drawMonths.length > 0 && (
              <Pressable
                key="month-filter"
                onPress={() => setMonthSheetVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Choose month"
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                  },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.filterChipText, { color: theme.text }]}>
                  {`Month: ${monthFilter === FILTER_ALL ? 'All months' : formatMonthLabel(monthFilter)}`}
                </Text>
              </Pressable>
            )}
            {dateWindow.dates.map((date) => {
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
                    {date}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {dateWindow.totalPages > 1 && (
            <View style={styles.pagerRow}>
              {dateWindow.canGoNewer && (
                <Pressable
                  onPress={handleShowNewerDates}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.pagerButton, pressed && styles.pressed]}>
                  <Text style={[styles.pagerText, { color: theme.primary }]}>Newer</Text>
                </Pressable>
              )}
              {dateWindow.canGoOlder && (
                <Pressable
                  onPress={handleShowOlderDates}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.pagerButton, pressed && styles.pressed]}>
                  <Text style={[styles.pagerText, { color: theme.primary }]}>Older</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}

      {visibleRows.length > 0 && <ResultsHistoryHeader width={contentWidth} />}
    </View>
  );

  const footer = (
    <View style={[styles.footer, { width: contentWidth }]}>
      {isLoadingMore && <ActivityIndicator color={theme.primary} />}

      {!isLoadingMore && olderError && (hasMore || hasLocalMore)
        && isUnfilteredHistory && (
        <>
          <Text style={[styles.endText, { color: theme.textSecondary }]}>{olderError}</Text>
          <Button
            variant="outline"
            size="sm"
            onPress={handleLoadOlderPress}
            icon="arrow.clockwise">
            Retry
          </Button>
        </>
      )}

      {!isLoadingMore && !olderError && emptyOlderPage && hasMore && isUnfilteredHistory && (
        <>
          <Text style={[styles.endText, { color: theme.textSecondary }]}>
            No new draws in this page. More history is available.
          </Text>
          <Button variant="outline" size="sm" onPress={handleLoadOlderPress}>
            Continue
          </Button>
        </>
      )}

      {!isLoadingMore && !olderError && !emptyOlderPage && !hasMore && hasLocalMore
        && isUnfilteredHistory && (
        <Button variant="outline" size="sm" onPress={handleLoadOlderPress}>
          Show more saved
        </Button>
      )}

      {!isLoadingMore && !olderError && !emptyOlderPage && !hasMore && !hasLocalMore
        && records.length > 0 && isUnfilteredHistory && (
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
  ) : records.length === 0 && hasActiveFilter ? (
    <View style={[styles.emptyState, { width: contentWidth }]}>
      <ThemedText themeColor="textSecondary">No draws match this filter.</ThemedText>
      <Button variant="outline" size="sm" onPress={handleClearFilters}>
        Clear all filters
      </Button>
    </View>
  ) : records.length === 0 && drawDates.length === 0 ? (
    <View style={[styles.emptyState, { width: contentWidth }]}>
      <ThemedText type="smallBold">No results yet</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.emptyText}>
        {isRefreshing
          ? 'Fetching the latest draws…'
          : 'Draw results will appear here once they load.'}
      </ThemedText>
    </View>
  ) : records.length === 0 ? (
    <View style={[styles.emptyState, { width: contentWidth }]}>
      <ThemedText themeColor="textSecondary">No draws match this date.</ThemedText>
      <Button variant="outline" size="sm" onPress={handleClearFilters}>
        Clear all filters
      </Button>
    </View>
  ) : null;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <FlatList
        data={visibleRows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={header}
        ListFooterComponent={records.length > 0 ? footer : null}
        ListEmptyComponent={empty}
        contentContainerStyle={[styles.contentContainer, contentPadding]}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
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

      <OptionSheet
        visible={monthSheetVisible}
        title="Month"
        options={monthOptions}
        value={monthFilter}
        onSelect={setMonthFilter}
        onClose={() => setMonthSheetVisible(false)}
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
    gap: Spacing.two,
    marginBottom: Spacing.two,
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  searchInput: {
    flex: 1,
    minHeight: 36,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.two,
    fontSize: Typography.size.body,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  filterScroll: {
    gap: Spacing.one,
    paddingRight: Spacing.one,
  },
  filterChip: {
    minHeight: 32,
    paddingHorizontal: Spacing.two,
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
    minHeight: 32,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.half,
  },
  clearFilterText: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
  },
  dateFilterBlock: {
    gap: Spacing.one,
  },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pagerButton: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: Spacing.half,
  },
  pagerText: {
    fontSize: Typography.size.caption,
    fontWeight: Typography.weight.semibold,
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
