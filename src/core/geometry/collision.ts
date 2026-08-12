/**
 * Circle-versus-OBB collision resolution for actors against street structures.
 *
 * Movement in FLESHLOOM is "seek → integrate → clamp"; before this module the
 * only spatial constraint was the arena rectangle, so every actor walked
 * straight through barricades and props. The resolver pushes a body's circle
 * out of any overlapping footprint while preserving tangential motion, so
 * actors slide along walls instead of sticking to them.
 *
 * Pure geometry over the ground plane. Capture polygons, the living tether,
 * rewards, and every locked loop rule are untouched by design: street debris
 * is low, so the tether passes over it and only bodies collide.
 */

import type { Vec2 } from './vector';
import { fromObbLocal, type Obb, toObbLocal } from './obb';

/**
 * Structural copy of the world-bounds shape. Core stays dependency-free of
 * config; `WorldBounds` from src/config/world satisfies this at call sites.
 */
export interface CollisionBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function safeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function safeRadius(radius: number): number {
  const resolved = safeNumber(radius, 0);
  return resolved > 0 ? resolved : 0;
}

const EPSILON = 1e-6;

/**
 * Pushes a circle out of one OBB. Returns the corrected centre, or the input
 * position unchanged (same reference) when there is no overlap.
 */
export function resolveCircleObb(
  position: Vec2,
  radius: number,
  collider: Obb,
): Vec2 {
  const bodyRadius = safeRadius(radius);
  const local = toObbLocal(collider, position);
  const clampedX = Math.min(
    collider.halfLength,
    Math.max(-collider.halfLength, local.x),
  );
  const clampedY = Math.min(
    collider.halfWidth,
    Math.max(-collider.halfWidth, local.y),
  );

  const insideBox = clampedX === local.x && clampedY === local.y;
  if (insideBox) {
    // Centre is inside the footprint: exit through the nearest face, then
    // stand the circle off that face by its radius.
    const exitRight = collider.halfLength - local.x;
    const exitLeft = local.x + collider.halfLength;
    const exitFar = collider.halfWidth - local.y;
    const exitNear = local.y + collider.halfWidth;
    const minExit = Math.min(exitRight, exitLeft, exitFar, exitNear);

    const exited = { x: local.x, y: local.y };
    if (minExit === exitRight) {
      exited.x = collider.halfLength + bodyRadius;
    } else if (minExit === exitLeft) {
      exited.x = -collider.halfLength - bodyRadius;
    } else if (minExit === exitFar) {
      exited.y = collider.halfWidth + bodyRadius;
    } else {
      exited.y = -collider.halfWidth - bodyRadius;
    }

    return fromObbLocal(collider, exited);
  }

  const offsetX = local.x - clampedX;
  const offsetY = local.y - clampedY;
  const distanceSquared = offsetX * offsetX + offsetY * offsetY;
  if (distanceSquared >= bodyRadius * bodyRadius || bodyRadius <= 0) {
    return position;
  }

  const distance = Math.sqrt(distanceSquared);
  if (distance < EPSILON) {
    // Touching the surface exactly: push along the dominant clamped axis.
    const alongX = Math.abs(local.x) >= Math.abs(local.y);
    return fromObbLocal(collider, {
      x: alongX
        ? clampedX + Math.sign(local.x || 1) * bodyRadius
        : clampedX,
      y: alongX
        ? clampedY
        : clampedY + Math.sign(local.y || 1) * bodyRadius,
    });
  }

  const scale = bodyRadius / distance;
  return fromObbLocal(collider, {
    x: clampedX + offsetX * scale,
    y: clampedY + offsetY * scale,
  });
}

/**
 * Resolves a circle against every collider. Two relaxation passes let
 * corner-pocket and multi-collider cases settle without oscillating.
 */
export function resolveCircleColliders(
  position: Vec2,
  radius: number,
  colliders: readonly Obb[],
): Vec2 {
  if (colliders.length === 0) {
    return position;
  }

  let resolved = position;
  for (let pass = 0; pass < 2; pass += 1) {
    let moved = false;
    for (const collider of colliders) {
      const next = resolveCircleObb(resolved, radius, collider);
      if (next !== resolved) {
        resolved = next;
        moved = true;
      }
    }
    if (!moved) {
      break;
    }
  }

  return resolved;
}

/** True when the circle overlaps no collider. */
export function isCircleFree(
  position: Vec2,
  radius: number,
  colliders: readonly Obb[],
): boolean {
  for (const collider of colliders) {
    if (resolveCircleObb(position, radius, collider) !== position) {
      return false;
    }
  }
  return true;
}

/**
 * Deterministic search for a collider-free position near a preferred point.
 * Used for spawn placement; walks an outward ring pattern, clamps each
 * candidate to the world bounds, and falls back to a plain resolve of the
 * preferred point when every candidate is blocked.
 */
export function findFreePosition(
  preferred: Vec2,
  radius: number,
  colliders: readonly Obb[],
  bounds: CollisionBounds,
  attempts = 12,
): Vec2 {
  const bodyRadius = safeRadius(radius);
  const clampToBounds = (point: Vec2): Vec2 => ({
    x: Math.min(
      bounds.maxX - bodyRadius,
      Math.max(bounds.minX + bodyRadius, safeNumber(point.x)),
    ),
    y: Math.min(
      bounds.maxY - bodyRadius,
      Math.max(bounds.minY + bodyRadius, safeNumber(point.y)),
    ),
  });

  const base = clampToBounds(preferred);
  if (isCircleFree(base, bodyRadius, colliders)) {
    return base;
  }

  const step = Math.max(bodyRadius * 2, 24);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const ring = 1 + Math.floor((attempt - 1) / 4);
    const angle = ((attempt - 1) % 4) * (Math.PI / 2) + ring * 0.7;
    const candidate = clampToBounds({
      x: base.x + Math.cos(angle) * step * ring,
      y: base.y + Math.sin(angle) * step * ring,
    });
    if (isCircleFree(candidate, bodyRadius, colliders)) {
      return candidate;
    }
  }

  return clampToBounds(
    resolveCircleColliders(base, bodyRadius, colliders),
  );
}
