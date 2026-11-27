/**
 * Date grouping for the Collection screen
 *
 * Saved picks are grouped by the calendar date on the device that saved them,
 * never by a UTC day or by the date a backup was restored. Pure helpers only:
 * entries are copied into new sections, their timestamps and objects stay
 * untouched, and callers never mutate the persisted basket.
 */

import { parseAddedAt } from '@/utils/basket-format';

const LONG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const UNAVAILABLE_KEY = 'unavailable';

/**
 * Local calendar key for a date, e.g. 2026-11-24.
 *
 * Uses local getters on purpose. Two entries either side of UTC midnight must
 * stay under the date the user saw when they saved them.
 *
 * @param {Date} date
 * @returns {string}
 */
function getLocalDateKey(date) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Human label for a group date.
 *
 * @param {Date} date - local date of the group
 * @param {Date} [now=new Date()] - current local date, injectable for tests
 * @returns {string} Today, Yesterday, or "November 24, 2026"
 */
export function formatGroupTitle(date, now = new Date()) {
  const key = getLocalDateKey(date);
  if (key === getLocalDateKey(now)) return 'Today';

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (key === getLocalDateKey(yesterday)) return 'Yesterday';

  return `${LONG_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Group basket entries into newest-first date sections.
 *
 * Valid timestamps sort by exact millisecond value, newest first; ties keep
 * the original array order. Missing or invalid timestamps go into a final
 * `Date unavailable` section in their original order. Section objects carry
 * `key`, `title`, `count`, `index` and `data`; no extra field is added to an
 * entry and the returned arrays are new, so persisted data stays as it was.
 *
 * @param {Array<{digits: string, addedAt?: string|number}>} entries
 * @param {Date} [now=new Date()] - current local date, injectable for tests
 * @returns {Array<{key: string, title: string, count: number, index: number, data: Array}>}
 */
export function groupBasketEntries(entries, now = new Date()) {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const dated = [];
  const unavailable = [];

  entries.forEach((entry, index) => {
    const date = parseAddedAt(entry?.addedAt);
    if (!date) {
      unavailable.push({ entry, index });
      return;
    }
    dated.push({ entry, index, date, key: getLocalDateKey(date) });
  });

  dated.sort((a, b) => b.date.getTime() - a.date.getTime() || a.index - b.index);

  const groups = new Map();
  for (const item of dated) {
    let group = groups.get(item.key);
    if (!group) {
      group = {
        key: `date:${item.key}`,
        title: formatGroupTitle(item.date, now),
        timestamp: item.date.getTime(),
        data: [],
      };
      groups.set(item.key, group);
    }
    group.data.push(item.entry);
  }

  const sections = [...groups.values()].sort((a, b) => b.timestamp - a.timestamp);

  if (unavailable.length > 0) {
    unavailable.sort((a, b) => a.index - b.index);
    sections.push({
      key: UNAVAILABLE_KEY,
      title: 'Date unavailable',
      timestamp: -Infinity,
      data: unavailable.map((item) => item.entry),
    });
  }

  return sections.map((section, index) => ({
    key: section.key,
    title: section.title,
    count: section.data.length,
    index,
    data: section.data,
  }));
}
