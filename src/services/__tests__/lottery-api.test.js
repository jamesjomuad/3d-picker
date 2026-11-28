import {
  GAMES_URL,
  HISTORY_RESULTS_URL,
  LATEST_RESULTS_URL,
} from '@/constants/lottery';
import {
  fetchGameCodes,
  fetchHistoryBundle,
  fetchHistoryPage,
  fetchLatestResults,
  LotteryApiError,
} from '../lottery-api';

function jsonResponse(payload, { ok = true, status = 200 } = {}) {
  return { ok, status, json: jest.fn(async () => payload) };
}

function threeDGame(overrides = {}) {
  return {
    slot: '9PM Draw',
    gameCode: '3d_lotto_9pm',
    gameName: '3D Lotto',
    numbers: [0, 0, 5],
    extraNumbers: [],
    prizeAmount: 4500,
    currency: 'PHP',
    winnersCount: 12,
    winnersStatus: 'final',
    sourceId: 3484,
    drawDate: '2026-11-27',
    ...overrides,
  };
}

function historyItem(overrides = {}) {
  return {
    id: 3484,
    drawDate: '2026-11-27',
    serverTime: '2026-11-27T21:00:00+08:00',
    games: [threeDGame({ drawDate: undefined })],
    ...overrides,
  };
}

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  delete global.fetch;
});

describe('fetchGameCodes', () => {
  it('requests /games with a minimal JSON header and discovers real codes', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse({
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
            id: 6,
            code: '3d_lotto_9pm',
            name: '3D Lotto',
            family: '3d',
            numberCount: 3,
            isActive: true,
          },
        ],
      })
    );

    await expect(fetchGameCodes()).resolves.toEqual([
      '3d_lotto_2pm',
      '3d_lotto_9pm',
    ]);
    expect(global.fetch).toHaveBeenCalledWith(GAMES_URL, {
      headers: { Accept: 'application/json' },
    });
  });

  it('throws instead of inventing a code when discovery finds none', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ items: [] }));
    await expect(fetchGameCodes()).rejects.toThrow('3D Lotto');
  });
});

describe('fetchLatestResults', () => {
  it('parses the real snapshot envelope, keeping leading zeros', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse({
        schemaVersion: '2.0.0',
        transformedAt: '2026-11-28T00:20:37.652Z',
        updatedAt: '2026-11-27T14:00:00.256Z',
        timezone: 'Asia/Manila',
        draws: [
          {
            id: 3484,
            drawDate: '2026-11-27',
            serverTime: '2026-11-27T21:00:00+08:00',
            games: [
              threeDGame(),
              { gameCode: 'megalotto_6_45', numbers: [1, 2, 3, 4, 5, 6] },
            ],
          },
        ],
        recentDraws: [{ id: 3484, drawDate: '2026-11-27' }],
      })
    );

    const result = await fetchLatestResults();

    expect(global.fetch).toHaveBeenCalledWith(LATEST_RESULTS_URL, {
      headers: { Accept: 'application/json' },
    });
    expect(result.records).toHaveLength(1);
    expect(result.records[0].result).toEqual(['0', '0', '5']);
    expect(result.records[0].id).toBe('v2-3484');
    expect(result.records[0].sources).toEqual(['latest']);
  });
});

describe('fetchHistoryPage', () => {
  it('uses gameCode, capped limit and the opaque cursor verbatim', async () => {
    global.fetch.mockResolvedValue(
      jsonResponse({
        schemaVersion: '2.0.0',
        timezone: 'Asia/Manila',
        items: [historyItem()],
        pageInfo: { nextCursor: '3483', hasNextPage: true },
      })
    );

    const result = await fetchHistoryPage({
      gameCode: '3d_lotto_9pm',
      cursor: '3483',
      limit: 999,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${HISTORY_RESULTS_URL}?gameCode=3d_lotto_9pm&limit=200&cursor=3483`,
      { headers: { Accept: 'application/json' } }
    );
    expect(result.records).toHaveLength(1);
    expect(result.pageInfo).toEqual({ nextCursor: '3483', hasNextPage: true });
  });

  it('refuses a missing game code without requesting anything', async () => {
    await expect(fetchHistoryPage()).rejects.toThrow('game code');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('fetchHistoryBundle', () => {
  it('aggregates one page per code without duplicate records', async () => {
    global.fetch.mockImplementation((url) => {
      const code = new URL(url).searchParams.get('gameCode');
      return Promise.resolve(
        jsonResponse({
          schemaVersion: '2.0.0',
          timezone: 'Asia/Manila',
          items: [
            historyItem({
              id: code === '3d_lotto_2pm' ? 3478 : 3484,
              games: [
                threeDGame({
                  gameCode: code,
                  sourceId: code === '3d_lotto_2pm' ? 3478 : 3484,
                }),
              ],
            }),
          ],
          pageInfo: {
            nextCursor: code === '3d_lotto_2pm' ? '3478' : null,
            hasNextPage: code === '3d_lotto_2pm',
          },
        })
      );
    });

    const bundle = await fetchHistoryBundle({
      gameCodes: ['3d_lotto_2pm', '3d_lotto_9pm'],
      cursors: { '3d_lotto_9pm': '3484' },
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(bundle.records).toHaveLength(2);
    expect(bundle.cursors).toEqual({ '3d_lotto_2pm': '3478' });
    expect(bundle.hasMore).toBe(true);
    expect(bundle.failedCodes).toEqual([]);
  });

  it('keeps successful pages when one cursor is expired', async () => {
    global.fetch.mockImplementation((url) => {
      const code = new URL(url).searchParams.get('gameCode');
      if (code === '3d_lotto_2pm') {
        return Promise.resolve(jsonResponse({ error: 'expired cursor' }, {
          ok: false,
          status: 400,
        }));
      }
      return Promise.resolve(
        jsonResponse({
          items: [historyItem({ id: 3484 })],
          pageInfo: { nextCursor: null, hasNextPage: false },
        })
      );
    });

    const bundle = await fetchHistoryBundle({
      gameCodes: ['3d_lotto_2pm', '3d_lotto_9pm'],
      cursors: {
        '3d_lotto_2pm': 'expired',
        '3d_lotto_9pm': '3484',
      },
    });

    expect(bundle.records).toHaveLength(1);
    expect(bundle.failedCodes).toEqual(['3d_lotto_2pm']);
    expect(bundle.cursors).toEqual({});
    expect(bundle.hasMore).toBe(false);
  });

  it('throws when every code fails', async () => {
    global.fetch.mockRejectedValue(new Error('offline'));

    await expect(
      fetchHistoryBundle({ gameCodes: ['3d_lotto_9pm'] })
    ).rejects.toBeInstanceOf(LotteryApiError);
  });
});
