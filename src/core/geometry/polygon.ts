import type { Vec2 } from './vector';

const BOUNDARY_EPSILON = 1e-6;

export function signedPolygonArea(points: readonly Vec2[]): number {
  if (points.length < 3) {
    return 0;
  }

  let doubleArea = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    doubleArea += current.x * next.y - next.x * current.y;
  }

  return doubleArea / 2;
}

export function polygonArea(points: readonly Vec2[]): number {
  return Math.abs(signedPolygonArea(points));
}

export function polygonCentroid(points: readonly Vec2[]): Vec2 {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  const signedArea = signedPolygonArea(points);

  if (Math.abs(signedArea) < BOUNDARY_EPSILON) {
    const total = points.reduce(
      (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
      { x: 0, y: 0 },
    );

    return { x: total.x / points.length, y: total.y / points.length };
  }

  let weightedX = 0;
  let weightedY = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    const cross = current.x * next.y - next.x * current.y;
    weightedX += (current.x + next.x) * cross;
    weightedY += (current.y + next.y) * cross;
  }

  const divisor = 6 * signedArea;
  return { x: weightedX / divisor, y: weightedY / divisor };
}

export function pointInPolygon(point: Vec2, polygon: readonly Vec2[]): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index]!;
    const previous = polygon[previousIndex]!;

    if (pointOnSegment(point, previous, current)) {
      return true;
    }

    const crossesHorizontalRay =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x;

    if (crossesHorizontalRay) {
      inside = !inside;
    }
  }

  return inside;
}

function pointOnSegment(point: Vec2, start: Vec2, end: Vec2): boolean {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const pointX = point.x - start.x;
  const pointY = point.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (lengthSquared <= BOUNDARY_EPSILON) {
    return pointX * pointX + pointY * pointY <= BOUNDARY_EPSILON;
  }

  const cross = segmentX * pointY - segmentY * pointX;

  if (Math.abs(cross) > BOUNDARY_EPSILON) {
    return false;
  }

  const dot = pointX * segmentX + pointY * segmentY;
  if (dot < -BOUNDARY_EPSILON) {
    return false;
  }

  return dot <= lengthSquared + BOUNDARY_EPSILON;
}
