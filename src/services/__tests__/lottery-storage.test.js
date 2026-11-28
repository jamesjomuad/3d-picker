import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadDrawResults, saveDrawResults } from '../lottery-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const STORAGE_KEY = 'draw-results-v1';

function record(id) {
  return {
    id: `v2-${id}`,
    lottery: '3DL',
    result: ['0', '0', '5'],
    drawDate: '2026-11-27',
    drawTime: '21:00:00',
  };
}

describe('lottery-storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    console.warn.mockRestore();
  });

  it('round-trips the cache with v2 game codes and per-code cursors', async () => {
    const state = {
      records: [record(1)],
      nextCursor: '3478',
      hasMore: true,
      lastSyncAt: '2026-11-28T00:00:00.000Z',
      gameCodes: ['3d_lotto_2pm', '3d_lotto_9pm'],
      historyCursors: {
        '3d_lotto_2pm': '3478',
        '3d_lotto_9pm': '3484',
      },
    };

    await saveDrawResults(state);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);

    const [key, raw] = AsyncStorage.setItem.mock.calls[0];
    expect(key).toBe(STORAGE_KEY);
    expect(JSON.parse(raw)).toMatchObject({
      version: 1,
      ...state,
    });

    AsyncStorage.getItem.mockResolvedValue(raw);
    await expect(loadDrawResults()).resolves.toEqual(state);
  });

  it('loads old caches without v2 metadata safely', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify({
        version: 1,
        records: [record(1)],
        nextCursor: null,
        hasMore: false,
        lastSyncAt: null,
      })
    );

    await expect(loadDrawResults()).resolves.toEqual({
      records: [record(1)],
      nextCursor: null,
      hasMore: false,
      lastSyncAt: null,
      gameCodes: [],
      historyCursors: {},
    });
  });

  it('sanitizes malformed cached metadata', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify({
        version: 1,
        records: [record(1), { id: 'bad' }],
        nextCursor: 42,
        hasMore: true,
        lastSyncAt: 99,
        gameCodes: ['3d_lotto_2pm', '', '3d_lotto_2pm', 7],
        historyCursors: { '3d_lotto_2pm': '3478', bad: '', nope: 9 },
      })
    );

    await expect(loadDrawResults()).resolves.toEqual({
      records: [record(1)],
      nextCursor: null,
      hasMore: true,
      lastSyncAt: null,
      gameCodes: ['3d_lotto_2pm'],
      historyCursors: { '3d_lotto_2pm': '3478' },
    });
  });

  it('returns an empty cache on read failure', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('storage down'));

    await expect(loadDrawResults()).resolves.toEqual({
      records: [],
      nextCursor: null,
      hasMore: false,
      lastSyncAt: null,
      gameCodes: [],
      historyCursors: {},
    });
  });
});
