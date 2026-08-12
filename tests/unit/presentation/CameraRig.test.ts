import { describe, expect, it } from 'vitest';
import { WORLD_TUNING } from '../../../src/config/world';
import { cameraViewportForScreen } from '../../../src/game/world/Camera2D';
import type { Camera2DSnapshot } from '../../../src/game/world/Camera2D';
import {
  CAMERA_RIG,
  resolveCameraFraming,
  verticalOverscanFor,
  worldToScene,
} from '../../../src/presentation/three/CameraRig';

const snapshotForScreen = (
  screenWidth: number,
  screenHeight: number,
): Camera2DSnapshot => {
  const viewport = cameraViewportForScreen(
    screenWidth,
    screenHeight,
    WORLD_TUNING.cameraZoom,
  );
  return {
    x: 1_600 - viewport.width / 2,
    y: 900 - viewport.height / 2,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    bounds: { minX: 0, minY: 0, maxX: 3_200, maxY: 1_800 },
  };
};

/** Every window size the rig is expected to hold the framing gate for. */
const SUPPORTED_SCREENS: readonly (readonly [number, number])[] = [
  [390, 844],
  [768, 1_024],
  [1_280, 720],
  [1_366, 768],
  [1_920, 1_080],
  [2_560, 1_440],
];

describe('worldToScene', () => {
  it('maps world y onto scene z and keeps elevation on y', () => {
    expect(worldToScene(120, 340, 25)).toEqual({ x: 120, y: 25, z: 340 });
  });

  it('places a point on the ground plane by default', () => {
    expect(worldToScene(1, 2).y).toBe(0);
  });
});

describe('resolveCameraFraming', () => {
  it('rejects a non-positive viewport', () => {
    expect(() =>
      resolveCameraFraming({
        ...snapshotForScreen(1_920, 1_080),
        viewportWidth: 0,
      }),
    ).toThrow(RangeError);
  });

  it('rejects a pitch outside (0, PI/2]', () => {
    const snapshot = snapshotForScreen(1_920, 1_080);
    expect(() => resolveCameraFraming(snapshot, 0)).toThrow(RangeError);
    expect(() => resolveCameraFraming(snapshot, Math.PI)).toThrow(RangeError);
  });

  it('accepts a straight-down pitch with no overscan at all', () => {
    const framing = resolveCameraFraming(
      snapshotForScreen(1_920, 1_080),
      Math.PI / 2,
    );
    expect(framing.verticalOverscan).toBeCloseTo(0, 6);
  });

  it('centres the rig on the world rect Camera2D chose', () => {
    const snapshot = snapshotForScreen(1_920, 1_080);
    const framing = resolveCameraFraming(snapshot);
    expect(framing.target.x).toBeCloseTo(1_600, 6);
    expect(framing.target.z).toBeCloseTo(900, 6);
    expect(framing.target.y).toBe(0);
  });

  it('stands the camera off along the pitch and looks back down', () => {
    const framing = resolveCameraFraming(snapshotForScreen(1_920, 1_080));
    const dx = framing.position.x - framing.target.x;
    const dy = framing.position.y - framing.target.y;
    const dz = framing.position.z - framing.target.z;
    expect(Math.hypot(dx, dy, dz)).toBeCloseTo(CAMERA_RIG.elevation, 6);
    expect(dy).toBeGreaterThan(0);
    expect(dz).toBeGreaterThan(0);
    expect(Math.atan2(dy, dz)).toBeCloseTo(CAMERA_RIG.pitchRadians, 6);
  });

  it('keeps the up vector unit length and perpendicular to the view', () => {
    const framing = resolveCameraFraming(snapshotForScreen(1_920, 1_080));
    const { up, position, target } = framing;
    expect(Math.hypot(up.x, up.y, up.z)).toBeCloseTo(1, 6);
    const view = {
      x: target.x - position.x,
      y: target.y - position.y,
      z: target.z - position.z,
    };
    const dot = up.x * view.x + up.y * view.y + up.z * view.z;
    expect(dot).toBeCloseTo(0, 6);
  });

  it('keeps the near plane in front of the far plane', () => {
    const framing = resolveCameraFraming(snapshotForScreen(1_920, 1_080));
    expect(framing.near).toBeGreaterThan(0);
    expect(framing.far).toBeGreaterThan(CAMERA_RIG.elevation);
  });

  it.each(SUPPORTED_SCREENS)(
    'matches the 2D horizontal framing exactly at %ix%i',
    (screenWidth, screenHeight) => {
      const snapshot = snapshotForScreen(screenWidth, screenHeight);
      const framing = resolveCameraFraming(snapshot);

      // Orthographic, so this holds at every row rather than only at the
      // camera target: no perspective divergence to erode it.
      expect(framing.halfWidth * 2).toBeCloseTo(snapshot.viewportWidth, 6);
      expect(framing.visibleGround.minX).toBeCloseTo(snapshot.x, 6);
      expect(framing.visibleGround.maxX).toBeCloseTo(
        snapshot.x + snapshot.viewportWidth,
        6,
      );
    },
  );

  it.each(SUPPORTED_SCREENS)(
    'stays within 2%% of the 2D vertical framing at %ix%i',
    (screenWidth, screenHeight) => {
      const snapshot = snapshotForScreen(screenWidth, screenHeight);
      const framing = resolveCameraFraming(snapshot);
      const depth =
        framing.visibleGround.maxZ - framing.visibleGround.minZ;

      // The tilt is meant to foreshorten, so the gate is on the projected
      // screen height rather than on raw ground depth.
      const projected = depth * Math.sin(CAMERA_RIG.pitchRadians);
      const drift =
        Math.abs(projected - snapshot.viewportHeight) /
        snapshot.viewportHeight;
      expect(drift).toBeLessThanOrEqual(0.02);
    },
  );

  it.each(SUPPORTED_SCREENS)(
    'contains the 2D rect without leaking past the spawn margin at %ix%i',
    (screenWidth, screenHeight) => {
      const snapshot = snapshotForScreen(screenWidth, screenHeight);
      const framing = resolveCameraFraming(snapshot);

      // Containment: nothing visible in 2D may disappear in 3D.
      expect(framing.visibleGround.minZ).toBeLessThanOrEqual(snapshot.y);
      expect(framing.visibleGround.maxZ).toBeGreaterThanOrEqual(
        snapshot.y + snapshot.viewportHeight,
      );

      // Overscan: nothing spawned beyond the margin may already be on screen.
      const top = snapshot.y - framing.visibleGround.minZ;
      const bottom =
        framing.visibleGround.maxZ - (snapshot.y + snapshot.viewportHeight);
      expect(top).toBeCloseTo(bottom, 6);
      expect(framing.verticalOverscan).toBeLessThan(
        WORLD_TUNING.spawnCameraMargin,
      );
      expect(top).toBeLessThan(WORLD_TUNING.spawnCameraMargin);
      expect(bottom).toBeLessThan(WORLD_TUNING.spawnCameraMargin);
    },
  );

  it('tracks the camera as it pans', () => {
    const base = snapshotForScreen(1_920, 1_080);
    const panned = resolveCameraFraming({ ...base, x: base.x + 250 });
    const origin = resolveCameraFraming(base);
    expect(panned.target.x - origin.target.x).toBeCloseTo(250, 6);
    expect(panned.target.z).toBeCloseTo(origin.target.z, 6);
  });
});

describe('verticalOverscanFor', () => {
  it('vanishes for a straight-down camera', () => {
    expect(verticalOverscanFor(1_000, Math.PI / 2)).toBeCloseTo(0, 6);
  });

  it('grows as the camera lies down toward the horizon', () => {
    const steep = verticalOverscanFor(1_000, (70 * Math.PI) / 180);
    const shallow = verticalOverscanFor(1_000, (45 * Math.PI) / 180);
    expect(shallow).toBeGreaterThan(steep);
  });

  it('agrees with the framing it is documented against', () => {
    const snapshot = snapshotForScreen(1_920, 1_080);
    const framing = resolveCameraFraming(snapshot);
    expect(framing.verticalOverscan).toBeCloseTo(
      verticalOverscanFor(snapshot.viewportHeight, CAMERA_RIG.pitchRadians),
      6,
    );
  });
});
