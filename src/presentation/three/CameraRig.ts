/**
 * The 3D camera rig, derived entirely from the existing Camera2D snapshot.
 *
 * World (x, y) maps to scene (x, elevation, y): the ground is the XZ plane and
 * +Z runs down-screen, exactly as +y does in the 2D renderer. The rig then has
 * one job — frame the same world rectangle Camera2D already chose — so the
 * dead zone, the world clamp, the spawn margin, and the screen-space touch
 * joystick all keep working without a single change.
 *
 * The projection is ORTHOGRAPHIC, which departs from the long-lens perspective
 * sketched during planning. A tilted perspective camera cannot hold the 2D
 * framing: rows nearer the camera show less world horizontally than rows
 * further away, so the rect is either clipped at the bottom corners or
 * overscanned past `spawnCameraMargin` at the top, and the overscan grows with
 * the window. At fovY 22 deg / pitch 60 deg the top edge already leaks 171
 * world units at 1080p against a 120 unit margin. Orthographic removes the
 * divergence outright: horizontal framing matches the 2D renderer exactly at
 * every row, and the only deviation left is the vertical foreshortening the
 * tilt is there to produce. That residual is bounded below — see
 * `verticalOverscan` — and stays under the spawn margin at every supported
 * window size. Depth still reads from the tilt, the shadows, the occlusion,
 * and the articulated silhouettes rather than from lens divergence, which is
 * also closer to the flat perspective of the styleframe.
 */

import type { Camera2DSnapshot } from '../../game/world/Camera2D';

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface VisibleGround {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface CameraFraming {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly up: Vec3;
  /** Orthographic half-extents, in world units. */
  readonly halfWidth: number;
  readonly halfHeight: number;
  readonly near: number;
  readonly far: number;
  /**
   * Extra world units visible past each horizontal edge of the 2D rect. The
   * tilt foreshortens the ground, so the same screen height covers more world
   * depth; this is how much more, per edge.
   */
  readonly verticalOverscan: number;
  readonly visibleGround: VisibleGround;
}

export const CAMERA_RIG = Object.freeze({
  /**
   * 60 deg from the ground plane. Shallower reads more cinematic but the
   * foreshortening overscan is H * (1 - sin p) / (2 sin p) per edge, which
   * passes 120 world units around 54 deg on a 1440p window.
   */
  pitchRadians: (60 * Math.PI) / 180,
  /** Orthographic, so this only sets clipping and light/fog distances. */
  elevation: 3_000,
  nearPlane: 10,
  farPadding: 4_000,
});

const isFinitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

/** Scene-space point for a world position at the given elevation. */
export const worldToScene = (
  x: number,
  y: number,
  elevation = 0,
): Vec3 => Object.freeze({ x, y: elevation, z: y });

/**
 * World units of extra ground depth revealed past each horizontal edge of the
 * 2D viewport rect, purely from foreshortening.
 */
export const verticalOverscanFor = (
  viewportHeight: number,
  pitchRadians: number,
): number => {
  const sinPitch = Math.sin(pitchRadians);
  return (viewportHeight * (1 - sinPitch)) / (2 * sinPitch);
};

export function resolveCameraFraming(
  camera: Camera2DSnapshot,
  pitchRadians: number = CAMERA_RIG.pitchRadians,
): CameraFraming {
  if (
    !isFinitePositive(camera.viewportWidth) ||
    !isFinitePositive(camera.viewportHeight)
  ) {
    throw new RangeError('camera viewport dimensions must be positive');
  }
  if (
    !Number.isFinite(pitchRadians) ||
    pitchRadians <= 0 ||
    pitchRadians > Math.PI / 2
  ) {
    throw new RangeError('camera pitch must be within (0, PI/2]');
  }
  if (!Number.isFinite(camera.x) || !Number.isFinite(camera.y)) {
    throw new RangeError('camera origin must be finite');
  }

  const sinPitch = Math.sin(pitchRadians);
  const cosPitch = Math.cos(pitchRadians);
  const centerX = camera.x + camera.viewportWidth / 2;
  const centerY = camera.y + camera.viewportHeight / 2;

  // Half-extents equal to the 2D rect: the ortho box is the viewport, so
  // horizontal scale matches the 2D renderer exactly.
  const halfWidth = camera.viewportWidth / 2;
  const halfHeight = camera.viewportHeight / 2;

  const elevation = CAMERA_RIG.elevation;
  const target = worldToScene(centerX, centerY);
  const position = Object.freeze({
    x: centerX,
    y: elevation * sinPitch,
    z: centerY + elevation * cosPitch,
  });

  // Camera up, rotated by the pitch so screen-up runs away from the camera
  // along the ground.
  const up = Object.freeze({ x: 0, y: cosPitch, z: -sinPitch });

  // A screen half-height of `halfHeight` covers halfHeight / sin(pitch) of
  // ground depth once the tilt foreshortens it.
  const halfDepth = halfHeight / sinPitch;
  const overscan = halfDepth - halfHeight;

  return Object.freeze({
    position,
    target,
    up,
    halfWidth,
    halfHeight,
    near: CAMERA_RIG.nearPlane,
    far: elevation + CAMERA_RIG.farPadding,
    verticalOverscan: overscan,
    visibleGround: Object.freeze({
      minX: centerX - halfWidth,
      maxX: centerX + halfWidth,
      minZ: centerY - halfDepth,
      maxZ: centerY + halfDepth,
    }),
  });
}
