/**
 * Helpers for the compact 3D Lotto history table.
 *
 * The API can identify a draw session through `slot`, `gameCode`, the existing
 * `drawNumber` field, or the draw time. Session mapping must never depend on
 * array order, and unknown values must not create a fabricated result.
 */

export const DRAW_SESSIONS = [
  { key: '2pm', label: '2PM' },
  { key: '5pm', label: '5PM' },
  { key: '9pm', label: '9PM' },
];

const MONTHS = [
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

const SHORT_MONTHS = [
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

const DRAW_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const GAME_CODE_SESSION_PATTERN = /3d_lotto[_-](2|5|9)pm/i;
const LABEL_SESSION_PATTERN = /\b(2|5|9)\s*pm\b/i;
const HOUR_PATTERN = /^(\d{1,2}):/;

const SESSION_BY_HOUR = {
  2: '2pm',
  14: '2pm',
  5: '5pm',
  17: '5pm',
  9: '9pm',
  21: '9pm',
};

function sessionFromGameCode(value) {
  const match = GAME_CODE_SESSION_PATTERN.exec(value);
  return match ? `${match[1]}pm` : null;
}

function sessionFromLabel(value) {
  const match = LABEL_SESSION_PATTERN.exec(value);
  return match ? `${match[1]}pm` : null;
}

function sessionFromDrawTime(value) {
  const match = HOUR_PATTERN.exec(value);
  if (!match) return null;
  return SESSION_BY_HOUR[Number(match[1])] ?? null;
}

/** Resolve one of the three supported sessions without guessing from order. */
export function getDrawSession(record) {
  if (!record || typeof record !== 'object') return null;

  if (typeof record.gameCode === 'string') {
    const fromGameCode = sessionFromGameCode(record.gameCode);
    if (fromGameCode) return fromGameCode;
  }

  for (const value of [record.slot, record.drawNumber]) {
    if (typeof value !== 'string') continue;
    const fromLabel = sessionFromLabel(value);
    if (fromLabel) return fromLabel;
  }

  if (typeof record.drawTime === 'string') {
    return sessionFromDrawTime(record.drawTime);
  }

  return null;
}

/** Format an API draw date without shifting it through local time or UTC. */
export function formatDrawDate(value, { compact = false } = {}) {
  if (typeof value !== 'string') return '';
  const match = DRAW_DATE_PATTERN.exec(value);
  if (!match) return value;

  const monthIndex = Number(match[2]) - 1;
  if (!MONTHS[monthIndex]) return value;

  const month = compact ? SHORT_MONTHS[monthIndex] : MONTHS[monthIndex];
  const day = String(Number(match[3]));
  return `${month} ${day}, ${match[1]}`;
}

function emptySessions() {
  return { '2pm': null, '5pm': null, '9pm': null };
}

/**
 * Group records into one row per date, newest date first.
 * The first record seen for a session wins; later duplicates never replace it.
 */
export function groupRecordsByDrawDate(records) {
  const byDate = new Map();

  for (const record of Array.isArray(records) ? records : []) {
    if (!record || typeof record.drawDate !== 'string') continue;

    let group = byDate.get(record.drawDate);
    if (!group) {
      group = { date: record.drawDate, sessions: emptySessions() };
      byDate.set(record.drawDate, group);
    }

    const session = getDrawSession(record);
    if (!session || group.sessions[session]) continue;
    group.sessions[session] = record;
  }

  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}
