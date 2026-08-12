import { describe, expect, it } from 'vitest';
import {
  advanceWalkDistance,
  sampleWalkCycle,
  WALK_CYCLE_TUNING,
  walkFrameForDistance,
} from '../../../src/presentation/Locomotion';

describe('distance-driven locomotion', () => {
  it('advances through four authored contact and passing frames', () => {
    const tuning = WALK_CYCLE_TUNING.carrier;

    expect(walkFrameForDistance(0, tuning, true)).toBe(0);
    expect(walkFrameForDistance(10, tuning, true)).toBe(1);
    expect(walkFrameForDistance(20, tuning, true)).toBe(2);
    expect(walkFrameForDistance(30, tuning, true)).toBe(3);
    expect(walkFrameForDistance(40, tuning, true)).toBe(0);
  });

  it('holds an authored planted idle frame while movement is stopped', () => {
    expect(walkFrameForDistance(999, WALK_CYCLE_TUNING.drifter, false)).toBe(1);
    expect(walkFrameForDistance(999, WALK_CYCLE_TUNING.watcher, false)).toBe(3);
  });

  it('advances accumulated gait distance only while actually moving', () => {
    expect(advanceWalkDistance(20, 100, 0.1)).toBe(30);
    expect(advanceWalkDistance(20, 0, 0.1)).toBe(20);
    expect(advanceWalkDistance(20, 100, 0)).toBe(20);
  });

  it('exposes contact and passing signals for grounded secondary motion', () => {
    const contact = sampleWalkCycle(0, 100, WALK_CYCLE_TUNING.carrier);
    const passing = sampleWalkCycle(10, 100, WALK_CYCLE_TUNING.carrier);

    expect(contact).toMatchObject({ frame: 0, contact: 1, passing: 0, moving: true });
    expect(passing.frame).toBe(1);
    expect(passing.contact).toBeCloseTo(0);
    expect(passing.passing).toBeCloseTo(1);
  });
});
