import { describe, expect, it } from 'vitest';
import {
  DISTRICT_BIOMASS,
  DISTRICT_CROSSWALKS,
  DISTRICT_LIGHTS,
  DISTRICT_PUDDLES,
  DISTRICT_VENTS,
} from '../../../src/content/quarantineDistrict';
import { QUARANTINE_WORLD_BOUNDS } from '../../../src/config/world';

const insideWorld = (position: { readonly x: number; readonly y: number }) =>
  position.x >= QUARANTINE_WORLD_BOUNDS.minX &&
  position.x <= QUARANTINE_WORLD_BOUNDS.maxX &&
  position.y >= QUARANTINE_WORLD_BOUNDS.minY &&
  position.y <= QUARANTINE_WORLD_BOUNDS.maxY;

describe('quarantine district layout', () => {
  it('keeps every authored landmark inside the finite world', () => {
    const positions = [
      ...DISTRICT_PUDDLES.map((entry) => entry.position),
      ...DISTRICT_LIGHTS.map((entry) => entry.position),
      ...DISTRICT_VENTS.map((entry) => entry.position),
      ...DISTRICT_BIOMASS.map((entry) => entry.origin),
      ...DISTRICT_CROSSWALKS.map((entry) => entry.position),
    ];

    expect(positions.length).toBeGreaterThanOrEqual(30);
    expect(positions.every(insideWorld)).toBe(true);
  });

  it('uses valid positive geometry for every map feature', () => {
    expect(
      DISTRICT_PUDDLES.every(
        (entry) => entry.radiusX > 0 && entry.radiusY > 0,
      ),
    ).toBe(true);
    expect(
      DISTRICT_VENTS.every((entry) => entry.width > 0 && entry.height > 0),
    ).toBe(true);
    expect(
      DISTRICT_CROSSWALKS.every(
        (entry) =>
          entry.stripeCount > 0 &&
          entry.stripeLength > 0 &&
          entry.stripeWidth > 0 &&
          entry.stripeGap > 0,
      ),
    ).toBe(true);
    expect(
      DISTRICT_BIOMASS.every(
        (entry) => entry.spread > 0 && entry.massCount > 0,
      ),
    ).toBe(true);
  });
});
