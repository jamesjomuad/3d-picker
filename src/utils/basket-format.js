/**
 * Selection Basket formatting
 *
 * Pure display helpers for basket entries: the local date-and-time line
 * under each saved combination, and the plain-text list sent through the
 * native share sheet. No React, no storage — everything here can be
 * verified with a plain function call.
 */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Format an `addedAt` timestamp for display, in the device's local time.
 *
 * "Nov 23, 2026 · 8:35 PM". Entries saved before timestamps existed (and
 * anything unparseable) return '' so callers can hide the line entirely
 * rather than show a lie.
 *
 * @param {string|number|null|undefined} value - ISO string or epoch from `Date.now()`
 * @returns {string} the formatted line, or '' when there is no usable timestamp
 */
export function formatAddedAt(value) {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const hours = date.getHours();
  const period = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} · ${hour12}:${minutes} ${period}`;
}

/**
 * Share-sheet timestamp: "Nov 25, 2026 8:00AM". Reuses the display formatter
 * but drops its separator and the space before AM/PM for a compact parenthetical.
 *
 * @param {string|number|null|undefined} value
 * @returns {string}
 */
function formatShareAddedAt(value) {
  return formatAddedAt(value).replace(' · ', ' ').replace(/ (AM|PM)$/, '$1');
}

/**
 * The plain-text list sent through the share sheet: app name,
 * total, one numbered line per pick with its local added date and time,
 * closing credit. Picks without a recorded timestamp (saved before the
 * basket tracked dates) show the digits alone.
 *
 * @param {Array<{ digits: string, addedAt?: string }>} entries - basket entries
 * @returns {string}
 */
export function buildBasketShareText(entries) {
  const blocks = entries.map((entry, index) => {
    const added = formatShareAddedAt(entry.addedAt);
    const suffix = added ? ` (Added: ${added})` : '';
    return `${index + 1}. ${entry.digits}${suffix}`;
  });

  return [
    '3D Picker – Selection Basket',
    '',
    `Total Picks: ${entries.length}`,
    '',
    ...blocks,
    '',
    'Generated using 3D Picker.',
  ].join('\n');
}
