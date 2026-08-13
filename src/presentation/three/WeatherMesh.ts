/**
 * Rain.
 *
 * A fixed slab of streaks that rides with the camera, so the drop count is
 * constant no matter how far the hunter has walked and none of it is ever
 * spent on rain the player cannot see. Each drop's x and z are authored once;
 * only the fall is recomputed, from elapsed time rather than from an
 * accumulator, so a dropped frame does not make the rain stutter.
 *
 * Under reduced motion the rain holds still rather than disappearing: the
 * setting is about movement, not about removing the weather from the world.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
} from 'three';
import { GAMEPLAY_COLORS } from '../../config/graphics';

const DROP_COUNT = 1_100;

/** Slab dimensions in world units; wide enough to cover a 2560px viewport. */
const SLAB_WIDTH = 2_100;
const SLAB_DEPTH = 1_500;
const SLAB_HEIGHT = 620;

const FALL_SPEED = 1_450;
const STREAK_LENGTH = 46;
/** Wind, as a lean off vertical. Matches the 2D rain's slant. */
const LEAN_X = 0.16;
const LEAN_Z = 0.1;

export class WeatherMesh {
  public readonly group = new Group();

  private readonly geometry = new BufferGeometry();
  private readonly material = new LineBasicMaterial({
    color: GAMEPLAY_COLORS.rain,
    transparent: true,
    opacity: 0.26,
  });

  private readonly positions = new Float32Array(DROP_COUNT * 6);
  private readonly seedX = new Float32Array(DROP_COUNT);
  private readonly seedZ = new Float32Array(DROP_COUNT);
  private readonly seedFall = new Float32Array(DROP_COUNT);

  public constructor() {
    // Deterministic scatter: the same sky every run, and no reliance on
    // Math.random ordering for a reproducible screenshot.
    for (let index = 0; index < DROP_COUNT; index += 1) {
      const golden = (index * 0.618_033_988_75) % 1;
      const spiral = (index * 0.754_877_666_25) % 1;
      this.seedX[index] = (golden - 0.5) * SLAB_WIDTH;
      this.seedZ[index] = (spiral - 0.5) * SLAB_DEPTH;
      this.seedFall[index] = ((index * 0.381_966_011) % 1) * SLAB_HEIGHT;
    }

    this.geometry.setAttribute(
      'position',
      new BufferAttribute(this.positions, 3),
    );
    const lines = new LineSegments(this.geometry, this.material);
    lines.frustumCulled = false;
    this.group.add(lines);
  }

  public update(
    centerX: number,
    centerZ: number,
    elapsed: number,
    reducedMotion: boolean,
  ): void {
    this.group.position.set(centerX, 0, centerZ);

    const fallen = reducedMotion ? 0 : elapsed * FALL_SPEED;
    const positions = this.positions;

    for (let index = 0; index < DROP_COUNT; index += 1) {
      const x = this.seedX[index] ?? 0;
      const z = this.seedZ[index] ?? 0;
      const offset = this.seedFall[index] ?? 0;

      // Wrapped from absolute time, so the sky is a pure function of elapsed
      // and never drifts out of step after a stall.
      let top = SLAB_HEIGHT - ((offset + fallen) % SLAB_HEIGHT);
      if (top < 0) {
        top += SLAB_HEIGHT;
      }
      const bottom = top - STREAK_LENGTH;

      const cursor = index * 6;
      positions[cursor] = x;
      positions[cursor + 1] = top;
      positions[cursor + 2] = z;
      positions[cursor + 3] = x - STREAK_LENGTH * LEAN_X;
      positions[cursor + 4] = bottom;
      positions[cursor + 5] = z - STREAK_LENGTH * LEAN_Z;
    }

    const attribute = this.geometry.getAttribute('position');
    attribute.needsUpdate = true;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
