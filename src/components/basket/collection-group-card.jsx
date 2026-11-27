import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CollectionRow } from '@/components/basket/collection-row';
import { CollectionSectionHeader } from '@/components/basket/collection-section-header';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * One date group in Collection: a header outside a single shared card.
 *
 * Every pick saved on the same local date lives inside one card, so the card
 * is the group container rather than a wrapper around each row. Thin hairline
 * dividers separate rows without making separate cards. There is no collapse
 * control; the group is always expanded.
 *
 * @param {Object} props
 * @param {{key: string, title: string, count: number, data: Array}} props.section
 * @param {number} [props.width] - centred column width
 * @param {string|null} props.selectedDigits - open detail sheet target
 * @param {Set<string>} [props.selectedIds] - temporary multi-select IDs
 * @param {boolean} [props.selectionMode=false]
 * @param {(digits: string) => void} props.onSelect
 * @param {(digits: string) => void} [props.onToggleSelected]
 * @param {(digits: string) => void} [props.onRequestRemove]
 */
export const CollectionGroupCard = memo(function CollectionGroupCard({
  section,
  width,
  selectedDigits,
  selectedIds,
  selectionMode = false,
  onSelect,
  onToggleSelected,
  onRequestRemove,
}) {
  const theme = useTheme();
  const rowWidth = width == null ? undefined : Math.max(0, width - Spacing.three * 2);

  return (
    <View style={[styles.group, { width }]}>
      <CollectionSectionHeader title={section.title} count={section.count} width={width} />
      <View
        style={[
          styles.card,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}
      >
        {section.data.map((entry, index) => (
          <CollectionRow
            key={entry.digits}
            entry={entry}
            width={rowWidth}
            selected={entry.digits === selectedDigits}
            checked={selectedIds?.has(entry.digits) ?? false}
            selectionMode={selectionMode}
            showDivider={index > 0}
            onSelect={onSelect}
            onToggleSelected={onToggleSelected}
            onRequestRemove={onRequestRemove}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  group: {
    alignSelf: 'center',
    marginBottom: Spacing.three,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half,
  },
});
