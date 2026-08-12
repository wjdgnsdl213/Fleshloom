import { describe, expect, it } from 'vitest';
import type { Camera2DSnapshot } from '../../../src/game/world/Camera2D';
import { selectOffscreenSpawnRegion } from '../../../src/game/world/WorldSpawnRegion';

const world = Object.freeze({ minX: 0, minY: 0, maxX: 1_200, maxY: 800 });
const config = Object.freeze({
  cameraMargin: 60,
  bandDepth: 180,
  flankPadding: 100,
  minimumDepth: 80,
  minimumSpan: 160,
});

const cameraAt = (x: number, y: number): Camera2DSnapshot =>
  Object.freeze({
    x,
    y,
    viewportWidth: 400,
    viewportHeight: 240,
    bounds: world,
  });

describe('selectOffscreenSpawnRegion', () => {
  it('selects the preferred offscreen side when enough world remains', () => {
    const camera = cameraAt(300, 250);
    const right = selectOffscreenSpawnRegion(camera, world, 0, config);
    const bottom = selectOffscreenSpawnRegion(camera, world, 1, config);

    expect(right).toEqual({ minX: 760, minY: 150, maxX: 940, maxY: 590 });
    expect(bottom).toEqual({ minX: 200, minY: 550, maxX: 800, maxY: 730 });
    expect(Object.isFrozen(right)).toBe(true);
  });

  it('rotates to another valid side at a world edge', () => {
    const camera = cameraAt(800, 250);

    expect(selectOffscreenSpawnRegion(camera, world, 0, config)).toEqual({
      minX: 700,
      minY: 550,
      maxX: 1_200,
      maxY: 730,
    });
  });

  it('keeps every returned band inside the world and beyond the viewport margin', () => {
    const camera = cameraAt(300, 250);

    for (let side = 0; side < 4; side += 1) {
      const region = selectOffscreenSpawnRegion(camera, world, side, config)!;
      expect(region.minX).toBeGreaterThanOrEqual(world.minX);
      expect(region.minY).toBeGreaterThanOrEqual(world.minY);
      expect(region.maxX).toBeLessThanOrEqual(world.maxX);
      expect(region.maxY).toBeLessThanOrEqual(world.maxY);

      const separated =
        region.minX >= camera.x + camera.viewportWidth + config.cameraMargin ||
        region.maxX <= camera.x - config.cameraMargin ||
        region.minY >= camera.y + camera.viewportHeight + config.cameraMargin ||
        region.maxY <= camera.y - config.cameraMargin;
      expect(separated).toBe(true);
    }
  });

  it('returns null when the viewport leaves no usable offscreen band', () => {
    const fullWorldCamera: Camera2DSnapshot = Object.freeze({
      x: 0,
      y: 0,
      viewportWidth: 1_200,
      viewportHeight: 800,
      bounds: world,
    });

    expect(
      selectOffscreenSpawnRegion(fullWorldCamera, world, 0, config),
    ).toBeNull();
  });

  it('rejects invalid indices and geometry without throwing', () => {
    expect(
      selectOffscreenSpawnRegion(cameraAt(300, 250), world, 0.5, config),
    ).toBeNull();
    expect(
      selectOffscreenSpawnRegion(cameraAt(300, 250), world, 0, {
        ...config,
        bandDepth: Number.NaN,
      }),
    ).toBeNull();
  });
});
