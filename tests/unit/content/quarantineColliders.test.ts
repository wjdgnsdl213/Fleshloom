import { describe, expect, it } from 'vitest';
import { isCircleFree } from '../../../src/core/geometry/collision';
import {
  PROP_FOOTPRINTS,
  QUARANTINE_COLLIDERS,
} from '../../../src/content/quarantineColliders';
import {
  DISTRICT_BLOCKS,
  DISTRICT_PROPS,
} from '../../../src/content/quarantineDistrict';
import { PLAYGROUND_TUNING } from '../../../src/config/graphics';
import {
  QUARANTINE_WORLD_BOUNDS,
  QUARANTINE_WORLD_START,
} from '../../../src/config/world';

describe('quarantine collider authoring', () => {
  it('covers every block and prop exactly once', () => {
    expect(QUARANTINE_COLLIDERS).toHaveLength(
      DISTRICT_BLOCKS.length + DISTRICT_PROPS.length,
    );
  });

  it('authors a footprint for every prop kind', () => {
    for (const prop of DISTRICT_PROPS) {
      const footprint = PROP_FOOTPRINTS[prop.kind];
      expect(footprint).toBeDefined();
      expect(footprint.length).toBeGreaterThan(0);
      expect(footprint.width).toBeGreaterThan(0);
    }
  });

  it('keeps every collider inside the world bounds', () => {
    for (const collider of QUARANTINE_COLLIDERS) {
      const reach = Math.hypot(collider.halfLength, collider.halfWidth);
      expect(collider.center.x - reach).toBeGreaterThan(
        QUARANTINE_WORLD_BOUNDS.minX - 80,
      );
      expect(collider.center.x + reach).toBeLessThan(
        QUARANTINE_WORLD_BOUNDS.maxX + 80,
      );
      expect(collider.center.y - reach).toBeGreaterThan(
        QUARANTINE_WORLD_BOUNDS.minY - 80,
      );
      expect(collider.center.y + reach).toBeLessThan(
        QUARANTINE_WORLD_BOUNDS.maxY + 80,
      );
    }
  });

  it('leaves the hunt start and its loop-making lane free', () => {
    // The player spawns at world centre and needs generous room to author a
    // first loop; a blocked start would break onboarding immediately.
    const laneRadius = PLAYGROUND_TUNING.playerRadius * 8;

    expect(
      isCircleFree(QUARANTINE_WORLD_START, laneRadius, QUARANTINE_COLLIDERS),
    ).toBe(true);
  });

  it('keeps footprints forgiving relative to the visual scale', () => {
    // Footprints are authored smaller than silhouettes; a van should never
    // exceed its drawn ~280-unit visual length at unit scale.
    expect(PROP_FOOTPRINTS['response-van'].length).toBeLessThan(280);
    expect(PROP_FOOTPRINTS['bio-barrier'].width).toBeLessThan(60);
    expect(PROP_FOOTPRINTS.floodlight.length).toBeLessThan(60);
  });
});
