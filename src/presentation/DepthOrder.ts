/**
 * Pure depth keys for the fixed 3/4 world projection.
 *
 * Actors sort at their ground contact point. Raised props sort at the nearest
 * point of their ground footprint, so an actor above that point is hidden by
 * the prop and an actor below it is drawn in front.
 */

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function actorDepthKey(footpointY: number): number {
  return finiteOrZero(footpointY);
}

export function blockFootpointY(
  centerY: number,
  length: number,
  width: number,
  rotation: number,
): number {
  const resolvedRotation = finiteOrZero(rotation);
  const halfVerticalExtent =
    Math.abs(Math.sin(resolvedRotation)) * Math.abs(finiteOrZero(length)) * 0.5 +
    Math.abs(Math.cos(resolvedRotation)) * Math.abs(finiteOrZero(width)) * 0.5;

  return finiteOrZero(centerY) + halfVerticalExtent;
}

export function blockDepthKey(
  centerY: number,
  length: number,
  width: number,
  rotation: number,
): number {
  return blockFootpointY(centerY, length, width, rotation);
}

