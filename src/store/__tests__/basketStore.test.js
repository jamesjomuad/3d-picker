/**
 * Tests for the Selection Basket store
 */

import { loadBasket, saveBasket } from '@/services/basket-storage';
import { useBasketStore } from '@/store/basketStore';

// Mock the persistence service: the store logic under test is the
// timestamping and the duplicate rule, not AsyncStorage.
let mockStored = [];
jest.mock('@/services/basket-storage', () => ({
  loadBasket: jest.fn(async () => mockStored),
  saveBasket: jest.fn(async () => {}),
}));

const combination = (digits) => ({
  digits,
  path: [
    { row: 1, column: 1 },
    { row: 2, column: 3 },
  ],
});

/** Helper to reset the store to initial state */
function resetStore() {
  useBasketStore.setState({ entries: [], isLoaded: false });
}

/** Let the fire-and-forget persist promise settle. */
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('basketStore', () => {
  beforeEach(() => {
    resetStore();
    mockStored = [];
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stamps addedAt with the current time when a combination is added', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 23, 20, 35));

    useBasketStore.getState().add(combination('074'));

    const { entries } = useBasketStore.getState();
    expect(entries).toHaveLength(1);
    expect(entries[0].digits).toBe('074');
    expect(entries[0].addedAt).toBe(new Date(2026, 10, 23, 20, 35).toISOString());
  });

  it('refuses a duplicate digits entry and keeps the original timestamp', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 23, 20, 35));
    useBasketStore.getState().add(combination('074'));

    // Re-adding the same digits later must not touch the stored entry.
    jest.setSystemTime(new Date(2026, 11, 1, 8, 0));
    useBasketStore.getState().add({ digits: '074', path: [{ row: 9, column: 9 }] });

    const { entries } = useBasketStore.getState();
    expect(entries).toHaveLength(1);
    expect(entries[0].addedAt).toBe(new Date(2026, 10, 23, 20, 35).toISOString());
    expect(entries[0].path).toHaveLength(2);
  });

  it('persists entries including addedAt on add, remove and clear', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 23, 20, 35));
    const stamp = new Date(2026, 10, 23, 20, 35).toISOString();

    useBasketStore.getState().add(combination('074'));
    await flush();
    expect(saveBasket).toHaveBeenCalledWith([{ digits: '074', path: expect.any(Array), addedAt: stamp }]);

    useBasketStore.getState().add(combination('638'));
    useBasketStore.getState().remove('074');
    await flush();
    expect(useBasketStore.getState().entries.map((e) => e.digits)).toEqual(['638']);

    useBasketStore.getState().clear();
    await flush();
    expect(useBasketStore.getState().entries).toEqual([]);
    expect(saveBasket).toHaveBeenLastCalledWith([]);
  });

  it('loads saved entries once and tolerates legacy entries without addedAt', async () => {
    mockStored = [
      { digits: '952', path: [{ row: 0, column: 0 }], addedAt: '2026-11-23T12:00:00.000Z' },
      { digits: '111', path: [{ row: 3, column: 3 }] },
    ];

    await useBasketStore.getState().load();
    expect(useBasketStore.getState().entries).toHaveLength(2);
    expect(useBasketStore.getState().isLoaded).toBe(true);

    // A second mount must not clobber in-memory state with a re-read.
    mockStored = [];
    await useBasketStore.getState().load();
    expect(loadBasket).toHaveBeenCalledTimes(1);
    expect(useBasketStore.getState().entries).toHaveLength(2);
  });

  it('ignores malformed add input', () => {
    useBasketStore.getState().add(null);
    useBasketStore.getState().add({ path: [] });
    expect(useBasketStore.getState().entries).toHaveLength(0);
  });
});
