import { describe, expect, it } from 'vitest';
import {
  ALL_RIGS,
  CUTTER_RIG,
  ELITE_HUSK_RIG,
  MIMIC_RIG,
  RUSHER_RIG,
  WATCHER_RIG,
  rigFor,
} from '../../../src/presentation/three/creatures/archetypes';
import { restDropFor } from '../../../src/presentation/three/creatures/RigTypes';
import {
  FULL_STRIDE_SPEED,
  sampleGait,
} from '../../../src/presentation/three/creatures/gait';
import {
  limbTip,
  poseLimb,
} from '../../../src/presentation/three/creatures/pose';
import {
  NEUTRAL_STANCE,
  STAGGER_BLEND_SECONDS,
  resolveStance,
} from '../../../src/presentation/three/creatures/stance';
import {
  WALK_CYCLE_TUNING,
  WALK_FRAME_COUNT,
} from '../../../src/presentation/Locomotion';

const TAU = Math.PI * 2;
const PHASE_SAMPLES = Array.from(
  { length: 16 },
  (_, index) => ((index + 0.5) / 16) * TAU,
);

const gaitAtPhase = (phase: number) => {
  const tuning = WALK_CYCLE_TUNING.carrier;
  return sampleGait(
    (phase / TAU) * tuning.distancePerFrame * WALK_FRAME_COUNT,
    FULL_STRIDE_SPEED,
    tuning,
  );
};

describe('resolveStance', () => {
  it('leaves an unremarkable behaviour standing neutral', () => {
    for (const state of ['chase', 'approach', 'positioning', 'orbiting', '']) {
      expect(resolveStance(state)).toEqual(NEUTRAL_STANCE);
    }
  });

  it('rears back to wind up and throws forward to commit', () => {
    const windUp = resolveStance('telegraph');
    const lunge = resolveStance('charge');

    // The two must read as opposites, or the telegraph teaches nothing.
    expect(windUp.pitch).toBeLessThan(0);
    expect(lunge.pitch).toBeGreaterThan(0);
    expect(Math.sign(windUp.armLift)).toBe(-Math.sign(lunge.armLift));
  });

  it('gives locking the same wind-up as telegraph', () => {
    expect(resolveStance('locking')).toEqual(resolveStance('telegraph'));
  });

  it('opens a peeled husk further than any attack wind-up', () => {
    const exposed = resolveStance('exposed');
    const windUp = resolveStance('telegraph');
    expect(exposed.pitch).toBeLessThan(windUp.pitch);
    expect(exposed.armLift).toBeLessThan(windUp.armLift);
  });

  it('slumps and stops striding when staggered', () => {
    const stagger = resolveStance('staggered', STAGGER_BLEND_SECONDS);
    expect(stagger.crouch).toBeGreaterThan(0.15);
    expect(stagger.gaitDamping).toBeLessThan(0.3);
  });

  it('eases out of a stagger instead of snapping upright', () => {
    const deep = resolveStance('staggered', STAGGER_BLEND_SECONDS);
    const mid = resolveStance('staggered', STAGGER_BLEND_SECONDS / 2);
    const done = resolveStance('staggered', 0);

    expect(mid.crouch).toBeLessThan(deep.crouch);
    expect(mid.crouch).toBeGreaterThan(done.crouch);
    expect(done).toEqual(NEUTRAL_STANCE);
  });

  it('treats an over-long stagger timer as a full slump', () => {
    expect(resolveStance('staggered', 99)).toEqual(
      resolveStance('staggered', STAGGER_BLEND_SECONDS),
    );
  });

  it('survives a missing stagger timer', () => {
    expect(Number.isFinite(resolveStance('staggered').crouch)).toBe(true);
    expect(Number.isFinite(resolveStance('staggered', NaN).crouch)).toBe(true);
  });

  it('never damps the stride to a dead stop', () => {
    for (const state of [
      'telegraph',
      'charge',
      'staggered',
      'recover',
      'exposed',
      'chase',
    ]) {
      const stance = resolveStance(state, STAGGER_BLEND_SECONDS);
      expect(stance.gaitDamping).toBeGreaterThan(0);
      expect(stance.gaitDamping).toBeLessThanOrEqual(1);
    }
  });

  it('never crouches a creature into the ground', () => {
    for (const state of Object.keys({
      telegraph: 0,
      locking: 0,
      charge: 0,
      dash: 0,
      mirroring: 0,
      staggered: 0,
      recover: 0,
      cooldown: 0,
      exposed: 0,
    })) {
      const stance = resolveStance(state, STAGGER_BLEND_SECONDS);
      expect(stance.crouch).toBeGreaterThanOrEqual(0);
      expect(stance.crouch).toBeLessThan(0.5);
    }
  });
});

describe('the full archetype roster', () => {
  it('gives every archetype its own frame', () => {
    expect(rigFor('rusher')).toBe(RUSHER_RIG);
    expect(rigFor('watcher')).toBe(WATCHER_RIG);
    expect(rigFor('cutter')).toBe(CUTTER_RIG);
    expect(rigFor('mimic')).toBe(MIMIC_RIG);
    expect(rigFor('elite-husk')).toBe(ELITE_HUSK_RIG);
  });

  it('has one rig per archetype the walk cycle knows about', () => {
    for (const archetype of Object.keys(WALK_CYCLE_TUNING)) {
      expect(rigFor(archetype).archetype).toBe(archetype);
    }
  });

  it('keeps the silhouettes distinguishable from one another', () => {
    // Two archetypes that stand the same height and the same width are two
    // archetypes the player cannot tell apart at a glance.
    const signatures = ALL_RIGS.map(
      (rig) => `${rig.bodyHeight.toFixed(2)}:${rig.bodyRadius.toFixed(2)}`,
    );
    expect(new Set(signatures).size).toBe(ALL_RIGS.length);
  });

  it('keeps every limb long enough for its own stride', () => {
    for (const rig of ALL_RIGS) {
      for (const limb of rig.limbs) {
        const rest = restDropFor(rig, limb);
        expect(limb.upperLength + limb.lowerLength).toBeGreaterThan(
          Math.hypot(limb.stride, rest),
        );
      }
    }
  });

  it('never clamps a limb, at any phase, under any stance', () => {
    const deepest = resolveStance('staggered', STAGGER_BLEND_SECONDS);
    for (const rig of ALL_RIGS) {
      const crouch = rig.bodyHeight * deepest.crouch;
      for (const limb of rig.limbs) {
        const rest =
          restDropFor(rig, limb) - (limb.kind === 'leg' ? crouch : 0);
        for (const phase of PHASE_SAMPLES) {
          const pose = poseLimb(limb, gaitAtPhase(phase), rest);
          const tip = limbTip(pose, limb.upperLength, limb.lowerLength);
          expect(tip.forward).toBeCloseTo(pose.tipForward, 5);
          expect(tip.drop).toBeCloseTo(rest - pose.tipLift, 5);
        }
      }
    }
  });

  it('gives the armoured archetypes plates and the others none', () => {
    expect(ELITE_HUSK_RIG.plates?.length ?? 0).toBeGreaterThan(0);
    expect(RUSHER_RIG.plates).toBeUndefined();
    expect(CUTTER_RIG.plates).toBeUndefined();
    expect(MIMIC_RIG.plates).toBeUndefined();
  });

  it('builds the mimic close enough to the hunter to be the threat it is', () => {
    const hunter = rigFor('hunter');
    expect(Math.abs(MIMIC_RIG.bodyHeight - hunter.bodyHeight)).toBeLessThan(0.2);
    expect(Math.abs(MIMIC_RIG.bodyRadius - hunter.bodyRadius)).toBeLessThan(0.2);
    // ...but not so close that the stride gives nothing away.
    const mimicLeg = MIMIC_RIG.limbs[0];
    const hunterLeg = hunter.limbs[0];
    expect(mimicLeg?.stride).not.toBe(hunterLeg?.stride);
  });

  it('makes the rusher the longest strider and the husk the shortest', () => {
    const strides = new Map(
      ALL_RIGS.map((rig) => [
        rig.archetype,
        rig.limbs.find((limb) => limb.kind === 'leg')?.stride ?? 0,
      ]),
    );
    const longest = [...strides.entries()].sort((a, b) => b[1] - a[1])[0];
    const shortest = [...strides.entries()].sort((a, b) => a[1] - b[1])[0];
    expect(longest?.[0]).toBe('rusher');
    expect(shortest?.[0]).toBe('elite-husk');
  });
});
