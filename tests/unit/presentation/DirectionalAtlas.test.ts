import { describe, expect, it } from 'vitest';
import {
  directionalAtlasCell,
  directionalFrameIndexForAngle,
  directionalFrameIndexForVector,
} from '../../../src/presentation/DirectionalAtlas';
import {
  drifterDirectionalFamily,
  enemyDirectionalFrameIndex,
  enemySpriteRotation,
} from '../../../src/presentation/LoopPlaygroundRenderer';

describe('directional atlas', () => {
  it('maps screen-space compass angles to the authored N-to-NW order', () => {
    expect(directionalFrameIndexForAngle(-Math.PI / 2)).toBe(0);
    expect(directionalFrameIndexForAngle(-Math.PI / 4)).toBe(1);
    expect(directionalFrameIndexForAngle(0)).toBe(2);
    expect(directionalFrameIndexForAngle(Math.PI / 4)).toBe(3);
    expect(directionalFrameIndexForAngle(Math.PI / 2)).toBe(4);
    expect(directionalFrameIndexForAngle((Math.PI * 3) / 4)).toBe(5);
    expect(directionalFrameIndexForAngle(Math.PI)).toBe(6);
    expect(directionalFrameIndexForAngle((-Math.PI * 3) / 4)).toBe(7);
  });

  it('keeps the previous direction while a vector is effectively stationary', () => {
    expect(directionalFrameIndexForVector(0, 0, 7)).toBe(7);
    expect(directionalFrameIndexForVector(Number.NaN, 1, 3)).toBe(3);
  });

  it('resolves the two-row atlas coordinates', () => {
    expect(directionalAtlasCell(0)).toEqual({ column: 0, row: 0 });
    expect(directionalAtlasCell(3)).toEqual({ column: 3, row: 0 });
    expect(directionalAtlasCell(4)).toEqual({ column: 0, row: 1 });
    expect(directionalAtlasCell(7)).toEqual({ column: 3, row: 1 });
  });

  it('prefers velocity, falls back to facing, then preserves the last frame', () => {
    expect(
      enemyDirectionalFrameIndex(
        { x: 3, y: 0 },
        { x: 0, y: -1 },
        7,
      ),
    ).toBe(2);
    expect(
      enemyDirectionalFrameIndex(
        { x: 0, y: 0 },
        { x: -1, y: 0 },
        3,
      ),
    ).toBe(6);
    expect(
      enemyDirectionalFrameIndex(
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        7,
      ),
    ).toBe(7);
  });

  it('never rotates authored directional frames but preserves legacy rotation', () => {
    expect(enemySpriteRotation(true, 1.75)).toBe(0);
    expect(enemySpriteRotation(false, 1.75)).toBe(1.75);
  });

  it('uses ordinary zero-rotation frames after an armored Drifter is exposed', () => {
    const family = drifterDirectionalFamily('armored', false);

    expect(family).toBe('ordinary');
    expect(enemySpriteRotation(family === 'ordinary', 1.75)).toBe(0);
    expect(drifterDirectionalFamily('armored', true)).toBe('armored');
  });
});
