import { describe, expect, it } from 'vitest';
import {
  DISTRICT_BIOMASS,
  DISTRICT_BLOCKS,
  DISTRICT_CROSSWALKS,
  DISTRICT_LIGHTS,
  DISTRICT_PUDDLES,
  DISTRICT_PROPS,
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
      ...DISTRICT_PROPS.map((entry) => entry.position),
      ...DISTRICT_BLOCKS.map((entry) => entry.position),
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

  it('authors three prop depth bands around the representative hunt view', () => {
    const representativeProps = DISTRICT_PROPS.filter(
      (entry) =>
        entry.position.x >= 900 &&
        entry.position.x <= 2_300 &&
        entry.position.y >= 500 &&
        entry.position.y <= 1_300,
    );

    expect(representativeProps.length).toBeGreaterThanOrEqual(5);
    expect(new Set(representativeProps.map((entry) => entry.band))).toEqual(
      new Set(['background', 'midground', 'foreground']),
    );
    expect(new Set(representativeProps.map((entry) => entry.kind)).size).toBe(4);
    expect(representativeProps.every((entry) => entry.scale <= 0.5)).toBe(true);
  });

  it('keeps plain procedural blocks outside the representative combat lane', () => {
    expect(
      DISTRICT_BLOCKS.every(
        (entry) =>
          entry.position.x < 900 ||
          entry.position.x > 2_300 ||
          entry.position.y < 500 ||
          entry.position.y > 1_300,
      ),
    ).toBe(true);
  });
});
