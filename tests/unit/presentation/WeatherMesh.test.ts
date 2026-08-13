import { describe, expect, it } from 'vitest';
import type { BufferAttribute } from 'three';
import { WeatherMesh } from '../../../src/presentation/three/WeatherMesh';

const positionsOf = (weather: WeatherMesh): Float32Array => {
  const lines = weather.group.children[0];
  if (lines === undefined || !('geometry' in lines)) {
    throw new Error('weather mesh has no line geometry');
  }
  const geometry = (lines as { geometry: { getAttribute: (name: string) => BufferAttribute } }).geometry;
  return geometry.getAttribute('position').array as Float32Array;
};

const snapshot = (weather: WeatherMesh): Float32Array =>
  Float32Array.from(positionsOf(weather));

describe('WeatherMesh', () => {
  it('rides with the camera so the drop count never depends on travel', () => {
    const weather = new WeatherMesh();
    weather.update(1_600, 900, 0, false);
    expect(weather.group.position.x).toBe(1_600);
    expect(weather.group.position.z).toBe(900);

    weather.update(-400, 2_750, 0, false);
    expect(weather.group.position.x).toBe(-400);
    expect(weather.group.position.z).toBe(2_750);
    weather.dispose();
  });

  it('scatters the same sky every run', () => {
    const first = new WeatherMesh();
    const second = new WeatherMesh();
    first.update(0, 0, 1.25, false);
    second.update(0, 0, 1.25, false);
    expect(snapshot(first)).toEqual(snapshot(second));
    first.dispose();
    second.dispose();
  });

  it('falls over time', () => {
    const weather = new WeatherMesh();
    weather.update(0, 0, 0, false);
    const start = snapshot(weather);
    weather.update(0, 0, 0.05, false);
    const later = snapshot(weather);
    expect(later).not.toEqual(start);
    weather.dispose();
  });

  it('holds still under reduced motion rather than vanishing', () => {
    const weather = new WeatherMesh();
    weather.update(0, 0, 0, true);
    const start = snapshot(weather);
    weather.update(0, 0, 4.5, true);
    const later = snapshot(weather);

    expect(later).toEqual(start);
    // Still weather, not an empty sky.
    expect(later.some((value) => value !== 0)).toBe(true);
    weather.dispose();
  });

  it('is a pure function of elapsed, so a stall cannot desynchronise it', () => {
    const steady = new WeatherMesh();
    const stalled = new WeatherMesh();

    for (const t of [0.1, 0.2, 0.3, 0.4, 0.5]) {
      steady.update(0, 0, t, false);
    }
    // The stalled one skips every frame in between and still lands identical.
    stalled.update(0, 0, 0.5, false);

    expect(snapshot(stalled)).toEqual(snapshot(steady));
    steady.dispose();
    stalled.dispose();
  });

  it('keeps every drop inside the slab it is meant to occupy', () => {
    const weather = new WeatherMesh();
    for (const t of [0, 0.37, 1.9, 12.4, 480]) {
      weather.update(0, 0, t, false);
      const positions = positionsOf(weather);
      for (let index = 0; index < positions.length; index += 3) {
        const y = positions[index + 1] ?? 0;
        expect(Number.isFinite(y)).toBe(true);
        expect(y).toBeGreaterThan(-120);
        expect(y).toBeLessThanOrEqual(700);
      }
    }
    weather.dispose();
  });

  it('leans its streaks with the wind instead of dropping them straight', () => {
    const weather = new WeatherMesh();
    weather.update(0, 0, 0.4, false);
    const positions = positionsOf(weather);

    const topX = positions[0] ?? 0;
    const bottomX = positions[3] ?? 0;
    const topY = positions[1] ?? 0;
    const bottomY = positions[4] ?? 0;

    expect(bottomY).toBeLessThan(topY);
    expect(bottomX).not.toBeCloseTo(topX, 6);
    weather.dispose();
  });
});
