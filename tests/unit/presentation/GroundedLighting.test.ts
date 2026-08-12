import { describe, expect, it } from 'vitest';
import {
  GROUNDED_LIGHTING,
  resolveCastShadow,
  resolveRimOffset,
  resolveShadowOffset,
  resolveWetReflection,
  SCENE_SHADOW_DIRECTION,
} from '../../../src/presentation/GroundedLighting';

const scale = { x: 0.5, y: 0.5 };

describe('world-fixed actor grounding', () => {
  it('keeps the key light direction normalized', () => {
    const length = Math.hypot(
      SCENE_SHADOW_DIRECTION.x,
      SCENE_SHADOW_DIRECTION.y,
    );

    expect(length).toBeCloseTo(1, 3);
  });

  it('drops the shadow down-right no matter how the sprite is rotated', () => {
    const offset = resolveShadowOffset(20);

    expect(offset.x).toBeGreaterThan(0);
    expect(offset.y).toBeGreaterThan(0);
    expect(offset.y).toBeGreaterThan(offset.x);
  });

  it('scales shadow reach with body radius', () => {
    const near = resolveShadowOffset(10);
    const far = resolveShadowOffset(40);

    expect(far.x).toBeCloseTo(near.x * 4, 5);
    expect(far.y).toBeCloseTo(near.y * 4, 5);
  });

  it('foreshortens the cast shadow along the body axis', () => {
    const shadow = resolveCastShadow(20, scale);

    expect(shadow.scaleY).toBeLessThan(scale.y);
    expect(shadow.scaleX).toBeGreaterThan(scale.x);
    expect(shadow.alpha).toBeCloseTo(GROUNDED_LIGHTING.shadowAlpha, 5);
  });

  it('fades and pulls in the cast shadow as grounding strength drops', () => {
    const grounded = resolveCastShadow(20, scale, 1);
    const lifted = resolveCastShadow(20, scale, 0.25);

    expect(lifted.alpha).toBeLessThan(grounded.alpha);
    expect(Math.abs(lifted.offsetY)).toBeLessThan(Math.abs(grounded.offsetY));
  });

  it('mirrors the wet reflection below the contact point', () => {
    const reflection = resolveWetReflection(20, scale, 0, 0, true);

    expect(reflection.scaleY).toBeLessThan(0);
    expect(Math.abs(reflection.scaleY)).toBeLessThan(scale.y);
    expect(reflection.offsetY).toBeGreaterThan(0);
    expect(reflection.alpha).toBeCloseTo(GROUNDED_LIGHTING.reflectionAlpha, 5);
  });

  it('removes reflection wobble under reduced motion only', () => {
    const still = resolveWetReflection(20, scale, 0.9, 0.4, true);
    const rippling = resolveWetReflection(20, scale, 0.9, 0.4, false);

    expect(still.offsetX).toBe(0);
    expect(rippling.offsetX).not.toBe(0);
  });

  it('points the rim highlight back toward the key light', () => {
    const rim = resolveRimOffset(20);
    const shadow = resolveShadowOffset(20);

    expect(Math.sign(rim.x)).toBe(-Math.sign(shadow.x));
    expect(Math.sign(rim.y)).toBe(-Math.sign(shadow.y));
  });

  it('stays finite for degenerate actor state', () => {
    const shadow = resolveCastShadow(Number.NaN, { x: Number.NaN, y: 1 });
    const reflection = resolveWetReflection(
      -5,
      scale,
      Number.POSITIVE_INFINITY,
    );

    expect(Number.isFinite(shadow.offsetX)).toBe(true);
    expect(Number.isFinite(shadow.scaleX)).toBe(true);
    expect(Number.isFinite(reflection.offsetX)).toBe(true);
    expect(Number.isFinite(reflection.offsetY)).toBe(true);
    expect(resolveRimOffset(Number.NaN).x).toBeCloseTo(0, 10);
  });
});
