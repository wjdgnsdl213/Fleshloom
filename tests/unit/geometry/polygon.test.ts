import { describe, expect, it } from 'vitest';
import {
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  signedPolygonArea,
} from '../../../src/core/geometry/polygon';

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('polygon geometry', () => {
  it('calculates signed and absolute area', () => {
    expect(signedPolygonArea(square)).toBe(100);
    expect(signedPolygonArea([...square].reverse())).toBe(-100);
    expect(polygonArea([...square].reverse())).toBe(100);
  });

  it('treats boundary points as captured', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 0, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 12, y: 5 }, square)).toBe(false);
  });

  it('does not treat a duplicate vertex as a segment containing every point', () => {
    const squareWithDuplicateVertex = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    expect(pointInPolygon({ x: 50, y: 50 }, squareWithDuplicateVertex)).toBe(false);
  });

  it('finds the polygon centroid regardless of winding', () => {
    expect(polygonCentroid(square)).toEqual({ x: 5, y: 5 });
    expect(polygonCentroid([...square].reverse())).toEqual({ x: 5, y: 5 });
  });

  it('returns safe values for degenerate input', () => {
    expect(polygonArea([])).toBe(0);
    expect(pointInPolygon({ x: 0, y: 0 }, [])).toBe(false);
    expect(polygonCentroid([])).toEqual({ x: 0, y: 0 });
  });
});
