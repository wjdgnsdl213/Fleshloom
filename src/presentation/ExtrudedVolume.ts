/**
 * Fake-volume projection for the 3/4 top-down district.
 *
 * Until this module existed every world object was a flat shape painted on the
 * ground plane, so the scene read as a texture rather than a space. A raised
 * object in this camera needs three parts: a top face displaced up-screen from
 * its ground footprint, the near side faces that connect the two, and a cast
 * shadow thrown along the fixed key light.
 *
 * Pure geometry. Nothing here touches Pixi. Body collision against these
 * footprints lives in src/core/geometry/collision.ts (D-028); capture and
 * reward rules still ignore them.
 */

import type { Vec2 } from '../core/geometry/vector';
import { orientedQuadCorners } from '../core/geometry/obb';
import { SCENE_SHADOW_DIRECTION } from './GroundedLighting';

/**
 * Footprint corner math moved to core (src/core/geometry/obb.ts) so the
 * simulation-side collision resolver can share it; re-exported here for the
 * presentation call sites.
 */
export { orientedQuadCorners };

export interface ScreenOffset {
  readonly x: number;
  readonly y: number;
}

export interface SideFace {
  /** Footprint edge, ordered so the outward normal points toward the viewer. */
  readonly base: readonly [Vec2, Vec2];
  /** Matching edge on the displaced top face. */
  readonly top: readonly [Vec2, Vec2];
  /** 0 = fully turned away from the key light, 1 = fully lit. */
  readonly shade: number;
}

export const VOLUME_PROJECTION = Object.freeze({
  /**
   * Screen displacement per unit of object height. The camera is a low 3/4, so
   * height reads mostly as an up-screen shift rather than a full side view.
   */
  heightToScreen: 0.62,
  /** Cast shadow reach per unit of height. */
  shadowReachPerHeight: 0.78,
  shadowAlpha: 0.46,
  /** Tone multipliers applied to the object's base colour. */
  topFaceShade: 1,
  litSideShade: 0.72,
  darkSideShade: 0.34,
});

function safeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function safeHeight(height: number): number {
  const resolved = safeNumber(height, 0);
  return resolved > 0 ? resolved : 0;
}

/** Screen displacement from an object's ground footprint to its top face. */
export function volumeTopOffset(height: number): ScreenOffset {
  return Object.freeze({
    x: 0,
    y: -safeHeight(height) * VOLUME_PROJECTION.heightToScreen,
  });
}

/** Screen displacement from an object's footprint to its cast shadow. */
export function volumeShadowOffset(height: number): ScreenOffset {
  const reach = safeHeight(height) * VOLUME_PROJECTION.shadowReachPerHeight;

  return Object.freeze({
    x: SCENE_SHADOW_DIRECTION.x * reach,
    y: SCENE_SHADOW_DIRECTION.y * reach,
  });
}

/**
 * How strongly a wall facing `normal` catches the key light. The key light is
 * opposite the shadow direction, so a face pointing back along the shadow
 * vector is the one turned away from it.
 */
export function faceShade(normal: ScreenOffset): number {
  const length = Math.hypot(safeNumber(normal.x), safeNumber(normal.y));
  if (length <= 0) {
    return VOLUME_PROJECTION.darkSideShade;
  }

  const towardLight =
    (-safeNumber(normal.x) * SCENE_SHADOW_DIRECTION.x -
      safeNumber(normal.y) * SCENE_SHADOW_DIRECTION.y) /
    length;
  const unit = (towardLight + 1) * 0.5;

  return (
    VOLUME_PROJECTION.darkSideShade +
    (VOLUME_PROJECTION.litSideShade - VOLUME_PROJECTION.darkSideShade) * unit
  );
}

/**
 * The side faces of an extruded footprint that the camera can actually see.
 *
 * A face is visible when its outward normal points down-screen, toward the
 * viewer. Footprint corners must be given in counter-clockwise screen order,
 * which is what {@link orientedQuadCorners} returns.
 */
export function visibleSideFaces(
  footprint: readonly Vec2[],
  height: number,
): readonly SideFace[] {
  if (footprint.length < 3) {
    return Object.freeze([]);
  }

  const top = volumeTopOffset(height);
  if (top.y === 0) {
    return Object.freeze([]);
  }

  const faces: SideFace[] = [];
  for (let index = 0; index < footprint.length; index += 1) {
    const start = footprint[index]!;
    const end = footprint[(index + 1) % footprint.length]!;
    const edgeX = end.x - start.x;
    const edgeY = end.y - start.y;
    // Outward normal for counter-clockwise screen-space winding.
    const normal = { x: edgeY, y: -edgeX };
    if (normal.y <= 0) {
      continue;
    }

    faces.push(
      Object.freeze({
        base: Object.freeze([start, end] as const),
        top: Object.freeze([
          Object.freeze({ x: start.x + top.x, y: start.y + top.y }),
          Object.freeze({ x: end.x + top.x, y: end.y + top.y }),
        ] as const),
        shade: faceShade(normal),
      }),
    );
  }

  return Object.freeze(faces);
}

/**
 * Multiplies a packed RGB colour by a shade factor so side faces can be tinted
 * darker than the top face without authoring a second palette entry.
 */
export function shadeColor(color: number, factor: number): number {
  const clampedFactor = Math.max(0, safeNumber(factor, 0));
  const source = Math.max(0, Math.min(0xffffff, Math.round(safeNumber(color))));
  const red = Math.min(255, Math.round(((source >> 16) & 0xff) * clampedFactor));
  const green = Math.min(255, Math.round(((source >> 8) & 0xff) * clampedFactor));
  const blue = Math.min(255, Math.round((source & 0xff) * clampedFactor));

  return (red << 16) | (green << 8) | blue;
}

/** Translates a footprint by a screen offset, for top faces and shadows. */
export function translateFootprint(
  footprint: readonly Vec2[],
  offset: ScreenOffset,
): readonly Vec2[] {
  return Object.freeze(
    footprint.map((point) =>
      Object.freeze({
        x: safeNumber(point.x) + safeNumber(offset.x),
        y: safeNumber(point.y) + safeNumber(offset.y),
      }),
    ),
  );
}
