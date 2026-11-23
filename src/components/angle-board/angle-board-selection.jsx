import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { getSelectionRect } from '@/utils/board-layout';

/**
 * The two absolute overlays drawn on top of the cells. Both must keep
 * `pointerEvents="none"`: anything that becomes the touch target would move
 * `locationX/Y` out of container space and break the gesture mapping.
 */

/** Fill and border of the live drag rectangle — the one gesture-only colour, so
 *  it stays here rather than in the theme, where no other token needs it. */
const OVERLAY_BACKGROUND = 'rgba(60, 135, 247, 0.15)';
const OVERLAY_BORDER = 'rgba(60, 135, 247, 0.5)';

/**
 * Rectangle the drag currently covers. Renders nothing when there is no drag.
 *
 * @param {Object} props
 * @param {Object|null} props.dragState - from `useAngleBoardGestures`
 * @param {number} props.cellSize
 * @param {number} props.totalRows
 * @param {number} props.totalCols
 */
export function AngleBoardSelectionOverlay({ dragState, cellSize, totalRows, totalCols }) {
  const rect = useMemo(
    () => getSelectionRect(dragState, cellSize, totalRows, totalCols),
    [dragState, cellSize, totalRows, totalCols]
  );

  if (!rect) return null;

  return <View style={[styles.overlay, rect]} pointerEvents="none" />;
}

/**
 * 1px border around the whole board.
 *
 * Drawn as an overlay on purpose: a border on the container would offset its
 * children by 1px while `locationX` still starts at the border's outer edge,
 * skewing every coordinate by one pixel.
 */
export function AngleBoardFrame() {
  const theme = useTheme();

  return (
    <View pointerEvents="none" style={[styles.frame, { borderColor: theme.textSecondary + '20' }]} />
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    backgroundColor: OVERLAY_BACKGROUND,
    borderWidth: 2,
    borderColor: OVERLAY_BORDER,
  },
  frame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
  },
});
