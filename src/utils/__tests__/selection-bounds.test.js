/**
 * Selection bounds and solidity tests
 *
 * These two engine helpers decide what a drag-fill can use as its pattern: only
 * a solid rectangle of selected cells tiles cleanly.
 */

import { getSelectionBounds, isSolidRectangle } from '../selection';

const cells = (...keys) => new Set(keys);

describe('getSelectionBounds', () => {
  it('has no bounds without cells', () => {
    expect(getSelectionBounds(null)).toBeNull();
    expect(getSelectionBounds(cells())).toBeNull();
  });

  it('reports a single cell as a 1x1 area', () => {
    expect(getSelectionBounds(cells('2,3'))).toEqual({
      minRow: 2,
      minCol: 3,
      maxRow: 2,
      maxCol: 3,
      count: 1,
    });
  });

  it('orders the corners no matter how the keys were added', () => {
    const bounds = getSelectionBounds(cells('3,3', '1,1', '2,4'));

    expect(bounds.minRow).toBe(1);
    expect(bounds.minCol).toBe(1);
    expect(bounds.maxRow).toBe(3);
    expect(bounds.maxCol).toBe(4);
    expect(bounds.count).toBe(3);
  });

  it('spans the whole board for a full one', () => {
    const all = cells(
      ...Array.from({ length: 100 }, (_, i) => `${Math.floor(i / 10)},${i % 10}`)
    );
    const bounds = getSelectionBounds(all);

    expect(bounds).toMatchObject({ minRow: 0, minCol: 0, maxRow: 9, maxCol: 9, count: 100 });
  });
});

describe('isSolidRectangle', () => {
  it('is false with nothing selected', () => {
    expect(isSolidRectangle(cells())).toBe(false);
    expect(isSolidRectangle(null)).toBe(false);
  });

  it('is true when the count fills its own bounding box', () => {
    expect(isSolidRectangle(cells('1,1'))).toBe(true);
    expect(isSolidRectangle(cells('0,0', '0,1', '0,2'))).toBe(true);
    expect(
      isSolidRectangle(
        cells('0,0', '0,1', '1,0', '1,1', '2,0', '2,1')
      )
    ).toBe(true);
  });

  it('is false for an L, a hole, or a partial pair of rows', () => {
    expect(isSolidRectangle(cells('0,0', '1,0', '1,1'))).toBe(false);
    expect(
      isSolidRectangle(
        cells('0,0', '0,1', '1,0', '1,1', '0,2', '1,2', '2,0', '2,1')
      )
    ).toBe(false);
    expect(isSolidRectangle(cells('0,0', '0,1', '1,1'))).toBe(false);
  });

  it('is false for a rectangle with one corner missing', () => {
    expect(isSolidRectangle(cells('0,0', '0,1', '1,0'))).toBe(false);
  });
});
