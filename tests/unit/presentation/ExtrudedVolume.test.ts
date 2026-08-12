import { describe, expect, it } from 'vitest';
import {
  faceShade,
  orientedQuadCorners,
  shadeColor,
  translateFootprint,
  visibleSideFaces,
  VOLUME_PROJECTION,
  volumeShadowOffset,
  volumeTopOffset,
} from '../../../src/presentation/ExtrudedVolume';

const unitQuad = orientedQuadCorners({ x: 0, y: 0 }, 100, 60, 0);

describe('extruded district volumes', () => {
  it('lifts the top face up-screen from the ground footprint', () => {
    const offset = volumeTopOffset(40);

    expect(offset.x).toBe(0);
    expect(offset.y).toBeLessThan(0);
  });

  it('throws taller shadows further along the key light', () => {
    const low = volumeShadowOffset(10);
    const tall = volumeShadowOffset(40);

    expect(tall.x).toBeGreaterThan(low.x);
    expect(tall.y).toBeGreaterThan(low.y);
    expect(low.x).toBeGreaterThan(0);
    expect(low.y).toBeGreaterThan(0);
  });

  it('builds an oriented footprint with four corners', () => {
    expect(unitQuad).toHaveLength(4);
    expect(unitQuad[0]!.x).toBeCloseTo(-50, 6);
    expect(unitQuad[0]!.y).toBeCloseTo(-30, 6);
    expect(unitQuad[2]!.x).toBeCloseTo(50, 6);
    expect(unitQuad[2]!.y).toBeCloseTo(30, 6);
  });

  it('rotates the footprint around its centre', () => {
    const rotated = orientedQuadCorners(
      { x: 10, y: 10 },
      100,
      60,
      Math.PI / 2,
    );
    const centroidX =
      rotated.reduce((total, point) => total + point.x, 0) / rotated.length;
    const centroidY =
      rotated.reduce((total, point) => total + point.y, 0) / rotated.length;

    expect(centroidX).toBeCloseTo(10, 6);
    expect(centroidY).toBeCloseTo(10, 6);
  });

  it('only keeps side faces that turn toward the viewer', () => {
    const faces = visibleSideFaces(unitQuad, 30);

    expect(faces.length).toBeGreaterThan(0);
    expect(faces.length).toBeLessThan(4);
    for (const face of faces) {
      const edgeX = face.base[1].x - face.base[0].x;
      const edgeY = face.base[1].y - face.base[0].y;
      const outwardNormalY = -edgeX;
      expect(outwardNormalY).toBeGreaterThan(0);
      expect(Number.isFinite(edgeY)).toBe(true);
    }
  });

  it('connects each visible face to the lifted top edge', () => {
    const [face] = visibleSideFaces(unitQuad, 30);

    expect(face).toBeDefined();
    expect(face!.top[0].y).toBeLessThan(face!.base[0].y);
    expect(face!.top[0].x).toBeCloseTo(face!.base[0].x, 6);
  });

  it('shades faces between the authored dark and lit tones', () => {
    const towardLight = faceShade({ x: -1, y: -1 });
    const awayFromLight = faceShade({ x: 1, y: 1 });

    expect(towardLight).toBeGreaterThan(awayFromLight);
    expect(awayFromLight).toBeGreaterThanOrEqual(
      VOLUME_PROJECTION.darkSideShade,
    );
    expect(towardLight).toBeLessThanOrEqual(VOLUME_PROJECTION.litSideShade);
  });

  it('returns no volume for flat or degenerate footprints', () => {
    expect(visibleSideFaces(unitQuad, 0)).toHaveLength(0);
    expect(visibleSideFaces(unitQuad, Number.NaN)).toHaveLength(0);
    expect(visibleSideFaces([{ x: 0, y: 0 }], 30)).toHaveLength(0);
  });

  it('darkens a packed colour per channel without overflowing', () => {
    expect(shadeColor(0x808080, 0.5)).toBe(0x404040);
    expect(shadeColor(0xffffff, 1)).toBe(0xffffff);
    expect(shadeColor(0xffffff, 4)).toBe(0xffffff);
    expect(shadeColor(0x123456, 0)).toBe(0x000000);
    expect(shadeColor(0x123456, Number.NaN)).toBe(0x000000);
  });

  it('translates a footprint without mutating the source', () => {
    const moved = translateFootprint(unitQuad, { x: 5, y: -7 });

    expect(moved[0]!.x).toBeCloseTo(unitQuad[0]!.x + 5, 6);
    expect(moved[0]!.y).toBeCloseTo(unitQuad[0]!.y - 7, 6);
    expect(unitQuad[0]!.x).toBeCloseTo(-50, 6);
  });
});
