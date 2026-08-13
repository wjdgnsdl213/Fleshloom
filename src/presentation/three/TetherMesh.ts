/**
 * The living tether and the capture beat, in 3D.
 *
 * The cord is braided from the same strand maths the 2D backend uses
 * (`LivingTetherGeometry`), which is pure world-space geometry — it lifts to
 * 3D by holding a constant elevation. The beat is read from `CaptureBeat`, so
 * both backends play the same 0.82 second phrase rather than two similar ones.
 *
 * All of it draws onto a single reused ribbon buffer. Loop sample counts move
 * every frame while the player is drawing, so the buffer is grown to a high
 * water mark and the unused tail is collapsed rather than reallocated.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import { GAMEPLAY_COLORS } from '../../config/graphics';
import type { Vec2 } from '../../core/geometry/vector';
import { sampleCaptureBeat, sampleMissEcho } from '../CaptureBeat';
import { wovenStrandPoints } from '../LivingTetherGeometry';
import type {
  ClosureEchoView,
  LoopCutEchoView,
  PlaygroundRenderState,
  WardenAttackEchoView,
} from '../RenderState';

/** Ground clearance, in world units, for each layer of the effect. */
const CORD_LIFT = 3.2;
const RING_LIFT = 2.2;
const ECHO_LIFT = 1.8;

const CORD_HALF_WIDTH = 2.6;
const STRAND_SPACING = 14;
const STRAND_AMPLITUDE = 3.4;
const STRAND_WAVELENGTH = 62;
const STRAND_COUNT = 3;

const RING_SEGMENTS = 48;

const FLOATS_PER_QUAD = 18;

/** Writes flat ribbons into one buffer, then hands back how much it used. */
class RibbonBuilder {
  public readonly geometry = new BufferGeometry();

  private vertices = new Float32Array(0);
  private cursor = 0;

  public begin(): void {
    this.cursor = 0;
  }

  public quadStrip(
    points: readonly Vec2[],
    halfWidth: number,
    lift: number,
    closed = false,
  ): void {
    const segments = points.length - 1 + (closed ? 1 : 0);
    if (segments < 1 || halfWidth <= 0) {
      return;
    }
    this.reserve(segments * FLOATS_PER_QUAD);

    for (let index = 0; index < segments; index += 1) {
      const from = points[index % points.length];
      const to = points[(index + 1) % points.length];
      if (from === undefined || to === undefined) {
        continue;
      }
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy);
      if (length < 1e-6) {
        continue;
      }
      const nx = (-dy / length) * halfWidth;
      const ny = (dx / length) * halfWidth;
      this.quad(
        from.x + nx, from.y + ny,
        from.x - nx, from.y - ny,
        to.x + nx, to.y + ny,
        to.x - nx, to.y - ny,
        lift,
      );
    }
  }

  public ring(
    center: Vec2,
    radius: number,
    halfWidth: number,
    lift: number,
  ): void {
    if (radius <= 0 || halfWidth <= 0) {
      return;
    }
    this.reserve(RING_SEGMENTS * FLOATS_PER_QUAD);

    const inner = Math.max(0, radius - halfWidth);
    const outer = radius + halfWidth;
    for (let index = 0; index < RING_SEGMENTS; index += 1) {
      const a = (index / RING_SEGMENTS) * Math.PI * 2;
      const b = ((index + 1) / RING_SEGMENTS) * Math.PI * 2;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      const cosB = Math.cos(b);
      const sinB = Math.sin(b);
      this.quad(
        center.x + cosA * outer, center.y + sinA * outer,
        center.x + cosA * inner, center.y + sinA * inner,
        center.x + cosB * outer, center.y + sinB * outer,
        center.x + cosB * inner, center.y + sinB * inner,
        lift,
      );
    }
  }

  /** Returns true when anything was written. */
  public end(): boolean {
    const attribute = this.geometry.getAttribute('position');
    if (attribute === undefined) {
      return false;
    }
    this.vertices.fill(0, this.cursor);
    attribute.needsUpdate = true;
    this.geometry.computeBoundingSphere();
    return this.cursor > 0;
  }

  public dispose(): void {
    this.geometry.dispose();
  }

  private reserve(floats: number): void {
    const needed = this.cursor + floats;
    if (this.vertices.length >= needed) {
      return;
    }
    // Grow to a high water mark rather than to exactly what this frame needs:
    // the sample count changes every frame while a loop is being drawn.
    const grown = new Float32Array(Math.max(needed, this.vertices.length * 2));
    grown.set(this.vertices);
    this.vertices = grown;
    this.geometry.setAttribute(
      'position',
      new BufferAttribute(this.vertices, 3),
    );
  }

  private quad(
    ax: number, az: number,
    bx: number, bz: number,
    cx: number, cz: number,
    dx: number, dz: number,
    lift: number,
  ): void {
    const v = this.vertices;
    let at = this.cursor;
    v[at] = ax; v[at + 1] = lift; v[at + 2] = az;
    v[at + 3] = bx; v[at + 4] = lift; v[at + 5] = bz;
    v[at + 6] = cx; v[at + 7] = lift; v[at + 8] = cz;
    at += 9;
    v[at] = bx; v[at + 1] = lift; v[at + 2] = bz;
    v[at + 3] = dx; v[at + 4] = lift; v[at + 5] = dz;
    v[at + 6] = cx; v[at + 7] = lift; v[at + 8] = cz;
    this.cursor += FLOATS_PER_QUAD;
  }
}

export class TetherMesh {
  public readonly group = new Group();

  private readonly cord = new RibbonBuilder();
  private readonly glow = new RibbonBuilder();

  private readonly cordMaterial = new MeshBasicMaterial({
    color: GAMEPLAY_COLORS.arterial,
    side: DoubleSide,
    transparent: true,
    opacity: 0.94,
  });

  private readonly glowMaterial = new MeshBasicMaterial({
    color: GAMEPLAY_COLORS.arterialBright,
    side: DoubleSide,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    opacity: 0.5,
  });

  private readonly cordMesh: Mesh;
  private readonly glowMesh: Mesh;

  public constructor() {
    this.cordMesh = new Mesh(this.cord.geometry, this.cordMaterial);
    this.glowMesh = new Mesh(this.glow.geometry, this.glowMaterial);
    for (const mesh of [this.cordMesh, this.glowMesh]) {
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      this.group.add(mesh);
    }
  }

  public update(state: PlaygroundRenderState): void {
    this.cord.begin();
    this.glow.begin();

    this.buildLiveTether(state);
    if (state.closureEcho !== null) {
      this.buildClosureEcho(state.closureEcho, state.player, state.reducedFlash);
    }
    if (state.loopCutEcho !== null) {
      this.buildLoopCut(state.loopCutEcho);
    }
    if (state.wardenAttackEcho !== null) {
      this.buildWardenAttack(state.wardenAttackEcho);
    }

    this.cordMesh.visible = this.cord.end();
    this.glowMesh.visible = this.glow.end();
  }

  public dispose(): void {
    this.cord.dispose();
    this.glow.dispose();
    this.cordMaterial.dispose();
    this.glowMaterial.dispose();
  }

  /** The cord the hunter is trailing right now. */
  private buildLiveTether(state: PlaygroundRenderState): void {
    const samples = state.loopSamples;
    if (samples.length < 2) {
      return;
    }

    this.cord.quadStrip(samples, CORD_HALF_WIDTH, CORD_LIFT);

    // Braided strands, woven around the path the same way the 2D cord is.
    // Frozen in place under reduced motion so the weave stops crawling.
    const phaseBase = state.reducedMotion ? 0 : state.elapsed * 3.1;
    for (let strand = 0; strand < STRAND_COUNT; strand += 1) {
      const phase = phaseBase + (strand / STRAND_COUNT) * Math.PI * 2;
      const woven = wovenStrandPoints(
        samples,
        STRAND_SPACING,
        STRAND_AMPLITUDE,
        STRAND_WAVELENGTH,
        phase,
      );
      this.glow.quadStrip(woven, CORD_HALF_WIDTH * 0.5, CORD_LIFT + 0.4);
    }
  }

  private buildClosureEcho(
    echo: ClosureEchoView,
    player: Vec2,
    reducedFlash: boolean,
  ): void {
    const points = echo.closure.points;
    if (points.length < 3) {
      return;
    }

    if (echo.captured === 0) {
      // A miss just fades: no contraction, no draw-in, nothing earned.
      const fade = sampleMissEcho(echo.age);
      if (fade > 0.02) {
        this.cord.quadStrip(points, CORD_HALF_WIDTH * fade, RING_LIFT, true);
      }
      return;
    }

    const beat = sampleCaptureBeat(echo.age, reducedFlash);
    if (beat.phase === 'spent') {
      return;
    }

    const centroid = polygonCentre(points);

    // The sealed loop contracts onto what it caught, scaled about the centre
    // it closed around.
    if (beat.ringScale > 0.01) {
      const contracted = points.map((point) => ({
        x: centroid.x + (point.x - centroid.x) * beat.ringScale,
        y: centroid.y + (point.y - centroid.y) * beat.ringScale,
      }));
      this.cord.quadStrip(
        contracted,
        CORD_HALF_WIDTH * (0.6 + beat.ringScale * 0.8),
        RING_LIFT,
        true,
      );
    }

    if (beat.flash > 0.02) {
      this.glow.ring(
        centroid,
        echo.bladeBandWidth + beat.flash * 46,
        4 + beat.flash * 10,
        RING_LIFT + 0.4,
      );
    }

    // Each catch comes apart and travels to the hunter.
    for (const captured of echo.capturedEnemies) {
      if (beat.bodyScale <= 0.02) {
        break;
      }
      const x =
        captured.position.x + (player.x - captured.position.x) * beat.intake;
      const y =
        captured.position.y + (player.y - captured.position.y) * beat.intake;
      this.glow.ring(
        { x, y },
        captured.radius * beat.bodyScale,
        Math.max(0.8, captured.radius * beat.bodyScale * 0.42),
        ECHO_LIFT,
      );
    }
  }

  /** A severed loop: one hard expanding ring at the cut. */
  private buildLoopCut(echo: LoopCutEchoView): void {
    const progress = Math.min(1, Math.max(0, echo.age / 0.46));
    const strength = 1 - progress;
    if (strength <= 0.02) {
      return;
    }
    this.glow.ring(
      echo.position,
      10 + (1 - (1 - progress) ** 3) * 42,
      3 * strength,
      ECHO_LIFT,
    );
  }

  private buildWardenAttack(echo: WardenAttackEchoView): void {
    const geometry = echo.geometry;
    const strength = 1 - Math.min(1, Math.max(0, echo.age / 0.5));
    if (strength <= 0.02) {
      return;
    }

    // Switch on the geometry rather than the echo kind: the geometry is the
    // discriminated union, and it is what has to be drawn.
    if (geometry.kind === 'ring') {
      this.glow.ring(
        geometry.center,
        geometry.radius,
        Math.max(1, geometry.halfWidth * strength),
        ECHO_LIFT,
      );
      return;
    }

    this.glow.quadStrip(
      [geometry.start, geometry.end],
      Math.max(1, geometry.halfWidth * strength),
      ECHO_LIFT,
    );
  }
}

const polygonCentre = (points: readonly Vec2[]): Vec2 => {
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  const count = Math.max(1, points.length);
  return { x: x / count, y: y / count };
};
