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
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PCFSoftShadowMap,
  SphereGeometry,
  DoubleSide,
  Group,
  WebGLRenderer,
} from 'three';
import { PLAYGROUND_TUNING } from '../../config/graphics';
import { QUARANTINE_WORLD_BOUNDS } from '../../config/world';
import type { Vec2 } from '../../core/geometry/vector';
import type {
  FrameListener,
  RendererHost,
  ViewSize,
} from '../RendererHost';
import type { PlaygroundRenderState } from '../RenderState';
import { resolveCameraFraming } from './CameraRig';
import { SCENE_PALETTE, SHARED_MATERIALS, disposeSharedMaterials } from './materials';
import { WorldStage } from './WorldStage';

/** Hard ceiling on device pixel ratio; integrated GPUs cannot afford 3x. */
const MAX_PIXEL_RATIO = 1.5;

/** Ground clearance for the tether ribbon. */
const TETHER_LIFT = 2.4;
const TETHER_HALF_WIDTH = 3.6;

const CAPSULE_SEGMENTS = 10;
const CAPSULE_RINGS = 5;

/**
 * Body proportions relative to the collision radius. Bodies are far taller
 * than they are wide — the 2D renderer already draws actors at roughly 5.7x
 * their collision radius, so matching the collider one-to-one would leave the
 * creatures reading as pebbles.
 */
const BODY_RADIUS_IN_COLLIDER_RADII = 0.95;
const BODY_CYLINDER_IN_COLLIDER_RADII = 2.1;
const BODY_HEIGHT_IN_COLLIDER_RADII =
  BODY_RADIUS_IN_COLLIDER_RADII * 2 + BODY_CYLINDER_IN_COLLIDER_RADII;

export class ThreeRendererHost implements RendererHost {
  private renderer: WebGLRenderer | null = null;
  private stage: WorldStage | null = null;
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 1, 10);
  private readonly frameListeners: FrameListener[] = [];

  private readonly actors = new Group();
  private readonly actorPool: Mesh[] = [];
  private readonly projectilePool: Mesh[] = [];

  private readonly tetherGeometry = new BufferGeometry();
  private tetherVertices = new Float32Array(0);
  private tetherMesh: Mesh | null = null;

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

    this.tetherMesh = new Mesh(
      this.tetherGeometry,
      new MeshBasicMaterial({
        color: SCENE_PALETTE.arterialBright,
        side: DoubleSide,
        transparent: true,
        opacity: 0.92,
      }),
    );
    this.tetherMesh.frustumCulled = false;
    this.tetherMesh.visible = false;
    this.stage.scene.add(this.tetherMesh);

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
    this.syncTether(state);
    renderer.render(stage.scene, this.camera);
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

    for (const mesh of [...this.actorPool, ...this.projectilePool]) {
      mesh.geometry.dispose();
    }
    this.actorPool.length = 0;
    this.projectilePool.length = 0;

    this.tetherGeometry.dispose();
    if (this.tetherMesh !== null) {
      (this.tetherMesh.material as MeshBasicMaterial).dispose();
      this.tetherMesh = null;
    }

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
      framing.halfHeight / Math.sin(Math.PI / 3),
    );
  }

  private actorAt(index: number): Mesh {
    const existing = this.actorPool[index];
    if (existing !== undefined) {
      return existing;
    }
    const mesh = new Mesh(
      // Authored at collider-radius 1 so each instance scales uniformly and
      // the hemispherical caps never shear.
      new CapsuleGeometry(
        BODY_RADIUS_IN_COLLIDER_RADII,
        BODY_CYLINDER_IN_COLLIDER_RADII,
        CAPSULE_RINGS,
        CAPSULE_SEGMENTS,
      ),
      SHARED_MATERIALS.hostileFlesh,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.actorPool.push(mesh);
    this.actors.add(mesh);
    return mesh;
  }

  private placeCapsule(
    mesh: Mesh,
    position: Vec2,
    radius: number,
    facing: Vec2,
  ): void {
    mesh.scale.setScalar(radius);
    mesh.position.set(
      position.x,
      (radius * BODY_HEIGHT_IN_COLLIDER_RADII) / 2,
      position.y,
    );
    if (facing.x !== 0 || facing.y !== 0) {
      mesh.rotation.y = Math.atan2(facing.x, facing.y);
    }
    mesh.visible = true;
  }

  private syncActors(state: PlaygroundRenderState): void {
    let index = 0;

    const player = this.actorAt(index);
    index += 1;
    player.material = SHARED_MATERIALS.hunterFlesh;
    this.placeCapsule(
      player,
      state.player,
      PLAYGROUND_TUNING.playerRadius,
      state.playerVelocity,
    );

    for (const enemy of state.enemies) {
      if (!enemy.alive) {
        continue;
      }
      const mesh = this.actorAt(index);
      index += 1;
      mesh.material =
        enemy.armored === true
          ? SHARED_MATERIALS.armorPlate
          : SHARED_MATERIALS.hostileFlesh;
      this.placeCapsule(mesh, enemy.position, enemy.radius, enemy.facing);
    }

    for (let spare = index; spare < this.actorPool.length; spare += 1) {
      const mesh = this.actorPool[spare];
      if (mesh !== undefined) {
        mesh.visible = false;
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

  private syncTether(state: PlaygroundRenderState): void {
    const mesh = this.tetherMesh;
    if (mesh === null) {
      return;
    }

    const samples = state.loopSamples;
    const segments = samples.length - 1;
    if (segments < 1) {
      mesh.visible = false;
      return;
    }

    const floats = segments * 18;
    if (this.tetherVertices.length !== floats) {
      this.tetherVertices = new Float32Array(floats);
      this.tetherGeometry.setAttribute(
        'position',
        new BufferAttribute(this.tetherVertices, 3),
      );
    }

    const vertices = this.tetherVertices;
    let cursor = 0;
    for (let index = 0; index < segments; index += 1) {
      const from = samples[index];
      const to = samples[index + 1];
      if (from === undefined || to === undefined) {
        continue;
      }
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy);
      if (length < 1e-6) {
        continue;
      }
      const nx = (-dy / length) * TETHER_HALF_WIDTH;
      const ny = (dx / length) * TETHER_HALF_WIDTH;

      const ax = from.x + nx;
      const az = from.y + ny;
      const bx = from.x - nx;
      const bz = from.y - ny;
      const cx = to.x + nx;
      const cz = to.y + ny;
      const ex = to.x - nx;
      const ez = to.y - ny;

      vertices[cursor] = ax; vertices[cursor + 1] = TETHER_LIFT; vertices[cursor + 2] = az;
      vertices[cursor + 3] = bx; vertices[cursor + 4] = TETHER_LIFT; vertices[cursor + 5] = bz;
      vertices[cursor + 6] = cx; vertices[cursor + 7] = TETHER_LIFT; vertices[cursor + 8] = cz;
      vertices[cursor + 9] = bx; vertices[cursor + 10] = TETHER_LIFT; vertices[cursor + 11] = bz;
      vertices[cursor + 12] = ex; vertices[cursor + 13] = TETHER_LIFT; vertices[cursor + 14] = ez;
      vertices[cursor + 15] = cx; vertices[cursor + 16] = TETHER_LIFT; vertices[cursor + 17] = cz;
      cursor += 18;
    }

    vertices.fill(0, cursor);
    const attribute = this.tetherGeometry.getAttribute('position');
    attribute.needsUpdate = true;
    this.tetherGeometry.computeBoundingSphere();
    mesh.visible = cursor > 0;
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
