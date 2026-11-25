import { SymbolView } from 'expo-symbols';

import { IconSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Cross-platform symbol names for every icon used in the app.
 * Keys are stable action names; values map iOS SF Symbols to Android/Web
 * Material Symbols. Keep one entry per action so the same action never
 * renders with a different glyph on another screen.
 */
export const SYMBOL_NAMES = {
  'chevron.right': { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  'chevron.left': { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  'chevron.down': { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  'chevron.up': { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' },
  xmark: { ios: 'xmark', android: 'close', web: 'close' },
  'xmark.circle': { ios: 'xmark.circle', android: 'cancel', web: 'cancel' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  minus: { ios: 'minus', android: 'remove', web: 'remove' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  gearshape: { ios: 'gearshape', android: 'settings', web: 'settings' },
  'square.and.pencil': { ios: 'square.and.pencil', android: 'edit', web: 'edit' },
  magnifyingglass: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  basket: { ios: 'basket.fill', android: 'shopping_basket', web: 'shopping_basket' },
  collection: { ios: 'list.bullet.rectangle.fill', android: 'list_alt', web: 'list_alt' },
  checkmark: { ios: 'checkmark', android: 'check', web: 'check' },
  'checkmark.circle': { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' },
  'info.circle': { ios: 'info.circle', android: 'info', web: 'info' },
  'exclamationmark.triangle': { ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' },
  star: { ios: 'star.fill', android: 'star', web: 'star' },
  'star.slash': { ios: 'star', android: 'star_border', web: 'star_border' },
  ellipsis: { ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' },
  'arrow.clockwise': { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  'square.and.arrow.up': { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  'doc.on.doc': { ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' },
  'doc.text': { ios: 'doc.text', android: 'description', web: 'description' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  'text.cursor': { ios: 'text.cursor', android: 'text_fields', web: 'text_fields' },
  curlybraces: { ios: 'curlybraces', android: 'data_object', web: 'data_object' },
  'square.grid.2x2': { ios: 'square.grid.2x2', android: 'grid_view', web: 'grid_view' },
  eye: { ios: 'eye', android: 'visibility', web: 'visibility' },
  swap: { ios: 'arrow.left.arrow.right', android: 'swap_horiz', web: 'swap_horiz' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  'chart.bar': { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
  'list.bullet': { ios: 'list.bullet', android: 'list', web: 'list' },
  'slider.horizontal.3': { ios: 'slider.horizontal.3', android: 'tune', web: 'tune' },
  house: { ios: 'house.fill', android: 'home', web: 'home' },
};

export function getSymbolName(name) {
  return SYMBOL_NAMES[name] ?? name;
}

/**
 * Non-interactive icon. Icons that trigger an action belong in IconButton;
 * icons beside visible text are decorative and are hidden from screen readers.
 *
 * @param {Object} props
 * @param {string} props.name - Key from SYMBOL_NAMES
 * @param {'inline' | 'small' | 'action' | 'navigation' | 'prominent'} [props.size='action']
 * @param {string} [props.tone='text'] - Theme color key
 * @param {Object} [props.style] - Extra SymbolView style
 */
export function AppIcon({ name, size = 'action', tone = 'text', style }) {
  const theme = useTheme();

  return (
    <SymbolView
      name={getSymbolName(name)}
      size={IconSize[size] ?? size}
      tintColor={theme[tone] ?? tone}
      importantForAccessibility="no"
      accessible={false}
      style={style}
    />
  );
}
