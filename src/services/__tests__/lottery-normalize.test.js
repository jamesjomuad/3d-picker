import {
  asDigitString,
  discoverThreeDGameCodes,
  formatCombination,
  getRecordStatus,
  normalizePageInfo,
  normalizeV2Game,
  normalizeV2HistoryPayload,
  normalizeV2LatestPayload,
  sortRecordsNewestFirst,
} from '../lottery-normalize';

const COLLECTED_AT = Date.parse('2026-11-28T00:00:00.000Z');

function game(overrides = {}) {
  return {
    slot: '9PM Draw',
    gameCode: '3d_lotto_9pm',
    gameName: '3D Lotto',
    numbers: [0, 3, 7],
    extraNumbers: [],
    prizeAmount: 4500,
    currency: 'PHP',
    winnersCount: 27,
    winnersStatus: 'final',
    sourceId: 123,
    drawDate: '2026-11-27',
    ...overrides,
  };
}

function draw(overrides = {}) {
  return {
    id: 3484,
    drawDate: '2026-11-27',
    serverTime: '2026-11-27T21:00:00+08:00',
    games: [game()],
    ...overrides,
  };
}

function envelope(draws, overrides = {}) {
  return {
    schemaVersion: '2.0.0',
    transformedAt: '2026-11-28T00:20:37.652Z',
    updatedAt: '2026-11-27T14:00:00.256Z',
    timezone: 'Asia/Manila',
    draws,
    ...overrides,
  };
}

describe('discoverThreeDGameCodes', () => {
  it('finds only active 3D Lotto codes from the real games shape', () => {
    const payload = {
      schemaVersion: '2.0.0',
      items: [
        {
          id: 4,
          code: '3d_lotto_2pm',
          name: '3D Lotto',
          family: '3d',
          numberCount: 3,
          isActive: true,
        },
        {
          id: 40,
          code: 'megalotto_6_45',
          name: 'Mega Lotto 6/45',
          family: 'lotto',
          numberCount: 6,
          isActive: true,
        },
        {
          id: 5,
          code: '3d_lotto_5pm',
          name: '3D Lotto',
          family: '3d',
          numberCount: 3,
          isActive: false,
        },
        {
          id: 6,
          gameCode: '3d_lotto_9pm',
          gameName: '3D Lotto',
          family: '3d',
          numberCount: 3,
          isActive: true,
        },
      ],
    };

    expect(discoverThreeDGameCodes(payload)).toEqual([
      '3d_lotto_2pm',
      '3d_lotto_9pm',
    ]);
  });

  it('returns no codes from a failed or unexpected payload', () => {
    expect(discoverThreeDGameCodes(null)).toEqual([]);
    expect(discoverThreeDGameCodes({ items: [] })).toEqual([]);
  });
});

describe('asDigitString', () => {
  it('accepts one digit only and never drops a leading zero', () => {
    expect(asDigitString(0)).toBe('0');
    expect(asDigitString('5')).toBe('5');
    expect(asDigitString(10)).toBeNull();
    expect(asDigitString('07')).toBeNull();
    expect(asDigitString('-1')).toBeNull();
  });
});

describe('normalizeV2LatestPayload', () => {
  it('parses the real snapshot shape and keeps leading zeros', () => {
    const payload = envelope([
      draw({
        games: [
          game({ numbers: [0, 3, 7], slot: '2PM Draw', gameCode: '3d_lotto_2pm' }),
          game({
            numbers: [0, 0, 5],
            slot: '5PM Draw',
            gameCode: '3d_lotto_5pm',
            sourceId: 124,
          }),
          game({ gameCode: 'megalotto_6_45', gameName: 'Mega Lotto 6/45' }),
        ],
      }),
    ]);

    const result = normalizeV2LatestPayload(payload, 'latest', COLLECTED_AT);

    expect(result.records).toHaveLength(2);
    expect(result.records.map((record) => formatCombination(record.result))).toEqual(
      ['037', '005']
    );
    expect(result.records[0]).toMatchObject({
      id: 'v2-123',
      lottery: '3DL',
      drawNumber: '2PM Draw',
      result: ['0', '3', '7'],
      drawDate: '2026-11-27',
      drawTime: '21:00:00',
      jackpot: '4500',
      currency: 'PHP',
      totalWinners: '27',
      winnersStatus: 'final',
      provisional: false,
      sources: ['latest'],
      gameCode: '3d_lotto_2pm',
      slot: '2PM Draw',
      sourceId: '123',
      serverTime: '2026-11-27T21:00:00+08:00',
      timezone: 'Asia/Manila',
      lastSuccessfulCaptureAt: '2026-11-27T14:00:00.256Z',
    });
  });

  it('tolerates a non-envelope payload', () => {
    expect(normalizeV2LatestPayload({ error: true }).records).toEqual([]);
  });
});

describe('normalizeV2Game', () => {
  it('uses game drawDate when present and draw date/time otherwise', () => {
    const record = normalizeV2Game(
      draw({ games: [] }),
      game({ drawDate: undefined, sourceId: undefined }),
      'latest',
      COLLECTED_AT,
      { timezone: 'Asia/Manila' }
    );

    expect(record.drawDate).toBe('2026-11-27');
    expect(record.drawTime).toBe('21:00:00');
    expect(record.id).toBe('v2-3d_lotto_9pm-2026-11-27-21:00:00-037');
  });

  it('keeps missing optional fields null', () => {
    const record = normalizeV2Game(
      draw({ games: [] }),
      game({
        prizeAmount: undefined,
        currency: undefined,
        winnersCount: undefined,
        winnersStatus: undefined,
        slot: null,
      }),
      'history',
      COLLECTED_AT,
      {}
    );

    expect(record.jackpot).toBeNull();
    expect(record.currency).toBeNull();
    expect(record.totalWinners).toBeNull();
    expect(record.winnersStatus).toBeNull();
    expect(record.provisional).toBeNull();
    expect(record.timezone).toBeNull();
  });

  it.each([
    ['pending', true],
    ['final', false],
    ['unknown', true],
  ])('maps winnersStatus %s without inventing values', (status, provisional) => {
    const record = normalizeV2Game(
      draw({ games: [] }),
      game({ winnersStatus: status }),
      'history',
      COLLECTED_AT,
      {}
    );

    expect(record.winnersStatus).toBe(status);
    expect(record.provisional).toBe(provisional);
  });

  it.each([
    [[1, 2], 'too short'],
    [[0, 3, 7, 9], 'too long'],
    [[0, 10, 7], 'out of range'],
    [[0, 'x', 7], 'non digit'],
  ])('drops unexpected numbers array %j (%s)', (numbers) => {
    expect(
      normalizeV2Game(draw({ games: [] }), game({ numbers }), 'latest', COLLECTED_AT, {})
    ).toBeNull();
  });

  it('drops malformed draw dates without shifting them', () => {
    expect(
      normalizeV2Game(
        draw({ games: [], drawDate: '2026-11-27T21:00:00+08:00' }),
        game({ drawDate: undefined }),
        'latest',
        COLLECTED_AT,
        {}
      )
    ).toBeNull();
  });
});

describe('normalizeV2HistoryPayload', () => {
  it('parses history items and the opaque cursor', () => {
    const payload = {
      schemaVersion: '2.0.0',
      transformedAt: '2026-11-28T00:20:46.210Z',
      timezone: 'Asia/Manila',
      items: [
        draw({
          id: 3483,
          games: [game({ sourceId: 3483, drawDate: undefined })],
        }),
      ],
      pageInfo: { nextCursor: '3483', hasNextPage: true },
    };

    const result = normalizeV2HistoryPayload(payload, 'history', COLLECTED_AT);

    expect(result.records).toHaveLength(1);
    expect(result.records[0].drawDate).toBe('2026-11-27');
    expect(result.records[0].sources).toEqual(['history']);
    expect(result.pageInfo).toEqual({ nextCursor: '3483', hasNextPage: true });
  });
});

describe('normalizePageInfo', () => {
  it('honors hasNextPage only when a cursor exists', () => {
    expect(normalizePageInfo({ hasNextPage: true, nextCursor: 'x' }).hasNextPage).toBe(true);
    expect(normalizePageInfo({ hasNextPage: true, nextCursor: null }).hasNextPage).toBe(false);
    expect(normalizePageInfo({ hasNextPage: false, nextCursor: 'x' }).hasNextPage).toBe(false);
    expect(normalizePageInfo(undefined).nextCursor).toBeNull();
  });

  it('preserves a numeric cursor as text', () => {
    expect(normalizePageInfo({ hasNextPage: true, nextCursor: 3483 })).toEqual({
      nextCursor: '3483',
      hasNextPage: true,
    });
  });
});

describe('sortRecordsNewestFirst', () => {
  it('orders by drawDate then drawTime, newest first', () => {
    const make = (id, drawDate, drawTime) =>
      normalizeV2Game(
        { drawDate, serverTime: `${drawDate}T${drawTime}+08:00`, games: [] },
        game({ sourceId: undefined, drawDate: undefined }),
        'history',
        COLLECTED_AT,
        {}
      ) ?? { id, drawDate, drawTime };

    expect(
      sortRecordsNewestFirst([
        make('a', '2026-11-23', '21:00:00'),
        make('c', '2026-11-24', '14:00:00'),
        make('b', '2026-11-24', '21:00:00'),
      ]).map((record) => [record.drawDate, record.drawTime])
    ).toEqual([
      ['2026-11-24', '21:00:00'],
      ['2026-11-24', '14:00:00'],
      ['2026-11-23', '21:00:00'],
    ]);
  });
});

describe('getRecordStatus', () => {
  it('maps metadata to the four statuses', () => {
    expect(getRecordStatus({ conflict: true, provisional: false })).toBe('Conflicting');
    expect(getRecordStatus({ conflict: false, provisional: true })).toBe('Provisional');
    expect(getRecordStatus({ conflict: false, provisional: false, lastVerifiedAt: 'x' })).toBe(
      'Verified'
    );
    expect(getRecordStatus({ conflict: false, provisional: false, lastVerifiedAt: null })).toBe(
      'Pending verification'
    );
  });

  it('does not treat provisional:false alone as verified', () => {
    expect(getRecordStatus({ conflict: false, provisional: false })).toBe(
      'Pending verification'
    );
  });
});
