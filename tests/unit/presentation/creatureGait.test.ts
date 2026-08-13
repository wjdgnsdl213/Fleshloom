import { describe, expect, it } from 'vitest';
import { WALK_CYCLE_TUNING, WALK_FRAME_COUNT } from '../../../src/presentation/Locomotion';
import {
  CARRIER_RIG,
  DRIFTER_RIG,
  HUNTER_RIG,
  rigFor,
} from '../../../src/presentation/three/creatures/archetypes';
import {
  FULL_STRIDE_SPEED,
  bodyBob,
  sampleGait,
} from '../../../src/presentation/three/creatures/gait';
import {
  limbTip,
  poseLimb,
  solveTwoBone,
} from '../../../src/presentation/three/creatures/pose';
import {
  restDropFor,
  type LimbSpec,
} from '../../../src/presentation/three/creatures/RigTypes';

const TAU = Math.PI * 2;
const CARRIER = WALK_CYCLE_TUNING.carrier;

const limbById = (rig: typeof CARRIER_RIG, id: string): LimbSpec => {
  const limb = rig.limbs.find((candidate) => candidate.id === id);
  if (limb === undefined) {
    throw new Error(`rig ${rig.archetype} has no limb ${id}`);
  }
  return limb;
};

/** Phases sampled across a full stride, avoiding only the exact endpoints. */
const PHASE_SAMPLES = Array.from(
  { length: 24 },
  (_, index) => ((index + 0.5) / 24) * TAU,
);

const gaitAtPhase = (phase: number) =>
  sampleGait(
    (phase / TAU) * CARRIER.distancePerFrame * WALK_FRAME_COUNT,
    FULL_STRIDE_SPEED,
    CARRIER,
  );

describe('sampleGait', () => {
  it('reports a standing creature as not moving', () => {
    const gait = sampleGait(500, 0, CARRIER);
    expect(gait.moving).toBe(false);
    expect(gait.amplitude).toBe(0);
    expect(gait.phase).toBe(0);
  });

  it('completes exactly one stride over the authored sprite distance', () => {
    const strideDistance = CARRIER.distancePerFrame * WALK_FRAME_COUNT;
    const start = sampleGait(0, FULL_STRIDE_SPEED, CARRIER);
    const half = sampleGait(strideDistance / 2, FULL_STRIDE_SPEED, CARRIER);
    const full = sampleGait(strideDistance, FULL_STRIDE_SPEED, CARRIER);

    expect(start.phase).toBeCloseTo(0, 6);
    expect(half.phase).toBeCloseTo(Math.PI, 6);
    expect(full.phase).toBeCloseTo(0, 6);
  });

  it('keeps the phase wrapped into [0, TAU) over many strides', () => {
    for (const distance of [0, 137, 4_002, 91_853]) {
      const gait = sampleGait(distance, FULL_STRIDE_SPEED, CARRIER);
      expect(gait.phase).toBeGreaterThanOrEqual(0);
      expect(gait.phase).toBeLessThan(TAU);
    }
  });

  it('ramps the stride in with speed rather than snapping to full length', () => {
    const crawl = sampleGait(100, FULL_STRIDE_SPEED * 0.25, CARRIER);
    const walk = sampleGait(100, FULL_STRIDE_SPEED, CARRIER);
    const sprint = sampleGait(100, FULL_STRIDE_SPEED * 4, CARRIER);

    expect(crawl.amplitude).toBeCloseTo(0.25, 6);
    expect(walk.amplitude).toBeCloseTo(1, 6);
    expect(sprint.amplitude).toBe(1);
  });
});

describe('bodyBob', () => {
  it('stays flat while standing still', () => {
    expect(bodyBob(sampleGait(0, 0, CARRIER), 0.2)).toBe(0);
  });

  it('never sinks the body below its standing height', () => {
    for (const phase of PHASE_SAMPLES) {
      expect(bodyBob(gaitAtPhase(phase), 0.2)).toBeGreaterThanOrEqual(0);
    }
  });

  it('rides twice per stride, peaking at each mid-stance', () => {
    const quarter = bodyBob(gaitAtPhase(Math.PI / 2), 0.2);
    const threeQuarter = bodyBob(gaitAtPhase((3 * Math.PI) / 2), 0.2);
    const doubleSupport = bodyBob(gaitAtPhase(Math.PI), 0.2);

    expect(quarter).toBeCloseTo(0.2, 6);
    expect(threeQuarter).toBeCloseTo(0.2, 6);
    expect(doubleSupport).toBeLessThan(0.01);
  });
});

describe('solveTwoBone', () => {
  it('puts the tip exactly where it was asked to', () => {
    const upper = 1.3;
    const lower = 1.24;
    for (const forward of [-0.8, -0.3, 0, 0.4, 0.9]) {
      for (const drop of [1.2, 1.6, 1.9]) {
        const reach = Math.hypot(forward, drop);
        const solution = solveTwoBone(
          reach,
          upper,
          lower,
          Math.atan2(forward, drop),
        );
        const tip = limbTip(solution, upper, lower);
        expect(tip.forward).toBeCloseTo(forward, 6);
        expect(tip.drop).toBeCloseTo(drop, 6);
      }
    }
  });

  it('never bends a joint backwards', () => {
    for (const reach of [0.2, 0.9, 1.4, 1.8, 2.04, 5]) {
      const solution = solveTwoBone(reach, 1.05, 1.0, 0.3);
      expect(solution.bend).toBeGreaterThanOrEqual(0);
      expect(solution.bend).toBeLessThanOrEqual(Math.PI);
    }
  });

  it('straightens rather than tearing when asked to overreach', () => {
    const stretched = solveTwoBone(50, 1.05, 1.0, 0);
    expect(Number.isFinite(stretched.bend)).toBe(true);
    expect(stretched.bend).toBeLessThan(0.02);
    expect(Number.isFinite(stretched.upperAngle)).toBe(true);
  });

  it('folds rather than tearing when asked to collapse', () => {
    const folded = solveTwoBone(0, 1.05, 1.0, 0);
    expect(Number.isFinite(folded.bend)).toBe(true);
    expect(Number.isFinite(folded.upperAngle)).toBe(true);
  });

  it('keeps a resting limb slightly bent so it reads as flesh', () => {
    // Rigs author limbs longer than the standing height on purpose.
    const restBend = solveTwoBone(2.0, 1.18, 1.14, 0).bend;
    expect(restBend).toBeGreaterThan(0.1);
  });
});

describe('poseLimb', () => {
  const rigs = [HUNTER_RIG, CARRIER_RIG, DRIFTER_RIG];

  it.each(rigs.map((rig) => [rig.archetype, rig] as const))(
    '%s swings its legs in opposition',
    (_name, rig) => {
      const right = limbById(rig, 'leg-r');
      const left = limbById(rig, 'leg-l');
      for (const phase of PHASE_SAMPLES) {
        const gait = gaitAtPhase(phase);
        const rightPose = poseLimb(right, gait, restDropFor(rig, right));
        const leftPose = poseLimb(left, gait, restDropFor(rig, left));
        expect(leftPose.tipForward).toBeCloseTo(-rightPose.tipForward, 6);
      }
    },
  );

  it.each(rigs.map((rig) => [rig.archetype, rig] as const))(
    '%s swings each arm against the leg on its own side',
    (_name, rig) => {
      for (const side of ['r', 'l'] as const) {
        const armLimb = limbById(rig, `arm-${side}`);
        const legLimb = limbById(rig, `leg-${side}`);
        for (const phase of PHASE_SAMPLES) {
          const gait = gaitAtPhase(phase);
          const armForward = poseLimb(
            armLimb,
            gait,
            restDropFor(rig, armLimb),
          ).tipForward;
          const legForward = poseLimb(
            legLimb,
            gait,
            restDropFor(rig, legLimb),
          ).tipForward;
          // Opposition, not equality: the two limbs have different strides.
          expect(Math.sign(armForward) * Math.sign(legForward)).toBeLessThan(
            1,
          );
        }
      }
    },
  );

  it.each(rigs.map((rig) => [rig.archetype, rig] as const))(
    '%s never drives a foot through the ground',
    (_name, rig) => {
      for (const limb of rig.limbs) {
        if (limb.kind !== 'leg') {
          continue;
        }
        for (const phase of PHASE_SAMPLES) {
          const pose = poseLimb(limb, gaitAtPhase(phase), restDropFor(rig, limb));
          expect(pose.tipLift).toBeGreaterThanOrEqual(0);
        }
      }
    },
  );

  it('plants the foot for half the cycle and lifts it for the other half', () => {
    const limb = limbById(CARRIER_RIG, 'leg-r');
    const grounded = PHASE_SAMPLES.filter(
      (phase) =>
        poseLimb(limb, gaitAtPhase(phase), restDropFor(CARRIER_RIG, limb))
          .grounded,
    );
    expect(grounded).toHaveLength(PHASE_SAMPLES.length / 2);
  });

  it('drives the body forward on the planted foot instead of skating', () => {
    const limb = limbById(CARRIER_RIG, 'leg-r');
    const step = 0.02;
    for (const phase of PHASE_SAMPLES) {
      const pose = poseLimb(
        limb,
        gaitAtPhase(phase),
        restDropFor(CARRIER_RIG, limb),
      );
      if (!pose.grounded) {
        continue;
      }
      const next = poseLimb(
        limb,
        gaitAtPhase(phase + step),
        restDropFor(CARRIER_RIG, limb),
      );
      // A planted foot must travel backwards relative to the body.
      expect(next.tipForward).toBeLessThan(pose.tipForward);
    }
  });

  it('lifts the foot only while it travels forward', () => {
    const limb = limbById(DRIFTER_RIG, 'leg-r');
    const step = 0.02;
    for (const phase of PHASE_SAMPLES) {
      const pose = poseLimb(
        limb,
        gaitAtPhase(phase),
        restDropFor(DRIFTER_RIG, limb),
      );
      if (pose.tipLift <= 0) {
        continue;
      }
      const next = poseLimb(
        limb,
        gaitAtPhase(phase + step),
        restDropFor(DRIFTER_RIG, limb),
      );
      expect(next.tipForward).toBeGreaterThan(pose.tipForward);
    }
  });

  it('stands a still creature with its feet under it', () => {
    const limb = limbById(HUNTER_RIG, 'leg-r');
    const pose = poseLimb(
      limb,
      sampleGait(0, 0, CARRIER),
      restDropFor(HUNTER_RIG, limb),
    );
    expect(pose.tipForward).toBe(0);
    expect(pose.tipLift).toBe(0);
    expect(pose.grounded).toBe(true);
  });

  it('reaches the foot target it reports', () => {
    const limb = limbById(DRIFTER_RIG, 'leg-r');
    for (const phase of PHASE_SAMPLES) {
      const pose = poseLimb(
        limb,
        gaitAtPhase(phase),
        restDropFor(DRIFTER_RIG, limb),
      );
      const tip = limbTip(pose, limb.upperLength, limb.lowerLength);
      expect(tip.forward).toBeCloseTo(pose.tipForward, 5);
      expect(tip.drop).toBeCloseTo(
        restDropFor(DRIFTER_RIG, limb) - pose.tipLift,
        5,
      );
    }
  });

  it('produces motion at all — the pose must actually change', () => {
    const limb = limbById(CARRIER_RIG, 'leg-r');
    const angles = PHASE_SAMPLES.map(
      (phase) =>
        poseLimb(limb, gaitAtPhase(phase), restDropFor(CARRIER_RIG, limb))
          .upperAngle,
    );
    const spread = Math.max(...angles) - Math.min(...angles);
    expect(spread).toBeGreaterThan(0.3);
  });
});

describe('rigFor', () => {
  it('returns the authored rig for wave-one archetypes', () => {
    expect(rigFor('carrier')).toBe(CARRIER_RIG);
    expect(rigFor('drifter')).toBe(DRIFTER_RIG);
    expect(rigFor('hunter')).toBe(HUNTER_RIG);
  });

  it('falls back to the drifter frame for an archetype it has never heard of', () => {
    expect(rigFor('')).toBe(DRIFTER_RIG);
    expect(rigFor('not-an-archetype')).toBe(DRIFTER_RIG);
  });

  it('every rig carries a matched pair of legs and arms', () => {
    for (const rig of [HUNTER_RIG, CARRIER_RIG, DRIFTER_RIG]) {
      const legs = rig.limbs.filter((limb) => limb.kind === 'leg');
      const arms = rig.limbs.filter((limb) => limb.kind === 'arm');
      expect(legs).toHaveLength(2);
      expect(arms).toHaveLength(2);
      expect(legs[0]?.socket.x).toBeCloseTo(-(legs[1]?.socket.x ?? 0), 6);
    }
  });

  it('authors every limb long enough for the step it has to take', () => {
    // The failure this guards is the one that reads as a floating sticker: a
    // limb whose span is shorter than its own stride asks for gets clamped,
    // so the foot stops short of the ground mid-step.
    for (const rig of [HUNTER_RIG, CARRIER_RIG, DRIFTER_RIG]) {
      for (const limb of rig.limbs) {
        const span = limb.upperLength + limb.lowerLength;
        const rest = restDropFor(rig, limb);
        const furthest = Math.hypot(limb.stride, rest);
        expect(span).toBeGreaterThan(furthest);
        expect(span).toBeGreaterThan(rest);
      }
    }
  });

  it('never clamps a limb anywhere in the stride', () => {
    for (const rig of [HUNTER_RIG, CARRIER_RIG, DRIFTER_RIG]) {
      for (const limb of rig.limbs) {
        const rest = restDropFor(rig, limb);
        for (const phase of PHASE_SAMPLES) {
          const pose = poseLimb(limb, gaitAtPhase(phase), rest);
          const tip = limbTip(pose, limb.upperLength, limb.lowerLength);
          expect(tip.forward).toBeCloseTo(pose.tipForward, 5);
          expect(tip.drop).toBeCloseTo(rest - pose.tipLift, 5);
        }
      }
    }
  });
});
