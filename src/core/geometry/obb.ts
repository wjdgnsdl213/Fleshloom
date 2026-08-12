/**
 * Oriented bounding boxes on the ground plane.
 *
 * The footprint corner math started life in the presentation layer
 * (ExtrudedVolume) where it only fed fake-3D drawing. Simulation-side
 * collision needs the same shape, and core must never import from
 * presentation, so the primitive lives here and presentation re-exports it.
 */

import type { Vec2 } from './vector';

export interface Obb {
  readonly center: Vec2;
  readonly halfLength: number;
  readonly halfWidth: number;
  readonly rotation: number;
  /** Unit vector along the box's length axis. */
  readonly axisX: Vec2;
  /** Unit vector along the box's width axis. */
  readonly axisY: Vec2;
}

function safeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

/** Builds an OBB with precomputed axes from authored footprint data. */
export function createObb(
  center: Vec2,
  length: number,
  width: number,
  rotation: number,
): Obb {
  const angle = safeNumber(rotation);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return Object.freeze({
    center: Object.freeze({
      x: safeNumber(center.x),
      y: safeNumber(center.y),
    }),
    halfLength: Math.max(0, safeNumber(length) * 0.5),
    halfWidth: Math.max(0, safeNumber(width) * 0.5),
    rotation: angle,
    axisX: Object.freeze({ x: cos, y: sin }),
    axisY: Object.freeze({ x: -sin, y: cos }),
  });
}

/** Corners of an oriented rectangle, in consistent counter-clockwise order. */
export function orientedQuadCorners(
  center: Vec2,
  length: number,
  width: number,
  angle: number,
): readonly Vec2[] {
  const halfLength = safeNumber(length) * 0.5;
  const halfWidth = safeNumber(width) * 0.5;
  const cos = Math.cos(safeNumber(angle));
  const sin = Math.sin(safeNumber(angle));
  const centerX = safeNumber(center.x);
  const centerY = safeNumber(center.y);

  return Object.freeze(
    (
      [
        [-halfLength, -halfWidth],
        [halfLength, -halfWidth],
        [halfLength, halfWidth],
        [-halfLength, halfWidth],
      ] as const
    ).map(([along, lateral]) =>
      Object.freeze({
        x: centerX + along * cos - lateral * sin,
        y: centerY + along * sin + lateral * cos,
      }),
    ),
  );
}

/** Corners of an already-built OBB, counter-clockwise. */
export function obbCorners(obb: Obb): readonly Vec2[] {
  return orientedQuadCorners(
    obb.center,
    obb.halfLength * 2,
    obb.halfWidth * 2,
    obb.rotation,
  );
}

/**
 * Expresses a world point in the box's local frame, where x runs along the
 * length axis and y along the width axis.
 */
export function toObbLocal(obb: Obb, point: Vec2): Vec2 {
  const dx = safeNumber(point.x) - obb.center.x;
  const dy = safeNumber(point.y) - obb.center.y;

  return {
    x: dx * obb.axisX.x + dy * obb.axisX.y,
    y: dx * obb.axisY.x + dy * obb.axisY.y,
  };
}

/** Converts a point in the box's local frame back to world space. */
export function fromObbLocal(obb: Obb, local: Vec2): Vec2 {
  return {
    x: obb.center.x + local.x * obb.axisX.x + local.y * obb.axisY.x,
    y: obb.center.y + local.x * obb.axisX.y + local.y * obb.axisY.y,
  };
}
