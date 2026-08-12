import { describe, expect, it } from 'vitest';
import { GAMEPLAY_COLORS } from '../../../src/config/graphics';
import {
  sampleProjectedEllipseArc,
  wardenStagePresentation,
} from '../../../src/presentation/LoopPlaygroundRenderer';

describe('Warden presentation helpers', () => {
  it('assigns a distinct readable weak-point shape to every encounter stage', () => {
    expect(wardenStagePresentation('arrival', false).weakPointShape).toBe(
      'none',
    );
    expect(wardenStagePresentation('arms', false).weakPointShape).toBe(
      'socket',
    );
    expect(wardenStagePresentation('shell', false).weakPointShape).toBe(
      'vascular-seam',
    );
    expect(wardenStagePresentation('core', false).weakPointShape).toBe(
      'control-triad',
    );
    expect(wardenStagePresentation('defeated', false).weakPointShape).toBe(
      'collapse',
    );
  });

  it('keeps cyan for targets, amber for danger, and attenuates emission', () => {
    const full = wardenStagePresentation('core', false);
    const reduced = wardenStagePresentation('core', true);

    expect(full.targetColor).toBe(GAMEPLAY_COLORS.hostileCyan);
    expect(full.telegraphColor).toBe(GAMEPLAY_COLORS.amber);
    expect(full.seamColor).toBe(GAMEPLAY_COLORS.arterialBright);
    expect(reduced.emissiveAlpha).toBeLessThan(full.emissiveAlpha);
    expect(reduced.emissiveAlpha).toBeCloseTo(full.emissiveAlpha * 0.52);
  });

  it('samples projected ellipse endpoints and orientation deterministically', () => {
    const quarter = sampleProjectedEllipseArc({
      center: { x: 10, y: 20 },
      radiusX: 8,
      radiusY: 4,
      startAngle: 0,
      endAngle: Math.PI * 0.5,
      segments: 4,
    });
    const rotated = sampleProjectedEllipseArc({
      center: { x: 10, y: 20 },
      radiusX: 8,
      radiusY: 4,
      startAngle: 0,
      endAngle: Math.PI * 0.5,
      rotation: Math.PI * 0.5,
      segments: 4,
    });

    expect(quarter).toHaveLength(5);
    expect(quarter[0]).toEqual({ x: 18, y: 20 });
    expect(quarter.at(-1)?.x).toBeCloseTo(10);
    expect(quarter.at(-1)?.y).toBeCloseTo(24);
    expect(rotated[0]?.x).toBeCloseTo(10);
    expect(rotated[0]?.y).toBeCloseTo(28);
    expect(rotated.at(-1)?.x).toBeCloseTo(6);
    expect(rotated.at(-1)?.y).toBeCloseTo(20);
    expect(Object.isFrozen(rotated)).toBe(true);
  });
});
