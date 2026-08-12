import { describe, expect, it } from 'vitest';
import {
  Camera2D,
  cameraViewportForScreen,
} from '../../../src/game/world/Camera2D';

const bounds = Object.freeze({
  minX: 0,
  minY: 0,
  maxX: 1_000,
  maxY: 600,
});

const createCamera = (): Camera2D =>
  new Camera2D({
    bounds,
    viewportWidth: 400,
    viewportHeight: 200,
    deadZoneRatioX: 0.5,
    deadZoneRatioY: 0.5,
    followSharpness: Math.log(2),
  });

describe('Camera2D', () => {
  it('converts screen pixels into a zoomed world-space viewport', () => {
    expect(cameraViewportForScreen(1_920, 1_080, 1.5)).toEqual({
      width: 1_280,
      height: 720,
    });
    expect(() => cameraViewportForScreen(1_920, 1_080, 0)).toThrow(
      RangeError,
    );
  });

  it('centers on a target and returns an immutable snapshot', () => {
    const camera = createCamera();

    camera.jumpTo({ x: 500, y: 300 });

    expect(camera.snapshot).toEqual({
      x: 300,
      y: 200,
      viewportWidth: 400,
      viewportHeight: 200,
      bounds,
    });
    expect(Object.isFrozen(camera.snapshot)).toBe(true);
    expect(Object.isFrozen(camera.snapshot.bounds)).toBe(true);
  });

  it('holds still inside the dead zone and eases after the target leaves it', () => {
    const camera = createCamera();
    camera.jumpTo({ x: 500, y: 300 });

    camera.update({ x: 590, y: 340 }, 1);
    expect(camera.snapshot.x).toBe(300);
    expect(camera.snapshot.y).toBe(200);

    camera.update({ x: 700, y: 420 }, 1);
    expect(camera.snapshot.x).toBeCloseTo(350);
    expect(camera.snapshot.y).toBeCloseTo(235);
  });

  it('never reveals space beyond a world edge', () => {
    const camera = createCamera();

    camera.jumpTo({ x: -100, y: -100 });
    expect(camera.snapshot.x).toBe(0);
    expect(camera.snapshot.y).toBe(0);

    camera.jumpTo({ x: 1_100, y: 700 });
    expect(camera.snapshot.x).toBe(600);
    expect(camera.snapshot.y).toBe(400);
  });

  it('preserves its world-space center across viewport resizing', () => {
    const camera = createCamera();
    camera.jumpTo({ x: 500, y: 300 });

    camera.resize(600, 300);

    expect(camera.snapshot.x).toBe(200);
    expect(camera.snapshot.y).toBe(150);
    expect(camera.snapshot.viewportWidth).toBe(600);
    expect(camera.snapshot.viewportHeight).toBe(300);
  });

  it('centers a world that is smaller than the viewport', () => {
    const camera = new Camera2D({
      bounds: { minX: 0, minY: 0, maxX: 200, maxY: 100 },
      viewportWidth: 400,
      viewportHeight: 200,
    });

    camera.jumpTo({ x: 100, y: 50 });

    expect(camera.snapshot.x).toBe(-100);
    expect(camera.snapshot.y).toBe(-50);
  });

  it('ignores invalid updates and rejects invalid configuration', () => {
    const camera = createCamera();
    camera.jumpTo({ x: 500, y: 300 });
    const before = camera.snapshot;

    camera.update({ x: Number.NaN, y: 300 }, 1);
    camera.update({ x: 900, y: 300 }, 0);
    expect(camera.snapshot).toEqual(before);

    expect(
      () =>
        new Camera2D({
          bounds,
          viewportWidth: 0,
          viewportHeight: 200,
        }),
    ).toThrow(RangeError);
  });
});
