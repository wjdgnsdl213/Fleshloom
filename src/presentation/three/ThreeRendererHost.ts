/**
 * The three.js backend, reachable with `?renderer=three`.
 *
 * This milestone stands the scene up: real ground, real structures, real
 * shadows, and the camera rig locked to the existing Camera2D framing. Actors
 * are placeholder capsules — the articulated creatures that replace them
 * arrive next, and everything here is arranged so that swap touches only
 * `syncActors`.
 */

import {
  ACESFilmicToneMapping,
  Mesh,
  OrthographicCamera,
  PCFSoftShadowMap,
  SphereGeometry,
  Group,
  WebGLRenderer,
} from 'three';
import { PLAYGROUND_TUNING } from '../../config/graphics';
import { QUARANTINE_WORLD_BOUNDS } from '../../config/world';
import {
  WALK_CYCLE_TUNING,
  advanceWalkDistance,
  type WalkCycleTuning,
} from '../Locomotion';
import type {
  FrameListener,
  RendererHost,
  ViewSize,
} from '../RendererHost';
import type { PlaygroundRenderState } from '../RenderState';
import { resolveCameraFraming } from './CameraRig';
import { rigFor } from './creatures/archetypes';
import { CreatureInstance } from './creatures/CreatureInstance';
import { sampleGait, type GaitSample } from './creatures/gait';
import { resolveStance } from './creatures/stance';
import { SCENE_PALETTE, SHARED_MATERIALS, disposeSharedMaterials } from './materials';
import { TetherMesh } from './TetherMesh';
import { WardenMesh } from './WardenMesh';
import { WeatherMesh } from './WeatherMesh';
import { WorldStage } from './WorldStage';

/** Hard ceiling on device pixel ratio; integrated GPUs cannot afford 3x. */
const MAX_PIXEL_RATIO = 1.5;


export class ThreeRendererHost implements RendererHost {
  private renderer: WebGLRenderer | null = null;
  private stage: WorldStage | null = null;
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 1, 10);
  private readonly frameListeners: FrameListener[] = [];

  private readonly actors = new Group();
  private readonly creaturePools = new Map<string, CreatureInstance[]>();
  private readonly walkDistances = new Map<string, number>();
  private readonly seenActors = new Set<string>();
  private readonly projectilePool: Mesh[] = [];
  private lastElapsed = 0;

  private readonly frameCosts = new Float64Array(120);
  private frameCostCursor = 0;
  private frameCostCount = 0;
  private lastDrawStart = 0;

  private readonly tether = new TetherMesh();
  private readonly warden = new WardenMesh();
  private readonly weather = new WeatherMesh();

  private hostElement: HTMLElement | null = null;
  private viewWidth = 1;
  private viewHeight = 1;
  private frameHandle = 0;
  private lastFrameTime = 0;
  private lastState: PlaygroundRenderState | null = null;
  private resizeObserver: ResizeObserver | null = null;

  public async init(host: HTMLElement): Promise<HTMLCanvasElement> {
    this.hostElement = host;

    const renderer = new WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(SCENE_PALETTE.void, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    this.renderer = renderer;

    this.stage = new WorldStage(QUARANTINE_WORLD_BOUNDS);
    this.stage.scene.add(this.actors);

    this.stage.scene.add(this.tether.group);
    this.stage.scene.add(this.warden.group);
    this.stage.scene.add(this.weather.group);

    host.appendChild(renderer.domElement);
    this.applyHostSize();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.applyHostSize();
      });
      this.resizeObserver.observe(host);
    }

    this.lastFrameTime = performance.now();
    this.frameHandle = requestAnimationFrame(this.tick);

    return renderer.domElement;
  }

  public async loadDeferredAssets(): Promise<void> {
    // Nothing streams in yet: every surface here is procedural geometry.
  }

  public viewSize(): ViewSize {
    return { width: this.viewWidth, height: this.viewHeight };
  }

  public addFrameListener(listener: FrameListener): void {
    this.frameListeners.push(listener);
  }

  public render(state: PlaygroundRenderState): void {
    const renderer = this.renderer;
    const stage = this.stage;
    if (renderer === null || stage === null) {
      return;
    }

    this.lastState = state;
    this.applyCamera(state);
    this.syncActors(state);
    this.syncProjectiles(state);
    this.tether.update(state);
    this.warden.update(state.warden, state.elapsed);
    this.weather.update(
      state.camera.x + state.camera.viewportWidth / 2,
      state.camera.y + state.camera.viewportHeight / 2,
      state.elapsed,
      state.reducedMotion,
    );
    renderer.render(stage.scene, this.camera);
    this.recordFrameCost();
  }

  public async captureViewport(): Promise<string | null> {
    const renderer = this.renderer;
    const stage = this.stage;
    if (renderer === null || stage === null) {
      return null;
    }
    // Re-render and read back in the same synchronous block, so the drawing
    // buffer is still intact without paying for preserveDrawingBuffer.
    if (this.lastState !== null) {
      this.render(this.lastState);
    } else {
      renderer.render(stage.scene, this.camera);
    }
    return renderer.domElement.toDataURL('image/png');
  }

  public destroy(): void {
    cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.frameListeners.length = 0;

    for (const pool of this.creaturePools.values()) {
      for (const creature of pool) {
        creature.dispose();
      }
    }
    this.creaturePools.clear();
    this.walkDistances.clear();

    for (const mesh of this.projectilePool) {
      mesh.geometry.dispose();
    }
    this.projectilePool.length = 0;

    this.tether.dispose();
    this.warden.dispose();
    this.weather.dispose();

    this.stage?.dispose();
    this.stage = null;
    disposeSharedMaterials();

    const renderer = this.renderer;
    if (renderer !== null) {
      renderer.domElement.remove();
      renderer.dispose();
      this.renderer = null;
    }
    this.hostElement = null;
  }

  private applyHostSize(): void {
    const host = this.hostElement;
    const renderer = this.renderer;
    if (host === null || renderer === null) {
      return;
    }
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    this.viewWidth = width;
    this.viewHeight = height;
    renderer.setSize(width, height, false);
  }

  private applyCamera(state: PlaygroundRenderState): void {
    const framing = resolveCameraFraming(state.camera);
    const camera = this.camera;

    camera.left = -framing.halfWidth;
    camera.right = framing.halfWidth;
    camera.top = framing.halfHeight;
    camera.bottom = -framing.halfHeight;
    camera.near = framing.near;
    camera.far = framing.far;
    camera.position.set(
      framing.position.x,
      framing.position.y,
      framing.position.z,
    );
    camera.up.set(framing.up.x, framing.up.y, framing.up.z);
    camera.lookAt(framing.target.x, framing.target.y, framing.target.z);
    camera.updateProjectionMatrix();

    this.stage?.focusShadows(
      framing.target.x,
      framing.target.z,
      framing.halfWidth,
      (framing.visibleGround.maxZ - framing.visibleGround.minZ) / 2,
    );
    this.stage?.focusLights(framing.target.x, framing.target.z);
  }

  /**
   * Creatures are pooled per archetype rather than in one flat list: rigs
   * differ in limb count and proportion, so a pooled instance can only be
   * handed back to an actor of the same archetype.
   */
  private creatureFor(archetype: string, taken: Map<string, number>): CreatureInstance {
    const index = taken.get(archetype) ?? 0;
    taken.set(archetype, index + 1);

    let pool = this.creaturePools.get(archetype);
    if (pool === undefined) {
      pool = [];
      this.creaturePools.set(archetype, pool);
    }

    const existing = pool[index];
    if (existing !== undefined) {
      existing.setVisible(true);
      return existing;
    }

    const instance = new CreatureInstance(
      rigFor(archetype),
      archetype === 'hunter'
        ? SHARED_MATERIALS.hunterFlesh
        : SHARED_MATERIALS.hostileFlesh,
      SHARED_MATERIALS.armorPlate,
    );
    pool.push(instance);
    this.actors.add(instance.root);
    return instance;
  }

  /**
   * Walk distance drives the gait, and the render state carries position
   * rather than distance travelled, so it is integrated here per actor. The
   * key has to survive across frames, which is why enemies are tracked by id.
   */
  private advanceGait(
    key: string,
    speed: number,
    deltaSeconds: number,
    tuning: WalkCycleTuning,
  ): GaitSample {
    const previous = this.walkDistances.get(key) ?? 0;
    const distance = advanceWalkDistance(previous, speed, deltaSeconds);
    this.walkDistances.set(key, distance);
    this.seenActors.add(key);
    return sampleGait(distance, speed, tuning);
  }

  private syncActors(state: PlaygroundRenderState): void {
    const deltaSeconds = Math.min(
      Math.max(state.elapsed - this.lastElapsed, 0),
      0.1,
    );
    this.lastElapsed = state.elapsed;

    const taken = new Map<string, number>();
    this.seenActors.clear();

    const playerSpeed = Math.hypot(
      state.playerVelocity.x,
      state.playerVelocity.y,
    );
    const hunter = this.creatureFor('hunter', taken);
    hunter.update(
      state.player,
      state.playerVelocity,
      PLAYGROUND_TUNING.playerRadius,
      this.advanceGait(
        'hunter',
        playerSpeed,
        deltaSeconds,
        WALK_CYCLE_TUNING.carrier,
      ),
    );

    for (const enemy of state.enemies) {
      if (!enemy.alive) {
        continue;
      }
      const creature = this.creatureFor(enemy.archetype, taken);
      const speed = Math.hypot(enemy.velocity.x, enemy.velocity.y);
      const tuning =
        WALK_CYCLE_TUNING[enemy.archetype as keyof typeof WALK_CYCLE_TUNING] ??
        WALK_CYCLE_TUNING.drifter;
      creature.setArmored(enemy.armored !== false);
      creature.update(
        enemy.position,
        enemy.facing,
        enemy.radius,
        this.advanceGait(enemy.id, speed, deltaSeconds, tuning),
        resolveStance(enemy.behaviorState, enemy.staggerRemaining),
      );
    }

    for (const [archetype, pool] of this.creaturePools) {
      for (let spare = taken.get(archetype) ?? 0; spare < pool.length; spare += 1) {
        pool[spare]?.setVisible(false);
      }
    }

    // Drop gait state for actors that are gone, so a long run does not leak a
    // map entry per corpse.
    for (const key of this.walkDistances.keys()) {
      if (!this.seenActors.has(key)) {
        this.walkDistances.delete(key);
      }
    }
  }

  private syncProjectiles(state: PlaygroundRenderState): void {
    let index = 0;
    for (const projectile of state.projectiles) {
      if (!projectile.alive) {
        continue;
      }
      let mesh = this.projectilePool[index];
      if (mesh === undefined) {
        mesh = new Mesh(
          new SphereGeometry(1, 8, 6),
          SHARED_MATERIALS.tether,
        );
        mesh.castShadow = true;
        this.projectilePool.push(mesh);
        this.actors.add(mesh);
      }
      mesh.scale.setScalar(projectile.radius);
      mesh.position.set(
        projectile.position.x,
        projectile.radius + 8,
        projectile.position.y,
      );
      mesh.visible = true;
      index += 1;
    }

    for (let spare = index; spare < this.projectilePool.length; spare += 1) {
      const mesh = this.projectilePool[spare];
      if (mesh !== undefined) {
        mesh.visible = false;
      }
    }
  }

  /**
   * Rolling draw cost, exposed through the QA hook so a headless run can
   * compare backends without a profiler attached.
   */
  private recordFrameCost(): void {
    const now = performance.now();
    if (this.lastDrawStart > 0) {
      const cost = now - this.lastDrawStart;
      this.frameCosts[this.frameCostCursor] = cost;
      this.frameCostCursor = (this.frameCostCursor + 1) % this.frameCosts.length;
      this.frameCostCount = Math.min(
        this.frameCostCount + 1,
        this.frameCosts.length,
      );
    }
    this.lastDrawStart = now;
  }

  public frameCostMs(): { readonly mean: number; readonly worst: number } {
    if (this.frameCostCount === 0) {
      return { mean: 0, worst: 0 };
    }
    let total = 0;
    let worst = 0;
    for (let index = 0; index < this.frameCostCount; index += 1) {
      const cost = this.frameCosts[index] ?? 0;
      total += cost;
      worst = Math.max(worst, cost);
    }
    return { mean: total / this.frameCostCount, worst };
  }

  private readonly tick = (now: number): void => {
    this.frameHandle = requestAnimationFrame(this.tick);
    const deltaSeconds = Math.min((now - this.lastFrameTime) / 1_000, 0.1);
    this.lastFrameTime = now;
    for (const listener of this.frameListeners) {
      listener(deltaSeconds);
    }
  };
}

export function createThreeRendererHost(): RendererHost {
  return new ThreeRendererHost();
}
