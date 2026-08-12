import { describe, expect, it } from 'vitest';
import { capturePresentationStrengths } from '../../../src/presentation/LoopPlaygroundRenderer';

describe('capture presentation timing', () => {
  it('limits the closure bang to the opening two-to-three frame beat', () => {
    expect(capturePresentationStrengths(0.03, false).closureBang).toBeGreaterThan(0.5);
    expect(capturePresentationStrengths(0.08, false).closureBang).toBe(0);
  });

  it('separates intake trails and the final arrival pulse from closure', () => {
    const closure = capturePresentationStrengths(0.03, false);
    const intake = capturePresentationStrengths(0.7, false);
    const arrival = capturePresentationStrengths(0.88, false);

    expect(closure.intakeTrail).toBe(0);
    expect(intake.intakeTrail).toBeGreaterThan(0);
    expect(intake.closureBang).toBe(0);
    expect(arrival.arrivalPulse).toBeGreaterThan(0);
  });

  it('reduces flash intensity without removing directional intake', () => {
    const full = capturePresentationStrengths(0.03, false);
    const reduced = capturePresentationStrengths(0.03, true);
    const reducedIntake = capturePresentationStrengths(0.7, true);

    expect(reduced.closureBang).toBeLessThan(full.closureBang);
    expect(reducedIntake.intakeTrail).toBeGreaterThan(0);
  });
});

