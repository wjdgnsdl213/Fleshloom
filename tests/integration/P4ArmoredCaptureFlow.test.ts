import { describe, expect, it } from 'vitest';
import { captureProfileForDrifterSpawn } from '../../src/content/armoredDrifters';
import { EnemyModel } from '../../src/game/enemies/EnemyModel';

describe('P4 armored capture flow', () => {
  it('promotes a scheduled Drifter and pays each layer exactly once', () => {
    const captureProfile = captureProfileForDrifterSpawn(420, 2);
    const enemy = new EnemyModel({
      id: 'wave-enemy-armored',
      archetype: 'drifter',
      position: { x: 400, y: 300 },
      phase: 1,
      captureProfile,
    });
    const rewards = [];

    const first = enemy.capture();
    if (first.kind !== 'ignored') {
      rewards.push(first.reward);
    }
    expect(enemy.snapshot.alive).toBe(true);
    expect(enemy.snapshot.armored).toBe(false);

    const second = enemy.capture();
    if (second.kind !== 'ignored') {
      rewards.push(second.reward);
    }
    const ignored = enemy.capture();

    expect(captureProfile).toBe('armored');
    expect(rewards).toEqual([
      { xp: 7, recovery: 2 },
      { xp: 14, recovery: 4 },
    ]);
    expect(ignored).toEqual({ kind: 'ignored', reason: 'dead' });
    expect(enemy.snapshot.alive).toBe(false);
  });
});
