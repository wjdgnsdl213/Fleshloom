import { describe, expect, it } from 'vitest';
import { Experience } from '../../../src/game/progression/Experience';

const createExperience = (): Experience =>
  new Experience({ firstThreshold: 30, thresholdGrowth: 1.4 });

describe('Experience', () => {
  it('starts at level one with the configured first threshold', () => {
    expect(createExperience().snapshot).toEqual({
      level: 1,
      xp: 0,
      xpForNextLevel: 30,
      pendingChoices: 0,
    });
  });

  it('retains overflow and queues a mutation choice', () => {
    const experience = createExperience();

    expect(experience.gain(38)).toEqual({
      gained: 38,
      levelsGained: 1,
      pendingChoices: 1,
    });
    expect(experience.snapshot).toEqual({
      level: 2,
      xp: 8,
      xpForNextLevel: 42,
      pendingChoices: 1,
    });
  });

  it('queues multiple level choices from one large capture', () => {
    const experience = createExperience();

    expect(experience.gain(150).levelsGained).toBe(3);
    expect(experience.snapshot).toEqual({
      level: 4,
      xp: 19,
      xpForNextLevel: 82,
      pendingChoices: 3,
    });
  });

  it('resolves pending choices one at a time', () => {
    const experience = createExperience();
    experience.gain(150);

    expect(experience.resolvePendingChoice()).toBe(true);
    expect(experience.snapshot.pendingChoices).toBe(2);
    expect(experience.resolvePendingChoice()).toBe(true);
    expect(experience.resolvePendingChoice()).toBe(true);
    expect(experience.resolvePendingChoice()).toBe(false);
  });

  it('accepts XP while a prior choice is still pending', () => {
    const experience = createExperience();
    experience.gain(30);

    experience.gain(42);

    expect(experience.snapshot).toMatchObject({
      level: 3,
      xp: 0,
      pendingChoices: 2,
    });
  });

  it('returns and clears unspent choices at a scene transition', () => {
    const experience = createExperience();
    experience.gain(150);

    expect(experience.discardPendingChoices()).toBe(3);
    expect(experience.snapshot.pendingChoices).toBe(0);
    expect(experience.discardPendingChoices()).toBe(0);
  });

  it('ignores invalid runtime gains', () => {
    const experience = createExperience();

    for (const amount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(experience.gain(amount)).toEqual({
        gained: 0,
        levelsGained: 0,
        pendingChoices: 0,
      });
    }
    expect(experience.snapshot.xp).toBe(0);
  });

  it('resets all run progression', () => {
    const experience = createExperience();
    experience.gain(150);

    experience.reset();

    expect(experience.snapshot).toEqual({
      level: 1,
      xp: 0,
      xpForNextLevel: 30,
      pendingChoices: 0,
    });
  });

  it.each([
    [{ firstThreshold: 0, thresholdGrowth: 1.4 }, 'firstThreshold'],
    [{ firstThreshold: Number.NaN, thresholdGrowth: 1.4 }, 'firstThreshold'],
    [{ firstThreshold: 30, thresholdGrowth: 0.9 }, 'thresholdGrowth'],
    [{ firstThreshold: 30, thresholdGrowth: Number.NaN }, 'thresholdGrowth'],
  ])('rejects invalid config %o', (config, expectedField) => {
    expect(() => new Experience(config)).toThrow(expectedField);
  });
});
