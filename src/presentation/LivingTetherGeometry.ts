import type { Vec2 } from '../core/geometry/vector';

export interface TetherPathSample {
  readonly position: Vec2;
  readonly tangent: Vec2;
  readonly normal: Vec2;
  readonly distance: number;
}

const cleanZero = (value: number): number => (Object.is(value, -0) ? 0 : value);

export function polylineLength(points: readonly Vec2[], closed = false): number {
  if (points.length < 2) {
    return 0;
  }

  let total = 0;
  const segmentCount = points.length - 1 + (closed ? 1 : 0);
  for (let index = 0; index < segmentCount; index += 1) {
    const start = points[index % points.length]!;
    const end = points[(index + 1) % points.length]!;
    total += Math.hypot(end.x - start.x, end.y - start.y);
  }
  return total;
}

export function samplePolylineAtDistance(
  points: readonly Vec2[],
  requestedDistance: number,
  closed = false,
): TetherPathSample | null {
  const total = polylineLength(points, closed);
  if (points.length < 2 || total <= 0 || !Number.isFinite(requestedDistance)) {
    return null;
  }

  const distance = closed
    ? ((requestedDistance % total) + total) % total
    : Math.max(0, Math.min(total, requestedDistance));
  const segmentCount = points.length - 1 + (closed ? 1 : 0);
  let traversed = 0;

  for (let index = 0; index < segmentCount; index += 1) {
    const start = points[index % points.length]!;
    const end = points[(index + 1) % points.length]!;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length <= Number.EPSILON) {
      continue;
    }

    if (traversed + length >= distance || index === segmentCount - 1) {
      const amount = Math.max(0, Math.min(1, (distance - traversed) / length));
      const tangent = { x: cleanZero(dx / length), y: cleanZero(dy / length) };
      return {
        position: {
          x: start.x + dx * amount,
          y: start.y + dy * amount,
        },
        tangent,
        normal: {
          x: cleanZero(-tangent.y),
          y: cleanZero(tangent.x),
        },
        distance,
      };
    }
    traversed += length;
  }

  return null;
}

export function samplesAtSpacing(
  points: readonly Vec2[],
  spacing: number,
  closed = false,
  startOffset = 0,
): readonly TetherPathSample[] {
  if (points.length < 2 || !Number.isFinite(spacing) || spacing <= 0) {
    return [];
  }

  const segmentCount = points.length - 1 + (closed ? 1 : 0);
  const cumulativeDistances = new Float64Array(segmentCount + 1);
  for (let index = 0; index < segmentCount; index += 1) {
    const start = points[index % points.length]!;
    const end = points[(index + 1) % points.length]!;
    cumulativeDistances[index + 1] =
      cumulativeDistances[index]! +
      Math.hypot(end.x - start.x, end.y - start.y);
  }

  const total = cumulativeDistances[segmentCount]!;
  const firstDistance = Math.max(0, startOffset);
  if (total <= 0 || firstDistance >= total) {
    return [];
  }

  const samples: TetherPathSample[] = [];
  let segmentIndex = 0;
  for (let distance = firstDistance; distance < total; distance += spacing) {
    while (
      segmentIndex < segmentCount - 1 &&
      cumulativeDistances[segmentIndex + 1]! < distance
    ) {
      segmentIndex += 1;
    }
    while (
      segmentIndex < segmentCount &&
      cumulativeDistances[segmentIndex + 1]! -
        cumulativeDistances[segmentIndex]! <=
        Number.EPSILON
    ) {
      segmentIndex += 1;
    }
    if (segmentIndex >= segmentCount) {
      break;
    }

    const start = points[segmentIndex % points.length]!;
    const end = points[(segmentIndex + 1) % points.length]!;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length =
      cumulativeDistances[segmentIndex + 1]! -
      cumulativeDistances[segmentIndex]!;
    const amount = Math.max(
      0,
      Math.min(
        1,
        (distance - cumulativeDistances[segmentIndex]!) / length,
      ),
    );
    const tangent = { x: cleanZero(dx / length), y: cleanZero(dy / length) };
    samples.push({
      position: {
        x: start.x + dx * amount,
        y: start.y + dy * amount,
      },
      tangent,
      normal: {
        x: cleanZero(-tangent.y),
        y: cleanZero(tangent.x),
      },
      distance,
    });
  }
  return samples;
}

export function strandPointsFromSamples(
  samples: readonly TetherPathSample[],
  amplitude: number,
  wavelength: number,
  phase: number,
): readonly Vec2[] {
  if (!Number.isFinite(wavelength) || wavelength <= 0) {
    return [];
  }

  return samples.map((sample) => {
    const offset =
      Math.sin((sample.distance / wavelength) * Math.PI * 2 + phase) *
      amplitude;
    return {
      x: sample.position.x + sample.normal.x * offset,
      y: sample.position.y + sample.normal.y * offset,
    };
  });
}

export function wovenStrandPoints(
  points: readonly Vec2[],
  spacing: number,
  amplitude: number,
  wavelength: number,
  phase: number,
  closed = false,
): readonly Vec2[] {
  return strandPointsFromSamples(
    samplesAtSpacing(points, spacing, closed),
    amplitude,
    wavelength,
    phase,
  );
}
