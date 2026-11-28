import {
  DRAW_DISPLAY_STATES,
  DRAW_SESSIONS,
  formatDrawDate,
  getDrawDisplayState,
  getDrawSession,
  groupRecordsByDrawDate,
} from '@/utils/results-history';

function record(overrides = {}) {
  return {
    id: 'v2-1',
    drawDate: '2026-11-27',
    result: ['0', '3', '7'],
    gameCode: '3d_lotto_2pm',
    slot: '2PM Draw',
    drawNumber: '2PM Draw',
    drawTime: '14:00:00+08:00',
    ...overrides,
  };
}

describe('results history helpers', () => {
  it('resolves sessions from stable fields before array order', () => {
    expect(getDrawSession(record())).toBe('2pm');
    expect(getDrawSession(record({ gameCode: '3d_lotto_9pm' }))).toBe('9pm');
    expect(getDrawSession(record({ gameCode: null, slot: '5PM Draw' }))).toBe('5pm');
    expect(
      getDrawSession(record({ gameCode: null, slot: null, drawNumber: null }))
    ).toBe('2pm');
    expect(
      getDrawSession(record({ gameCode: '', slot: 'unknown', drawNumber: '', drawTime: '' }))
    ).toBeNull();
    expect(getDrawSession(null)).toBeNull();
  });

  it('formats draw dates without UTC conversion', () => {
    expect(formatDrawDate('2026-11-27')).toBe('November 27, 2026');
    expect(formatDrawDate('2026-11-27', { compact: true })).toBe('Nov 27, 2026');
    expect(formatDrawDate('not-a-date')).toBe('not-a-date');
    expect(formatDrawDate(null)).toBe('');
  });

  it('groups dates newest first and preserves leading zeros', () => {
    const groups = groupRecordsByDrawDate([
      record({ id: 'old', drawDate: '2026-11-26', gameCode: '3d_lotto_9pm' }),
      record({ id: 'five', gameCode: '3d_lotto_5pm', slot: null, result: ['0', '0', '5'] }),
      record({ id: 'nine', gameCode: '3d_lotto_9pm', slot: null, result: ['1', '2', '3'] }),
      record({ id: 'two', gameCode: '3d_lotto_2pm', slot: null, result: ['0', '3', '7'] }),
    ]);

    expect(groups.map((group) => group.date)).toEqual(['2026-11-27', '2026-11-26']);
    expect(DRAW_SESSIONS.map((session) => session.key)).toEqual(['2pm', '5pm', '9pm']);
    expect(groups[0].sessions['2pm'].result).toEqual(['0', '3', '7']);
    expect(groups[0].sessions['5pm'].result).toEqual(['0', '0', '5']);
    expect(groups[0].sessions['9pm'].result).toEqual(['1', '2', '3']);
  });

  it('retains all three sessions when a date has missing results', () => {
    const [group] = groupRecordsByDrawDate([
      record({
        id: 'known',
        gameCode: '3d_lotto_5pm',
        slot: null,
        drawNumber: '5PM Draw',
        drawTime: '17:00:00+08:00',
      }),
      record({
        id: 'unknown',
        gameCode: 'other_game',
        slot: null,
        drawNumber: '',
        drawTime: '',
      }),
    ]);

    expect(Object.keys(group.sessions)).toEqual(['2pm', '5pm', '9pm']);
    expect(group.sessions['2pm']).toBeNull();
    expect(group.sessions['5pm'].id).toBe('known');
    expect(group.sessions['9pm']).toBeNull();
  });

  it('keeps the first result for a session when duplicates arrive', () => {
    const [group] = groupRecordsByDrawDate([
      record({ id: 'first', gameCode: '3d_lotto_2pm', slot: null }),
      record({ id: 'second', gameCode: '3d_lotto_2pm', slot: null, result: ['9', '9', '9'] }),
    ]);

    expect(group.sessions['2pm'].id).toBe('first');
    expect(group.sessions['2pm'].result).toEqual(['0', '3', '7']);
  });

  it('treats valid numbers as available regardless of winners status or time', () => {
    expect(
      getDrawDisplayState({
        record: record({
          drawDate: '2026-11-28',
          winnersStatus: 'pending',
        }),
        sessionKey: '2pm',
        date: '2026-11-28',
        now: '2026-11-27T20:00:00.000Z',
      })
    ).toBe(DRAW_DISPLAY_STATES.AVAILABLE);
  });

  it('uses the Asia/Manila schedule for upcoming and pending states', () => {
    const date = '2026-11-28';

    expect(
      getDrawDisplayState({
        sessionKey: '2pm',
        date,
        now: '2026-11-28T05:59:00.000Z',
      })
    ).toBe(DRAW_DISPLAY_STATES.UPCOMING);
    expect(
      getDrawDisplayState({
        sessionKey: '2pm',
        date,
        now: '2026-11-28T06:00:00.000Z',
      })
    ).toBe(DRAW_DISPLAY_STATES.PENDING);
    expect(
      getDrawDisplayState({
        sessionKey: '9pm',
        date,
        now: '2026-11-28T12:59:00.000Z',
      })
    ).toBe(DRAW_DISPLAY_STATES.UPCOMING);
    expect(
      getDrawDisplayState({
        sessionKey: '9pm',
        date,
        now: '2026-11-28T13:00:00.000Z',
      })
    ).toBe(DRAW_DISPLAY_STATES.PENDING);
  });

  it('uses the record session when winning numbers are unavailable', () => {
    const pendingRecord = record({
      id: 'no-numbers',
      drawDate: '2026-11-28',
      result: [],
      gameCode: '3d_lotto_9pm',
      slot: '9PM Draw',
      drawNumber: '9PM Draw',
      drawTime: '21:00:00+08:00',
      winnersStatus: 'pending',
    });

    expect(
      getDrawDisplayState({
        record: pendingRecord,
        sessionKey: '9pm',
        date: '2026-11-28',
        now: '2026-11-28T12:59:00.000Z',
      })
    ).toBe(DRAW_DISPLAY_STATES.UPCOMING);
    expect(
      getDrawDisplayState({
        record: pendingRecord,
        sessionKey: '9pm',
        date: '2026-11-28',
        now: '2026-11-28T13:00:00.000Z',
      })
    ).toBe(DRAW_DISPLAY_STATES.PENDING);
  });

  it('returns unknown when date, session, or clock cannot be determined', () => {
    expect(
      getDrawDisplayState({
        sessionKey: '2pm',
        date: 'bad-date',
        now: '2026-11-28T06:00:00.000Z',
      })
    ).toBe(DRAW_DISPLAY_STATES.UNKNOWN);
    expect(
      getDrawDisplayState({
        sessionKey: 'unknown',
        date: '2026-11-28',
        now: '2026-11-28T06:00:00.000Z',
      })
    ).toBe(DRAW_DISPLAY_STATES.UNKNOWN);
    expect(
      getDrawDisplayState({
        sessionKey: '2pm',
        date: '2026-11-28',
        now: 'not-a-time',
      })
    ).toBe(DRAW_DISPLAY_STATES.UNKNOWN);
  });
});
