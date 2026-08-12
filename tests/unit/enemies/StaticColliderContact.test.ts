import { describe, expect, it } from 'vitest';
import { createObb } from '../../../src/core/geometry/obb';
import { isCircleFree } from '../../../src/core/geometry/collision';
import { CutterModel, CUTTER_BALANCE } from '../../../src/game/enemies/CutterModel';
import { EliteHuskModel, ELITE_HUSK_BALANCE } from '../../../src/game/enemies/EliteHuskModel';
import { EnemyModel } from '../../../src/game/enemies/EnemyModel';
import { MimicModel, MIMIC_BALANCE } from '../../../src/game/enemies/MimicModel';

const bounds = { minX: 0, minY: 0, maxX: 3_200, maxY: 1_800 };
// A wall directly between each body and its target.
const wall = createObb({ x: 1_600, y: 900 }, 60, 400, 0);

describe('actors versus static street structures', () => {
  it('keeps a seeking drifter outside a wall across many steps', () => {
    const drifter = new EnemyModel({
      id: 'wall-drifter',
      archetype: 'drifter',
      position: { x: 1_450, y: 900 },
      phase: 0,
    });
    const player = { x: 1_750, y: 900 };

    for (let step = 0; step < 240; step += 1) {
      drifter.step(1 / 60, player, bounds);
      drifter.applyStaticColliders([wall]);
    }

    const position = drifter.snapshot.position;
    expect(
      isCircleFree(position, drifter.radius - 0.5, [wall]),
    ).toBe(true);
    // It chased for four seconds and must have been stopped by the wall,
    // not by reaching the player.
    expect(position.x).toBeLessThan(1_600);
  });

  it('lets a body slide along a wall instead of sticking to it', () => {
    const drifter = new EnemyModel({
      id: 'slide-drifter',
      archetype: 'drifter',
      position: { x: 1_500, y: 700 },
      phase: 0,
    });
    // Target beyond the wall and further south: the pursuit direction has a
    // tangential component that must survive contact.
    const player = { x: 1_700, y: 1_400 };
    const startY = drifter.snapshot.position.y;

    for (let step = 0; step < 240; step += 1) {
      drifter.step(1 / 60, player, bounds);
      drifter.applyStaticColliders([wall]);
    }

    expect(drifter.snapshot.position.y).toBeGreaterThan(startY + 100);
  });

  it('resolves cutters, mimics, and elite husks with their own radii', () => {
    const cutter = new CutterModel({
      id: 'wall-cutter',
      position: { x: 1_590, y: 900 },
      phase: 0,
    });
    cutter.applyStaticColliders([wall]);
    expect(
      isCircleFree(cutter.snapshot.position, CUTTER_BALANCE.radius - 0.5, [
        wall,
      ]),
    ).toBe(true);

    const mimic = new MimicModel({
      id: 'wall-mimic',
      position: { x: 1_600, y: 910 },
      phase: 0,
    });
    mimic.applyStaticColliders([wall]);
    expect(
      isCircleFree(mimic.snapshot.position, MIMIC_BALANCE.radius - 0.5, [
        wall,
      ]),
    ).toBe(true);

    const husk = new EliteHuskModel({
      id: 'wall-husk',
      position: { x: 1_612, y: 890 },
      phase: 0,
    });
    husk.applyStaticColliders([wall]);
    expect(
      isCircleFree(husk.snapshot.position, ELITE_HUSK_BALANCE.radius - 0.5, [
        wall,
      ]),
    ).toBe(true);
  });

  it('ignores colliders for dead bodies and empty collider lists', () => {
    const drifter = new EnemyModel({
      id: 'noop-drifter',
      archetype: 'drifter',
      position: { x: 1_600, y: 900 },
      phase: 0,
    });
    const before = drifter.snapshot.position;
    drifter.applyStaticColliders([]);
    const after = drifter.snapshot.position;

    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
  });
});
