import { describe, expect, it } from 'vitest';
import { PLAYGROUND_TUNING } from '../../../src/config/graphics';
import {
  BEAT_BOUNDARIES,
  sampleCaptureBeat,
  sampleMissEcho,
  type CaptureBeatPhase,
} from '../../../src/presentation/CaptureBeat';

const DURATION = PLAYGROUND_TUNING.closureDurationSeconds;
const at = (fraction: number, reducedFlash = false) =>
  sampleCaptureBeat(fraction * DURATION, reducedFlash);

/** Ages spanning the phrase, avoiding the exact boundaries. */
const SAMPLES = Array.from({ length: 40 }, (_, index) => (index + 0.5) / 40);

describe('sampleCaptureBeat', () => {
  it('runs the authored 0.82 second phrase', () => {
    expect(DURATION).toBe(0.82);
    expect(sampleCaptureBeat(DURATION).phase).toBe('spent');
    expect(sampleCaptureBeat(DURATION * 4).phase).toBe('spent');
  });

  it('plays the four phases in order', () => {
    const seen: CaptureBeatPhase[] = [];
    for (const fraction of SAMPLES) {
      const phase = at(fraction).phase;
      if (seen[seen.length - 1] !== phase) {
        seen.push(phase);
      }
    }
    expect(seen).toEqual([
      'closure',
      'contraction',
      'decomposition',
      'intake',
    ]);
  });

  it('puts each phase where its boundary says it is', () => {
    expect(at(BEAT_BOUNDARIES.closure * 0.5).phase).toBe('closure');
    expect(at(BEAT_BOUNDARIES.closure + 0.01).phase).toBe('contraction');
    expect(at(BEAT_BOUNDARIES.contraction + 0.01).phase).toBe('decomposition');
    expect(at(BEAT_BOUNDARIES.decomposition + 0.01).phase).toBe('intake');
  });

  it('treats a fresh echo as the very start of the seal', () => {
    const fresh = sampleCaptureBeat(0);
    expect(fresh.phase).toBe('closure');
    expect(fresh.progress).toBe(0);
    expect(fresh.intake).toBe(0);
    expect(fresh.bodyScale).toBe(1);
  });

  it('survives a nonsense age', () => {
    for (const age of [NaN, -1, -Infinity]) {
      const beat = sampleCaptureBeat(age);
      expect(beat.phase).toBe('closure');
      expect(beat.progress).toBe(0);
    }
    expect(sampleCaptureBeat(Infinity).phase).toBe('spent');
  });

  it('never lets the ring or the bodies grow back', () => {
    let previousRing = Infinity;
    let previousBody = Infinity;
    for (const fraction of SAMPLES) {
      const beat = at(fraction);
      if (beat.phase !== 'closure') {
        expect(beat.ringScale).toBeLessThanOrEqual(previousRing + 1e-9);
        expect(beat.bodyScale).toBeLessThanOrEqual(previousBody + 1e-9);
      }
      previousRing = beat.ringScale;
      previousBody = beat.bodyScale;
    }
  });

  it('only ever draws the catch toward the hunter', () => {
    let previous = -1;
    for (const fraction of SAMPLES) {
      const intake = at(fraction).intake;
      expect(intake).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = intake;
    }
    expect(at(0.999).intake).toBeGreaterThan(0.9);
  });

  it('snaps the seal past the drawn loop before contracting', () => {
    const mid = at(BEAT_BOUNDARIES.closure / 2);
    expect(mid.ringScale).toBeGreaterThan(1);
    expect(at(BEAT_BOUNDARIES.closure + 0.02).ringScale).toBeLessThan(1);
  });

  it('finishes with nothing left on screen', () => {
    const last = at(0.999);
    expect(last.ringScale).toBeLessThan(0.02);
    expect(last.bodyScale).toBeLessThan(0.02);
    expect(last.flash).toBeLessThan(0.02);
  });

  it('keeps every output inside its range for the whole phrase', () => {
    for (const fraction of SAMPLES) {
      const beat = at(fraction);
      expect(beat.progress).toBeGreaterThanOrEqual(0);
      expect(beat.progress).toBeLessThanOrEqual(1);
      expect(beat.phaseProgress).toBeGreaterThanOrEqual(0);
      expect(beat.phaseProgress).toBeLessThanOrEqual(1);
      expect(beat.ringScale).toBeGreaterThanOrEqual(0);
      expect(beat.bodyScale).toBeGreaterThanOrEqual(0);
      expect(beat.intake).toBeGreaterThanOrEqual(0);
      expect(beat.intake).toBeLessThanOrEqual(1);
      expect(beat.flash).toBeGreaterThanOrEqual(0);
      expect(beat.flash).toBeLessThanOrEqual(1);
    }
  });

  it('honours reduced flash without touching the choreography', () => {
    for (const fraction of SAMPLES) {
      const normal = at(fraction, false);
      const reduced = at(fraction, true);
      expect(reduced.flash).toBeLessThanOrEqual(normal.flash);
      expect(reduced.ringScale).toBeCloseTo(normal.ringScale, 10);
      expect(reduced.bodyScale).toBeCloseTo(normal.bodyScale, 10);
      expect(reduced.intake).toBeCloseTo(normal.intake, 10);
    }
  });

  it('caps reduced flash at the authored 0.42 of full', () => {
    const brightest = Math.max(...SAMPLES.map((f) => at(f, false).flash));
    const dimmest = Math.max(...SAMPLES.map((f) => at(f, true).flash));
    expect(dimmest / brightest).toBeCloseTo(0.42, 6);
  });
});

describe('sampleMissEcho', () => {
  it('fades a miss out over the same phrase length', () => {
    expect(sampleMissEcho(0)).toBe(1);
    expect(sampleMissEcho(DURATION / 2)).toBeCloseTo(0.5, 6);
    expect(sampleMissEcho(DURATION)).toBe(0);
    expect(sampleMissEcho(DURATION * 3)).toBe(0);
  });

  it('survives a nonsense age', () => {
    expect(sampleMissEcho(NaN)).toBe(1);
    expect(sampleMissEcho(-5)).toBe(1);
  });
});
