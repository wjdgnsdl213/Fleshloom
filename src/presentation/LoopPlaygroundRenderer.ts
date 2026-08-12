import {
  Assets,
  Container,
  Graphics,
  MeshRope,
  Point,
  Rectangle,
  Sprite,
  Texture,
  TilingSprite,
} from 'pixi.js';
import type { EnemyImprintKind } from '../content/enemies';
import type { EnemyCaptureProfile } from '../content/enemies';
import type { FullRunEnemyArchetype } from '../content/fullRunEnemies';
import {
  DISTRICT_BIOMASS,
  DISTRICT_CROSSWALKS,
  DISTRICT_LIGHTS,
  DISTRICT_PUDDLES,
  DISTRICT_VENTS,
} from '../content/quarantineDistrict';
import { GAMEPLAY_COLORS, PLAYGROUND_TUNING } from '../config/graphics';
import type { WorldBounds } from '../config/world';
import { polygonCentroid } from '../core/geometry/polygon';
import { lerpVec2, type Vec2 } from '../core/geometry/vector';
import type {
  WardenAttackGeometry,
  WardenSnapshot,
} from '../game/boss/WardenModel';
import type {
  LoopClosure,
  LoopPreview,
} from '../game/loop/LoopPath';
import type { Camera2DSnapshot } from '../game/world/Camera2D';
import { ART_ASSET_URLS } from './AssetManifest';
import {
  advanceWalkDistance,
  sampleWalkCycle,
  WALK_CYCLE_TUNING,
  type WalkCycleSample,
} from './Locomotion';

const TETHER_ROPE_POINT_COUNT = 64;
const TETHER_ROPE_SCALE = 0.059;
const CAPTURE_RASTER_HOLD_END = 0.22;
const CAPTURE_RASTER_FADE_END = 0.36;
const ASPHALT_TILE_SCALE = 0.58;
const WORLD_BARRIER_INSET = 34;
const WORLD_BARRIER_LENGTH = 92;
const WORLD_BARRIER_DEPTH = 34;
const EMPTY_WALK_TEXTURES: readonly Texture[] = Object.freeze([]);

interface EnemySpriteTuning {
  readonly anchorY: number;
  readonly heightInRadii: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

const ENEMY_SPRITE_TUNING: Record<
  FullRunEnemyArchetype,
  EnemySpriteTuning
> = {
  drifter: { anchorY: 0.44, heightInRadii: 4.7, scaleX: 1, scaleY: 1 },
  rusher: { anchorY: 0.48, heightInRadii: 4.85, scaleX: 0.9, scaleY: 1.04 },
  watcher: { anchorY: 0.47, heightInRadii: 4.45, scaleX: 1.1, scaleY: 0.94 },
  cutter: { anchorY: 0.47, heightInRadii: 4.9, scaleX: 0.98, scaleY: 1.04 },
  mimic: { anchorY: 0.48, heightInRadii: 4.55, scaleX: 1.07, scaleY: 0.96 },
  'elite-husk': {
    anchorY: 0.52,
    heightInRadii: 3.78,
    scaleX: 1.08,
    scaleY: 1,
  },
};

const DRIFTER_FALLBACK_TUNING: Record<
  FullRunEnemyArchetype,
  EnemySpriteTuning
> = {
  drifter: ENEMY_SPRITE_TUNING.drifter,
  rusher: { anchorY: 0.44, heightInRadii: 4.7, scaleX: 0.82, scaleY: 1.18 },
  watcher: { anchorY: 0.44, heightInRadii: 4.7, scaleX: 1.12, scaleY: 0.88 },
  cutter: { anchorY: 0.44, heightInRadii: 4.7, scaleX: 0.68, scaleY: 1.34 },
  mimic: { anchorY: 0.44, heightInRadii: 4.7, scaleX: 1.28, scaleY: 0.86 },
  'elite-husk': {
    anchorY: 0.44,
    heightInRadii: 4.7,
    scaleX: 1.22,
    scaleY: 1.12,
  },
};

export interface PlaygroundEnemyView {
  readonly id: string;
  readonly archetype: FullRunEnemyArchetype;
  readonly position: Vec2;
  readonly velocity: Vec2;
  readonly facing: Vec2;
  readonly behaviorState: string;
  readonly lockedTarget: Vec2 | null;
  readonly radius: number;
  readonly phase: number;
  readonly alive: boolean;
  readonly captureProfile?: EnemyCaptureProfile;
  readonly armored?: boolean;
  readonly staggerRemaining?: number;
}

export interface PlaygroundProjectileView {
  readonly position: Vec2;
  readonly velocity: Vec2;
  readonly radius: number;
  readonly alive: boolean;
}

export interface CapturedEnemyEchoView {
  readonly archetype: FullRunEnemyArchetype;
  readonly position: Vec2;
  readonly radius: number;
  readonly phase: number;
  readonly captureLayer: 'ordinary' | 'peeled' | 'killed';
  readonly captureProfile?: EnemyCaptureProfile;
}

export interface ClosureEchoView {
  readonly closure: LoopClosure;
  readonly projections: readonly LoopClosure[];
  readonly captured: number;
  readonly capturedPositions: readonly Vec2[];
  readonly capturedEnemies: readonly CapturedEnemyEchoView[];
  readonly imprintKind: EnemyImprintKind | null;
  readonly bladeBandWidth: number;
  readonly age: number;
}

export interface LoopCutEchoView {
  readonly position: Vec2;
  readonly age: number;
}

export interface WardenAttackEchoView {
  readonly kind: 'lash' | 'discharge';
  readonly geometry: WardenAttackGeometry;
  readonly age: number;
}

export interface PlaygroundRenderState {
  readonly width: number;
  readonly height: number;
  readonly worldBounds: WorldBounds;
  readonly camera: Camera2DSnapshot;
  readonly elapsed: number;
  readonly player: Vec2;
  readonly playerVelocity: Vec2;
  readonly warden: WardenSnapshot | null;
  readonly enemies: readonly PlaygroundEnemyView[];
  readonly projectiles: readonly PlaygroundProjectileView[];
  readonly playerInvulnerability: number;
  readonly activeImprint: EnemyImprintKind | null;
  readonly bladeBandWidth: number;
  readonly nerveFieldRadius: number;
  readonly loopSamples: readonly Vec2[];
  readonly loopPreview: LoopPreview | null;
  readonly projectedLoopPreviews: readonly LoopClosure[];
  readonly closureEcho: ClosureEchoView | null;
  readonly loopCutEcho: LoopCutEchoView | null;
  readonly wardenAttackEcho: WardenAttackEchoView | null;
  readonly reducedMotion: boolean;
  readonly reducedFlash: boolean;
}

export class LoopPlaygroundRenderer {
  private readonly worldLayer = new Container();
  private readonly asphaltTile = new TilingSprite({
    texture: Texture.EMPTY,
    width: 1,
    height: 1,
  });
  private readonly backgroundSprite = new Sprite(Texture.EMPTY);
  private readonly environment = new Graphics();
  private readonly environmentAtmosphere = new Graphics();
  private readonly environmentProps = new Graphics();
  private readonly wardenUnderlay = new Graphics();
  private readonly wardenSpriteLayer = new Container();
  private readonly wardenSprite = new Sprite(Texture.EMPTY);
  private readonly wardenSpriteMask = new Graphics();
  private readonly actors = new Graphics();
  private readonly assetActors = new Container();
  private readonly enemySpriteLayer = new Container();
  private readonly playerSprite = new Sprite(Texture.EMPTY);
  private readonly enemySprites: Sprite[] = [];
  private readonly tetherLayer = new Container();
  private readonly capturedEchoLayer = new Container();
  private readonly capturedEchoSprites: Sprite[] = [];
  private readonly tetherRopePoints = Array.from(
    { length: TETHER_ROPE_POINT_COUNT },
    () => new Point(),
  );
  private readonly tetherCumulativeDistances = new Float32Array(
    PLAYGROUND_TUNING.maxLoopSamples,
  );
  private readonly loopGraphics = new Graphics();
  private readonly effects = new Graphics();
  private readonly weather = new Graphics();
  private backgroundTexture: Texture | null = null;
  private asphaltTexture: Texture | null = null;
  private carrierTexture: Texture | null = null;
  private carrierWalkTextures: readonly Texture[] = [];
  private drifterTexture: Texture | null = null;
  private armoredDrifterTexture: Texture | null = null;
  private armoredDrifterWalkTextures: readonly Texture[] = [];
  private readonly enemyTextures: Partial<
    Record<FullRunEnemyArchetype, Texture>
  > = {};
  private readonly enemyWalkTextures: Partial<
    Record<FullRunEnemyArchetype, readonly Texture[]>
  > = {};
  private readonly enemyWalkStates = new Map<
    string,
    { x: number; y: number; distance: number; lastSeenFrame: number }
  >();
  private actorRenderFrame = 0;
  private wardenTexture: Texture | null = null;
  private tetherRope: MeshRope | null = null;
  private startupAssetLoadPromise: Promise<void> | null = null;
  private deferredAssetLoadPromise: Promise<void> | null = null;
  private environmentWidth = -1;
  private environmentHeight = -1;
  private lastPlayerX = Number.NaN;
  private lastPlayerY = Number.NaN;
  private playerFacing = -0.48;
  private carrierWalkX = Number.NaN;
  private carrierWalkY = Number.NaN;
  private carrierWalkDistance = 0;

  public constructor() {
    this.asphaltTile.visible = false;
    this.backgroundSprite.anchor.set(0.5);
    this.backgroundSprite.visible = false;
    this.playerSprite.anchor.set(0.5, 0.42);
    this.playerSprite.visible = false;
    this.wardenSprite.anchor.set(0.5, 0.4);
    this.wardenSprite.visible = false;
    this.wardenSprite.mask = this.wardenSpriteMask;
    this.wardenSpriteLayer.addChild(
      this.wardenSprite,
      this.wardenSpriteMask,
    );
    this.assetActors.addChild(this.enemySpriteLayer, this.playerSprite);
  }

  public async loadAssets(): Promise<void> {
    this.startupAssetLoadPromise ??= this.loadStartupAssetsSafely();
    await this.startupAssetLoadPromise;
  }

  public async loadDeferredAssets(): Promise<void> {
    this.deferredAssetLoadPromise ??= this.loadDeferredAssetsSafely();
    await this.deferredAssetLoadPromise;
  }

  public attach(stage: Container): void {
    this.worldLayer.addChild(
      this.asphaltTile,
      this.backgroundSprite,
      this.environment,
      this.environmentAtmosphere,
      this.environmentProps,
      this.wardenUnderlay,
      this.wardenSpriteLayer,
      this.actors,
      this.assetActors,
      this.tetherLayer,
      this.loopGraphics,
      this.capturedEchoLayer,
      this.effects,
    );
    stage.addChild(this.worldLayer, this.weather);
  }

  public render(state: PlaygroundRenderState): void {
    const visualState = state.reducedMotion
      ? { ...state, elapsed: 0 }
      : state;
    this.applySceneImpact(
      state.camera,
      state.closureEcho,
      state.reducedMotion,
    );
    this.drawEnvironment(visualState);
    this.drawEnvironmentAtmosphere(visualState);
    this.drawActors(visualState);
    this.drawLoop(visualState);
    this.updateCapturedEchoSprites(
      state.closureEcho,
      state.player,
      visualState.elapsed,
    );
    this.drawEffects(
      state.closureEcho,
      state.player,
      state.loopCutEcho,
      state.reducedFlash,
    );
    this.drawWeather(visualState);
  }

  private applySceneImpact(
    camera: Camera2DSnapshot,
    closureEcho: ClosureEchoView | null,
    reducedMotion: boolean,
  ): void {
    let offsetX = 0;
    let offsetY = 0;

    if (!reducedMotion && closureEcho !== null && closureEcho.captured > 0) {
      const progress = clamp01(
        closureEcho.age / PLAYGROUND_TUNING.closureDurationSeconds,
      );
      const captureScale = Math.min(1.35, 0.92 + closureEcho.captured * 0.09);
      const closureHit = 1 - smoothstep(0.04, 0.2, progress);
      const contractionHit = windowPulse(progress, 0.39, 0.61);
      const amplitude = (closureHit * 3.2 + contractionHit * 2.1) * captureScale;

      offsetX = Math.sin(progress * 139 + closureEcho.captured * 1.7) * amplitude;
      offsetY = Math.cos(progress * 173 + closureEcho.captured * 2.3) * amplitude * 0.72;
    }

    this.worldLayer.position.set(
      -camera.x + offsetX,
      -camera.y + offsetY,
    );

    // Rain stays in screen space so world impact never turns it into a second,
    // competing camera shake. Map lights travel with their world landmarks.
    this.weather.position.set(0, 0);
  }

  private async loadStartupAssetsSafely(): Promise<void> {
    const asphaltTile = await this.loadTextureSafely(
      ART_ASSET_URLS.asphaltTile,
    );
    const [background, carrier, drifter, tether, carrierWalk, drifterWalk] =
      await Promise.all([
      asphaltTile === null
        ? this.loadTextureSafely(ART_ASSET_URLS.background)
        : Promise.resolve(null),
      this.loadTextureSafely(ART_ASSET_URLS.carrier),
      this.loadTextureSafely(ART_ASSET_URLS.drifter),
      this.loadTextureSafely(ART_ASSET_URLS.tether),
      this.loadTextureSafely(ART_ASSET_URLS.carrierWalk),
      this.loadTextureSafely(ART_ASSET_URLS.drifterWalk),
    ]);

    this.backgroundTexture = background;
    this.asphaltTexture = asphaltTile;
    this.carrierTexture = carrier;
    this.drifterTexture = drifter;
    this.carrierWalkTextures = this.createWalkFrames(carrierWalk);
    this.enemyWalkTextures.drifter = this.createWalkFrames(drifterWalk);

    if (drifter !== null) {
      this.enemyTextures.drifter = drifter;
    }

    if (background !== null) {
      this.backgroundSprite.texture = background;
      this.backgroundSprite.visible = asphaltTile === null;
    }

    if (asphaltTile !== null) {
      this.asphaltTile.texture = asphaltTile;
      this.asphaltTile.tileScale.set(ASPHALT_TILE_SCALE);
      this.asphaltTile.visible = true;
      this.backgroundSprite.visible = false;
    }

    if (carrier !== null) {
      this.playerSprite.texture = carrier;
    }

    if (tether !== null) {
      try {
        this.tetherRope = new MeshRope({
          texture: tether,
          points: this.tetherRopePoints,
          textureScale: 1,
        });
        this.tetherRope.scale.set(TETHER_ROPE_SCALE);
        this.tetherRope.visible = false;
        this.tetherLayer.addChild(this.tetherRope);
      } catch {
        this.tetherRope = null;
      }
    }

    this.environmentWidth = -1;
    this.environmentHeight = -1;
  }

  private async loadDeferredAssetsSafely(): Promise<void> {
    const [
      armoredDrifter,
      rusher,
      watcher,
      cutter,
      mimic,
      eliteHusk,
      warden,
      armoredDrifterWalk,
      rusherWalk,
      watcherWalk,
      cutterWalk,
      mimicWalk,
      eliteHuskWalk,
    ] = await Promise.all([
        this.loadTextureSafely(ART_ASSET_URLS.armoredDrifter),
        this.loadTextureSafely(ART_ASSET_URLS.rusher),
        this.loadTextureSafely(ART_ASSET_URLS.watcher),
        this.loadTextureSafely(ART_ASSET_URLS.cutter),
        this.loadTextureSafely(ART_ASSET_URLS.mimic),
        this.loadTextureSafely(ART_ASSET_URLS.eliteHusk),
        this.loadTextureSafely(ART_ASSET_URLS.warden),
        this.loadTextureSafely(ART_ASSET_URLS.armoredDrifterWalk),
        this.loadTextureSafely(ART_ASSET_URLS.rusherWalk),
        this.loadTextureSafely(ART_ASSET_URLS.watcherWalk),
        this.loadTextureSafely(ART_ASSET_URLS.cutterWalk),
        this.loadTextureSafely(ART_ASSET_URLS.mimicWalk),
        this.loadTextureSafely(ART_ASSET_URLS.eliteHuskWalk),
      ]);

    this.armoredDrifterTexture = armoredDrifter;
    this.wardenTexture = warden;
    this.armoredDrifterWalkTextures =
      this.createWalkFrames(armoredDrifterWalk);
    this.enemyWalkTextures.rusher = this.createWalkFrames(rusherWalk);
    this.enemyWalkTextures.watcher = this.createWalkFrames(watcherWalk);
    this.enemyWalkTextures.cutter = this.createWalkFrames(cutterWalk);
    this.enemyWalkTextures.mimic = this.createWalkFrames(mimicWalk);
    this.enemyWalkTextures['elite-husk'] =
      this.createWalkFrames(eliteHuskWalk);

    if (rusher !== null) {
      this.enemyTextures.rusher = rusher;
    }
    if (watcher !== null) {
      this.enemyTextures.watcher = watcher;
    }
    if (cutter !== null) {
      this.enemyTextures.cutter = cutter;
    }
    if (mimic !== null) {
      this.enemyTextures.mimic = mimic;
    }
    if (eliteHusk !== null) {
      this.enemyTextures['elite-husk'] = eliteHusk;
    }
    if (warden !== null) {
      this.wardenSprite.texture = warden;
    }
  }

  private async loadTextureSafely(url: string): Promise<Texture | null> {
    try {
      return await Assets.load<Texture>(url);
    } catch {
      return null;
    }
  }

  private createWalkFrames(sheet: Texture | null): readonly Texture[] {
    if (sheet === null) {
      return Object.freeze([]);
    }

    const frameWidth = sheet.width / 2;
    const frameHeight = sheet.height / 2;
    return Object.freeze(
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].map(
        ([column, row], index) =>
          new Texture({
            source: sheet.source,
            label: `${sheet.label ?? 'walk'}-frame-${index}`,
            frame: new Rectangle(
              column! * frameWidth,
              row! * frameHeight,
              frameWidth,
              frameHeight,
            ),
          }),
      ),
    );
  }

  private drawEnvironment(state: PlaygroundRenderState): void {
    const width = state.worldBounds.maxX - state.worldBounds.minX;
    const height = state.worldBounds.maxY - state.worldBounds.minY;
    if (
      width === this.environmentWidth &&
      height === this.environmentHeight
    ) {
      return;
    }

    this.environmentWidth = width;
    this.environmentHeight = height;

    const graphics = this.environment.clear();
    const props = this.environmentProps.clear();
    const minX = state.worldBounds.minX;
    const minY = state.worldBounds.minY;

    if (this.asphaltTexture !== null) {
      this.asphaltTile.position.set(minX, minY);
      this.asphaltTile.setSize(width, height);
      this.asphaltTile.visible = true;
      this.backgroundSprite.visible = false;
      graphics.rect(minX, minY, width, height).fill({
        color: GAMEPLAY_COLORS.asphalt,
        alpha: 0.18,
      });
    } else if (this.backgroundTexture !== null) {
      const coverScale = Math.max(
        (width + 12) / this.backgroundTexture.width,
        (height + 12) / this.backgroundTexture.height,
      );
      this.asphaltTile.visible = false;
      this.backgroundSprite.visible = true;
      this.backgroundSprite.position.set(
        minX + width * 0.5,
        minY + height * 0.5,
      );
      this.backgroundSprite.scale.set(coverScale);
      graphics.rect(minX, minY, width, height).fill({
        color: GAMEPLAY_COLORS.void,
        alpha: 0.16,
      });
    } else {
      this.asphaltTile.visible = false;
      this.backgroundSprite.visible = false;
      graphics.rect(minX, minY, width, height).fill(GAMEPLAY_COLORS.void);
      graphics
        .rect(minX, minY, width, height)
        .fill({ color: GAMEPLAY_COLORS.asphalt, alpha: 0.98 });
    }

    const edge = WORLD_BARRIER_INSET + WORLD_BARRIER_DEPTH;

    this.drawAsphaltPatches(graphics, width, height, edge);
    this.drawPuddleBodies(graphics);
    this.drawRoadCracks(graphics, width, height, edge);
    this.drawCrossingMarks(graphics);
    this.drawEdgeBiomass(props);
    this.drawDistrictVents(props);
    this.drawBarricades(props, width, height);

    graphics
      .rect(minX, minY, width, height)
      .stroke({
        color: GAMEPLAY_COLORS.void,
        width: WORLD_BARRIER_DEPTH * 1.8,
        alpha: 0.82,
      });
  }

  private drawActors(state: PlaygroundRenderState): void {
    const graphics = this.actors.clear();
    const playerFacing = this.playerFacingAngle(state);
    let visibleEnemySpriteCount = 0;
    this.actorRenderFrame += 1;

    this.updateWardenBitmap(state.warden, state.elapsed);
    this.drawWarden(
      graphics,
      state.warden,
      state.wardenAttackEcho,
      state.elapsed,
      state.reducedFlash,
    );

    for (const enemy of state.enemies) {
      if (!enemy.alive) {
        continue;
      }
      this.drawEnemyTelegraph(graphics, enemy, state.elapsed);
      const walk = this.enemyWalkSample(enemy);
      const texture =
        this.enemyWalkTexturesFor(enemy)[walk.frame] ??
        this.enemyTextureFor(enemy);
      if (texture !== null) {
        this.drawDrifterSpriteUnderlay(graphics, enemy, walk);
        const sprite = this.ensureEnemySprite(visibleEnemySpriteCount);
        this.updateEnemySprite(
          sprite,
          texture,
          enemy,
          state.player,
          state.elapsed,
          walk,
        );
        visibleEnemySpriteCount += 1;
      } else {
        this.drawDrifter(graphics, enemy, state.player, state.elapsed);
      }
    }

    for (const [id, walkState] of this.enemyWalkStates) {
      if (walkState.lastSeenFrame !== this.actorRenderFrame) {
        this.enemyWalkStates.delete(id);
      }
    }

    this.drawProjectiles(graphics, state.projectiles, state.elapsed);

    for (
      let index = visibleEnemySpriteCount;
      index < this.enemySprites.length;
      index += 1
    ) {
      this.enemySprites[index]!.visible = false;
    }

    if (this.carrierTexture !== null) {
      this.drawCarrierSpriteUnderlay(graphics, state.player);
      this.updateCarrierSprite(state, playerFacing);
    } else {
      this.playerSprite.visible = false;
      this.drawCarrier(graphics, state);
    }

    if (state.playerInvulnerability > 0) {
      const hitPulse = state.reducedFlash
        ? 0.28
        : 0.45 + Math.sin(state.elapsed * 34) * 0.2;
      graphics
        .circle(
          state.player.x,
          state.player.y,
          PLAYGROUND_TUNING.playerRadius * 2.15,
        )
        .stroke({
          color: GAMEPLAY_COLORS.arterialBright,
          width: 3,
          alpha: hitPulse,
        });
    }
  }

  private updateWardenBitmap(
    warden: WardenSnapshot | null,
    elapsed: number,
  ): void {
    const underlay = this.wardenUnderlay.clear();
    this.wardenSpriteMask.clear();

    if (warden === null || this.wardenTexture === null) {
      this.wardenSprite.visible = false;
      return;
    }

    const arrivalProgress =
      warden.stage === 'arrival'
        ? Math.min(
            1,
            warden.stageProgress.completed /
              Math.max(0.001, warden.stageProgress.required),
          )
        : 1;
    const collapseScale =
      warden.stage === 'defeated'
        ? 0.38 + (warden.collapseRemaining / 1.4) * 0.62
        : 1;
    const alpha =
      warden.stage === 'defeated'
        ? Math.max(0.16, warden.collapseRemaining / 1.4)
        : 0.35 + arrivalProgress * 0.65;
    const bodyRadius = 58 * Math.max(0.35, arrivalProgress) * collapseScale;
    const pulse = 1 + Math.sin(elapsed * 3.2 + warden.phase) * 0.025;

    underlay
      .ellipse(
        warden.center.x,
        warden.center.y + bodyRadius * 0.76,
        bodyRadius * 1.55,
        bodyRadius * 0.58,
      )
      .fill({ color: GAMEPLAY_COLORS.void, alpha: alpha * 0.72 });
    underlay
      .circle(warden.center.x, warden.center.y, bodyRadius * 1.48)
      .fill({
        color:
          warden.stage === 'core'
            ? GAMEPLAY_COLORS.arterial
            : GAMEPLAY_COLORS.hostileCyan,
        alpha: alpha * 0.055,
      });

    // The source render includes wide claws. The mask keeps its dense central
    // anatomy while procedural objective arms remain the authoritative targets.
    this.wardenSpriteMask
      .ellipse(
        warden.center.x,
        warden.center.y - bodyRadius * 0.04,
        bodyRadius * 1.46,
        bodyRadius * 1.18,
      )
      .fill(0xffffff);

    const baseScale =
      (bodyRadius * 3.55) / this.wardenTexture.width;
    this.wardenSprite.texture = this.wardenTexture;
    this.wardenSprite.position.set(warden.center.x, warden.center.y);
    this.wardenSprite.rotation = Math.sin(elapsed * 1.7 + warden.phase) * 0.008;
    this.wardenSprite.scale.set(baseScale * pulse);
    this.wardenSprite.alpha = alpha * 0.96;
    this.wardenSprite.tint =
      warden.stage === 'defeated'
        ? 0xb9655e
        : warden.stage === 'core'
          ? 0xffc6b5
          : warden.stage === 'arrival'
            ? 0xabb5b4
            : 0xffffff;
    this.wardenSprite.visible = true;
  }

  private drawWarden(
    graphics: Graphics,
    warden: WardenSnapshot | null,
    attackEcho: WardenAttackEchoView | null,
    elapsed: number,
    reducedFlash: boolean,
  ): void {
    if (warden === null) {
      return;
    }

    const arrivalProgress =
      warden.stage === 'arrival'
        ? Math.min(
            1,
            warden.stageProgress.completed /
              Math.max(0.001, warden.stageProgress.required),
          )
        : 1;
    const collapseScale =
      warden.stage === 'defeated'
        ? 0.38 + (warden.collapseRemaining / 1.4) * 0.62
        : 1;
    const alpha =
      warden.stage === 'defeated'
        ? Math.max(0.16, warden.collapseRemaining / 1.4)
        : 0.35 + arrivalProgress * 0.65;
    const bodyRadius = 58 * Math.max(0.35, arrivalProgress) * collapseScale;
    const pulse = 1 + Math.sin(elapsed * 3.2 + warden.phase) * 0.045;
    const lockedLashStart =
      attackEcho?.kind === 'lash' &&
      attackEcho.geometry.kind === 'corridor' &&
      warden.attack?.state === 'recovery'
        ? attackEcho.geometry.start
        : null;
    const lockedLashArmId =
      lockedLashStart === null ? null : warden.attack?.sourceObjectiveId;
    const usingBitmap =
      this.wardenTexture !== null && this.wardenSprite.visible;

    for (const arm of warden.armTargets) {
      if (arm.severed || warden.stage === 'arrival') {
        continue;
      }
      const armPosition =
        arm.id === lockedLashArmId && lockedLashStart !== null
          ? lockedLashStart
          : arm.position;
      const mid = {
        x:
          (warden.center.x + armPosition.x) * 0.5 +
          (arm.index === 0 ? -18 : 18),
        y: (warden.center.y + armPosition.y) * 0.5 - 12,
      };
      graphics
        .moveTo(warden.center.x, warden.center.y)
        .quadraticCurveTo(mid.x, mid.y, armPosition.x, armPosition.y)
        .stroke({ color: GAMEPLAY_COLORS.void, width: 22, alpha: alpha * 0.9 });
      graphics
        .moveTo(warden.center.x, warden.center.y)
        .quadraticCurveTo(mid.x, mid.y, armPosition.x, armPosition.y)
        .stroke({
          color: GAMEPLAY_COLORS.arterial,
          width: 10,
          alpha: alpha * 0.78,
        });
      graphics
        .circle(armPosition.x, armPosition.y, arm.radius * 1.12)
        .fill({ color: GAMEPLAY_COLORS.void, alpha: alpha * 0.92 })
        .stroke({
          color: GAMEPLAY_COLORS.bone,
          width: 4,
          alpha: alpha * 0.86,
        });
      const angle = Math.atan2(
        armPosition.y - warden.center.y,
        armPosition.x - warden.center.x,
      );
      for (const offset of [-0.34, 0, 0.34]) {
        this.drawShard(
          graphics,
          armPosition,
          angle + offset,
          arm.radius * 1.45,
          4.5,
          GAMEPLAY_COLORS.bone,
          alpha * 0.9,
        );
      }
    }

    if (usingBitmap) {
      graphics
        .circle(warden.center.x, warden.center.y, bodyRadius * pulse)
        .stroke({
          color: GAMEPLAY_COLORS.arterial,
          width: 4,
          alpha: alpha * 0.42,
        });
    } else {
      graphics
        .circle(warden.center.x, warden.center.y, bodyRadius * 1.18)
        .fill({ color: GAMEPLAY_COLORS.void, alpha: alpha * 0.92 });
      graphics
        .circle(warden.center.x, warden.center.y, bodyRadius * pulse)
        .fill({ color: 0x171014, alpha })
        .stroke({
          color: GAMEPLAY_COLORS.arterial,
          width: 8,
          alpha: alpha * 0.7,
        });
    }

    for (const plate of warden.shellPlates) {
      if (warden.stage === 'arrival') {
        continue;
      }
      const side = plate.index === 0 ? -1 : 1;
      const plateX = warden.center.x + side * bodyRadius * 0.52;
      if (!plate.intact) {
        if (usingBitmap) {
          graphics
            .ellipse(
              plateX,
              warden.center.y,
              bodyRadius * 0.42,
              bodyRadius * 0.75,
            )
            .fill({ color: GAMEPLAY_COLORS.void, alpha: alpha * 0.58 })
            .stroke({
              color: GAMEPLAY_COLORS.arterial,
              width: 5,
              alpha: alpha * 0.52,
            });
          for (let scarIndex = -1; scarIndex <= 1; scarIndex += 1) {
            graphics
              .moveTo(plateX, warden.center.y + scarIndex * bodyRadius * 0.3)
              .lineTo(
                plateX + side * bodyRadius * 0.34,
                warden.center.y + scarIndex * bodyRadius * 0.22,
              )
              .stroke({
                color: GAMEPLAY_COLORS.arterialBright,
                width: 1.5,
                alpha: alpha * 0.42,
              });
          }
        }
        continue;
      }
      graphics
        .ellipse(
          plateX,
          warden.center.y,
          bodyRadius * 0.46,
          bodyRadius * 0.82,
        )
        .stroke({
          color: GAMEPLAY_COLORS.bone,
          width: 9,
          alpha: alpha * 0.72,
        });
    }

    if (warden.stage === 'core' || warden.stage === 'defeated') {
      const corePulse = 0.82 + Math.sin(elapsed * 9) * 0.18;
      graphics
        .circle(
          warden.core.position.x,
          warden.core.position.y,
          Math.max(5, warden.core.radius * corePulse),
        )
        .fill({
          color: GAMEPLAY_COLORS.arterialBright,
          alpha: alpha * 0.9,
        });
      const activeNodes = warden.controlNodes.filter((node) => node.active);
      if (activeNodes.length === 2) {
        graphics
          .moveTo(activeNodes[0]!.position.x, activeNodes[0]!.position.y)
          .lineTo(warden.core.position.x, warden.core.position.y)
          .lineTo(activeNodes[1]!.position.x, activeNodes[1]!.position.y)
          .closePath()
          .stroke({
            color: GAMEPLAY_COLORS.hostileCyan,
            width: 2,
            alpha: alpha * 0.5,
          });
      }
      for (const node of activeNodes) {
        graphics
          .circle(
            node.position.x,
            node.position.y,
            node.radius * corePulse,
          )
          .fill({
            color: GAMEPLAY_COLORS.hostileCyan,
            alpha: alpha * 0.78,
          })
          .stroke({
            color: GAMEPLAY_COLORS.bone,
            width: 2,
            alpha: alpha * 0.82,
          });
      }
    }

    const attack = warden.attack;
    if (attack?.state === 'telegraph' && attack.lockedGeometry !== null) {
      const telegraphPulse = 0.42 + Math.sin(elapsed * 18) * 0.24;
      const geometry = attack.lockedGeometry;
      if (geometry.kind === 'corridor') {
        graphics
          .moveTo(geometry.start.x, geometry.start.y)
          .lineTo(geometry.end.x, geometry.end.y)
          .stroke({
            color: GAMEPLAY_COLORS.amber,
            width: geometry.halfWidth * 2,
            alpha: telegraphPulse * 0.28,
          });
        graphics
          .moveTo(geometry.start.x, geometry.start.y)
          .lineTo(geometry.end.x, geometry.end.y)
          .stroke({
            color: GAMEPLAY_COLORS.bone,
            width: 2,
            alpha: telegraphPulse * 0.9,
          });
      } else {
        graphics
          .circle(geometry.center.x, geometry.center.y, geometry.radius)
          .stroke({
            color: GAMEPLAY_COLORS.amber,
            width: geometry.halfWidth * 2,
            alpha: telegraphPulse * 0.34,
          });
      }
    }

    if (attackEcho !== null && attackEcho.age < 0.32) {
      const progress = Math.min(1, attackEcho.age / 0.32);
      const strike = 1 - progress;
      const flashScale = reducedFlash ? 0.32 : 1;
      const geometry = attackEcho.geometry;
      if (attackEcho.kind === 'lash' && geometry.kind === 'corridor') {
        const flash = Math.max(0, 1 - progress * 1.65) * flashScale;
        graphics
          .moveTo(geometry.start.x, geometry.start.y)
          .lineTo(geometry.end.x, geometry.end.y)
          .stroke({
            color: GAMEPLAY_COLORS.void,
            width: geometry.halfWidth * 2.8,
            alpha: strike * 0.88,
          });
        graphics
          .moveTo(geometry.start.x, geometry.start.y)
          .lineTo(geometry.end.x, geometry.end.y)
          .stroke({
            color: GAMEPLAY_COLORS.arterialBright,
            width: Math.max(5, geometry.halfWidth * (1.25 + flash)),
            alpha: strike * (reducedFlash ? 0.52 : 0.9),
          });
        graphics
          .moveTo(geometry.start.x, geometry.start.y)
          .lineTo(geometry.end.x, geometry.end.y)
          .stroke({
            color: GAMEPLAY_COLORS.bone,
            width: Math.max(1.5, geometry.halfWidth * 0.16),
            alpha: Math.min(
              reducedFlash ? 0.42 : 1,
              flash + strike * (reducedFlash ? 0.24 : 0.42),
            ),
          });
        const angle = Math.atan2(
          geometry.end.y - geometry.start.y,
          geometry.end.x - geometry.start.x,
        );
        const front = lerpVec2(
          geometry.start,
          geometry.end,
          Math.min(1, progress * 3.4),
        );
        this.drawShard(
          graphics,
          front,
          angle,
          28 + flash * 22,
          8 + flash * 4,
          GAMEPLAY_COLORS.bone,
          strike * (reducedFlash ? 0.48 : 1),
        );
      } else if (
        attackEcho.kind === 'discharge' &&
        geometry.kind === 'ring'
      ) {
        const ringFlash = Math.max(0, 1 - progress * 2.1) * flashScale;
        for (let index = 0; index < 3; index += 1) {
          const offset = (index - 1) * (5 + progress * 16);
          graphics
            .circle(
              geometry.center.x,
              geometry.center.y,
              Math.max(1, geometry.radius + offset),
            )
            .stroke({
              color:
                index === 1
                  ? GAMEPLAY_COLORS.arterialBright
                  : GAMEPLAY_COLORS.bone,
              width:
                index === 1
                  ? geometry.halfWidth * (1.5 + ringFlash)
                  : Math.max(1, geometry.halfWidth * 0.18),
              alpha:
                strike *
                (index === 1
                  ? reducedFlash
                    ? 0.42
                    : 0.72
                  : reducedFlash
                    ? 0.28
                    : 0.48),
            });
        }
      }
    }
  }

  private ensureEnemySprite(index: number): Sprite {
    const existing = this.enemySprites[index];
    if (existing !== undefined) {
      return existing;
    }

    const sprite = new Sprite(Texture.EMPTY);
    sprite.anchor.set(0.5, 0.44);
    sprite.visible = false;
    this.enemySprites.push(sprite);
    this.enemySpriteLayer.addChild(sprite);
    return sprite;
  }

  private updateEnemySprite(
    sprite: Sprite,
    texture: Texture,
    enemy: PlaygroundEnemyView,
    player: Vec2,
    elapsed: number,
    walk: WalkCycleSample,
  ): void {
    const staggerStrength = Math.min(
      1,
      Math.max(0, (enemy.staggerRemaining ?? 0) / 0.8),
    );
    const staggerTwitch =
      Math.sin(elapsed * 47 + enemy.phase * 5.1) * 0.075 * staggerStrength;
    const locomotionRoll = walk.moving ? walk.passing * 0.038 : 0;
    const twitch =
      Math.sin(elapsed * 3.7 + enemy.phase * 1.9) * 0.012 +
      locomotionRoll +
      staggerTwitch;
    const angle =
      enemy.archetype === 'drifter'
        ? Math.atan2(
            player.y - enemy.position.y,
            player.x - enemy.position.x,
          )
        : Math.atan2(enemy.facing.y, enemy.facing.x);
    const breath = Math.sin(elapsed * 2.2 + enemy.phase) * 0.022;
    const hasDedicatedTexture =
      this.enemyTextures[enemy.archetype] === texture ||
      this.armoredDrifterTexture === texture;
    const tuning = hasDedicatedTexture
      ? ENEMY_SPRITE_TUNING[enemy.archetype]
      : DRIFTER_FALLBACK_TUNING[enemy.archetype];
    const baseScale =
      (enemy.radius * tuning.heightInRadii) / texture.height;

    sprite.texture = texture;
    sprite.anchor.set(0.5, tuning.anchorY);
    sprite.position.set(
      enemy.position.x -
        enemy.facing.y * (staggerTwitch * 16 + walk.contact * 0.8),
      enemy.position.y +
        enemy.facing.x * staggerTwitch * 16 -
        Math.abs(walk.passing) * 1.1,
    );
    sprite.rotation = angle + Math.PI * 0.5 + twitch;
    sprite.scale.set(
      baseScale *
        tuning.scaleX *
        (1 - breath * 0.24 + Math.abs(walk.passing) * 0.018 + staggerStrength * 0.04),
      baseScale *
        tuning.scaleY *
        (1 + breath * 0.5 - Math.abs(walk.passing) * 0.028 - staggerStrength * 0.06),
    );
    sprite.alpha = 0.98;
    sprite.tint =
      enemy.captureProfile === 'armored' && enemy.armored === false
        ? 0xff806c
        : hasDedicatedTexture
          ? this.productionEnemyTint(enemy.archetype, enemy.behaviorState)
          : this.drifterFallbackTint(enemy.archetype, enemy.behaviorState);
    sprite.visible = true;
  }

  private enemyWalkTexturesFor(
    enemy: PlaygroundEnemyView,
  ): readonly Texture[] {
    if (
      enemy.archetype === 'drifter' &&
      enemy.captureProfile === 'armored' &&
      enemy.armored === true &&
      this.armoredDrifterWalkTextures.length > 0
    ) {
      return this.armoredDrifterWalkTextures;
    }
    return this.enemyWalkTextures[enemy.archetype] ?? EMPTY_WALK_TEXTURES;
  }

  private enemyWalkSample(enemy: PlaygroundEnemyView): WalkCycleSample {
    const previous = this.enemyWalkStates.get(enemy.id);
    const displacement =
      previous === undefined
        ? 0
        : Math.hypot(
            enemy.position.x - previous.x,
            enemy.position.y - previous.y,
          );
    const speed = Math.hypot(enemy.velocity.x, enemy.velocity.y);
    const tuning = WALK_CYCLE_TUNING[enemy.archetype];
    const distance = advanceWalkDistance(
      previous?.distance ?? enemy.phase * tuning.distancePerFrame * 4,
      displacement,
      1,
      0.02,
    );
    this.enemyWalkStates.set(enemy.id, {
      x: enemy.position.x,
      y: enemy.position.y,
      distance,
      lastSeenFrame: this.actorRenderFrame,
    });
    return sampleWalkCycle(distance, speed, tuning);
  }

  private enemyTextureFor(enemy: PlaygroundEnemyView): Texture | null {
    if (
      enemy.archetype === 'drifter' &&
      enemy.captureProfile === 'armored' &&
      enemy.armored === true &&
      this.armoredDrifterTexture !== null
    ) {
      return this.armoredDrifterTexture;
    }
    return this.enemyTextures[enemy.archetype] ?? this.drifterTexture;
  }

  private productionEnemyTint(
    archetype: FullRunEnemyArchetype,
    behaviorState: string,
  ): number {
    if (archetype === 'rusher') {
      return 0xffeee6;
    }
    if (archetype === 'watcher') {
      return 0xe6ffff;
    }
    if (archetype === 'cutter') {
      return 0xffe9e2;
    }
    if (archetype === 'mimic') {
      return 0xeaffff;
    }
    if (archetype === 'elite-husk') {
      return behaviorState === 'exposed' ? 0xff917b : 0xfff2dc;
    }
    return 0xffffff;
  }

  private drifterFallbackTint(
    archetype: FullRunEnemyArchetype,
    behaviorState: string,
  ): number {
    if (archetype === 'rusher') {
      return 0xff9a83;
    }
    if (archetype === 'watcher') {
      return 0x77d6d2;
    }
    if (archetype === 'cutter') {
      return 0xff6b62;
    }
    if (archetype === 'mimic') {
      return 0xb7ffff;
    }
    if (archetype === 'elite-husk') {
      return behaviorState === 'exposed' ? 0xff775f : 0xc6b79e;
    }
    return 0xffffff;
  }

  private drawEnemyTelegraph(
    graphics: Graphics,
    enemy: PlaygroundEnemyView,
    elapsed: number,
  ): void {
    const facingAngle = Math.atan2(enemy.facing.y, enemy.facing.x);

    if (enemy.archetype === 'drifter' && enemy.captureProfile === 'armored') {
      const armored = enemy.armored === true;
      const pulse =
        1 + Math.sin(elapsed * (armored ? 3.8 : 10.5) + enemy.phase) * 0.07;

      if (armored) {
        graphics
          .circle(enemy.position.x, enemy.position.y, enemy.radius * 1.04 * pulse)
          .stroke({
            color: GAMEPLAY_COLORS.bone,
            width: this.armoredDrifterTexture === null ? 4.5 : 1.6,
            alpha: this.armoredDrifterTexture === null ? 0.68 : 0.34,
          });
        if (this.armoredDrifterTexture === null) {
          for (let index = 0; index < 6; index += 1) {
            const angle = enemy.phase + (index / 6) * Math.PI * 2;
            const base = {
              x: enemy.position.x + Math.cos(angle) * enemy.radius * 0.82,
              y: enemy.position.y + Math.sin(angle) * enemy.radius * 0.82,
            };
            this.drawShard(
              graphics,
              base,
              angle + Math.PI * 0.5,
              enemy.radius * 0.72,
              enemy.radius * 0.24,
              GAMEPLAY_COLORS.bone,
              0.88,
            );
          }
        }
      } else {
        graphics
          .circle(
            enemy.position.x,
            enemy.position.y,
            enemy.radius * 0.72 * pulse,
          )
          .stroke({
            color: GAMEPLAY_COLORS.arterialBright,
            width: enemy.behaviorState === 'staggered' ? 4 : 2.4,
            alpha: enemy.behaviorState === 'staggered' ? 0.92 : 0.64,
          });
        graphics
          .circle(enemy.position.x, enemy.position.y, enemy.radius * 0.22)
          .fill({
            color: GAMEPLAY_COLORS.arterialBright,
            alpha: 0.58,
          });
      }
      return;
    }

    if (enemy.archetype === 'rusher') {
      const hornBase = {
        x: enemy.position.x + enemy.facing.x * enemy.radius * 0.8,
        y: enemy.position.y + enemy.facing.y * enemy.radius * 0.8,
      };
      this.drawShard(
        graphics,
        hornBase,
        facingAngle - 0.24,
        enemy.radius * 1.25,
        enemy.radius * 0.22,
        GAMEPLAY_COLORS.bone,
        0.82,
      );
      this.drawShard(
        graphics,
        hornBase,
        facingAngle + 0.24,
        enemy.radius * 1.05,
        enemy.radius * 0.2,
        GAMEPLAY_COLORS.bone,
        0.68,
      );

      if (enemy.behaviorState === 'telegraph' && enemy.lockedTarget !== null) {
        const pulse = 0.45 + Math.sin(elapsed * 18) * 0.25;
        graphics
          .moveTo(enemy.position.x, enemy.position.y)
          .lineTo(enemy.lockedTarget.x, enemy.lockedTarget.y)
          .stroke({
            color: GAMEPLAY_COLORS.arterialBright,
            width: 2.2,
            alpha: pulse,
          });
        graphics
          .circle(enemy.position.x, enemy.position.y, enemy.radius * 1.75)
          .stroke({
            color: GAMEPLAY_COLORS.amber,
            width: 2,
            alpha: pulse,
          });
      }
      return;
    }

    if (enemy.archetype === 'cutter') {
      const pulse = 0.56 + Math.sin(elapsed * 22 + enemy.phase) * 0.3;
      const jawOffset = enemy.radius * 0.72;
      for (const side of [-1, 1]) {
        const base = {
          x:
            enemy.position.x +
            enemy.facing.x * enemy.radius * 0.45 -
            enemy.facing.y * jawOffset * side,
          y:
            enemy.position.y +
            enemy.facing.y * enemy.radius * 0.45 +
            enemy.facing.x * jawOffset * side,
        };
        this.drawShard(
          graphics,
          base,
          facingAngle + side * 0.18,
          enemy.radius * 1.18,
          enemy.radius * 0.18,
          GAMEPLAY_COLORS.bone,
          0.9,
        );
      }

      if (enemy.behaviorState === 'telegraph' && enemy.lockedTarget !== null) {
        graphics
          .moveTo(enemy.position.x, enemy.position.y)
          .lineTo(enemy.lockedTarget.x, enemy.lockedTarget.y)
          .stroke({
            color: GAMEPLAY_COLORS.arterialBright,
            width: 3.2,
            alpha: pulse,
          });
        graphics.circle(enemy.lockedTarget.x, enemy.lockedTarget.y, 13).stroke({
          color: GAMEPLAY_COLORS.bone,
          width: 2,
          alpha: pulse,
        });
      } else if (enemy.behaviorState === 'dash') {
        graphics
          .moveTo(
            enemy.position.x - enemy.facing.x * enemy.radius * 2.8,
            enemy.position.y - enemy.facing.y * enemy.radius * 2.8,
          )
          .lineTo(enemy.position.x, enemy.position.y)
          .stroke({
            color: GAMEPLAY_COLORS.arterialBright,
            width: 5,
            alpha: 0.72,
          });
      }
      return;
    }

    if (enemy.archetype === 'mimic') {
      const pulse = 0.76 + Math.sin(elapsed * 8 + enemy.phase) * 0.16;
      const normal = { x: -enemy.facing.y, y: enemy.facing.x };
      for (const side of [-1, 1]) {
        const x = enemy.position.x + normal.x * enemy.radius * 0.72 * side;
        const y = enemy.position.y + normal.y * enemy.radius * 0.72 * side;
        graphics.circle(x, y, enemy.radius * 0.38 * pulse).stroke({
          color: side < 0 ? GAMEPLAY_COLORS.bone : GAMEPLAY_COLORS.hostileCyan,
          width: 2,
          alpha: 0.68,
        });
      }
      graphics
        .moveTo(
          enemy.position.x - enemy.facing.x * enemy.radius * 2,
          enemy.position.y - enemy.facing.y * enemy.radius * 2,
        )
        .lineTo(enemy.position.x, enemy.position.y)
        .stroke({
          color: GAMEPLAY_COLORS.hostileCyan,
          width: 2,
          alpha: 0.22,
        });
      return;
    }

    if (enemy.archetype === 'elite-husk') {
      const exposed = enemy.behaviorState === 'exposed';
      const pulse = 1 + Math.sin(elapsed * (exposed ? 11 : 3) + enemy.phase) * 0.08;
      graphics
        .circle(enemy.position.x, enemy.position.y, enemy.radius * 1.18 * pulse)
        .stroke({
          color: exposed ? GAMEPLAY_COLORS.arterialBright : GAMEPLAY_COLORS.bone,
          width: exposed ? 4 : 7,
          alpha: exposed ? 0.86 : 0.58,
        });
      graphics
        .circle(enemy.position.x, enemy.position.y, enemy.radius * 0.52)
        .fill({
          color: exposed ? GAMEPLAY_COLORS.arterialBright : GAMEPLAY_COLORS.void,
          alpha: exposed ? 0.68 : 0.72,
        });
      return;
    }

    if (enemy.archetype === 'watcher') {
      const pulse = 1 + Math.sin(elapsed * 5 + enemy.phase) * 0.08;
      graphics
        .circle(
          enemy.position.x,
          enemy.position.y,
          enemy.radius * 1.48 * pulse,
        )
        .stroke({
          color: GAMEPLAY_COLORS.hostileCyan,
          width: 1.4,
          alpha: 0.52,
        });
      graphics
        .circle(enemy.position.x, enemy.position.y, enemy.radius * 0.24)
        .fill({ color: 0xd5ffff, alpha: 0.88 });

      if (enemy.behaviorState === 'locking' && enemy.lockedTarget !== null) {
        graphics
          .moveTo(enemy.position.x, enemy.position.y)
          .lineTo(enemy.lockedTarget.x, enemy.lockedTarget.y)
          .stroke({
            color: GAMEPLAY_COLORS.hostileCyan,
            width: 1.5,
            alpha: 0.72,
          });
        graphics
          .circle(enemy.lockedTarget.x, enemy.lockedTarget.y, 11 * pulse)
          .stroke({
            color: 0xd5ffff,
            width: 1.5,
            alpha: 0.62,
          });
      }
    }
  }

  private drawProjectiles(
    graphics: Graphics,
    projectiles: readonly PlaygroundProjectileView[],
    elapsed: number,
  ): void {
    const pulse = 0.82 + Math.sin(elapsed * 16) * 0.18;

    for (const projectile of projectiles) {
      if (!projectile.alive) {
        continue;
      }

      const speed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
      const directionX = speed > 0 ? projectile.velocity.x / speed : 0;
      const directionY = speed > 0 ? projectile.velocity.y / speed : 0;
      const tailLength = 18;

      graphics
        .moveTo(
          projectile.position.x - directionX * tailLength,
          projectile.position.y - directionY * tailLength,
        )
        .lineTo(projectile.position.x, projectile.position.y)
        .stroke({ color: 0x4ea7a8, width: 3, alpha: 0.42 });
      graphics
        .circle(
          projectile.position.x,
          projectile.position.y,
          projectile.radius * 2.25,
        )
        .fill({ color: 0x4ea7a8, alpha: 0.12 * pulse });
      graphics
        .circle(
          projectile.position.x,
          projectile.position.y,
          projectile.radius,
        )
        .fill({ color: 0xd5ffff, alpha: 0.92 });
    }
  }

  private updateCarrierSprite(
    state: PlaygroundRenderState,
    facingAngle: number,
  ): void {
    if (this.carrierTexture === null) {
      this.playerSprite.visible = false;
      return;
    }

    const speed = Math.hypot(state.playerVelocity.x, state.playerVelocity.y);
    const movement = Math.min(1, speed / 210);
    const displacement =
      Number.isFinite(this.carrierWalkX) && Number.isFinite(this.carrierWalkY)
        ? Math.hypot(
            state.player.x - this.carrierWalkX,
            state.player.y - this.carrierWalkY,
          )
        : 0;
    this.carrierWalkDistance = advanceWalkDistance(
      this.carrierWalkDistance,
      displacement,
      1,
      0.02,
    );
    this.carrierWalkX = state.player.x;
    this.carrierWalkY = state.player.y;
    const walk = sampleWalkCycle(
      this.carrierWalkDistance,
      speed,
      WALK_CYCLE_TUNING.carrier,
    );
    const breath = Math.sin(state.elapsed * 2.2) * 0.008;
    const loopTension = Math.min(1, state.loopSamples.length / 18);
    const captureKick =
      state.closureEcho === null || state.closureEcho.captured <= 0
        ? 0
        : (1 -
            smoothstep(
              0.03,
              0.22,
              state.closureEcho.age /
                PLAYGROUND_TUNING.closureDurationSeconds,
            )) *
          0.12;
    const activeTexture =
      this.carrierWalkTextures[walk.frame] ?? this.carrierTexture;
    const baseScale =
      (PLAYGROUND_TUNING.playerRadius * 5.7) / activeTexture.height;
    this.playerSprite.texture = activeTexture;
    this.playerSprite.position.set(
      state.player.x - Math.sin(facingAngle) * walk.contact * movement * 1.4,
      state.player.y +
        Math.cos(facingAngle) * walk.contact * movement * 1.4 -
        Math.abs(walk.passing) * 1.2,
    );
    this.playerSprite.rotation =
      facingAngle + Math.PI * 0.5 + walk.passing * movement * 0.032;
    this.playerSprite.scale.set(
      baseScale *
        (1 - breath * 0.3 + Math.abs(walk.passing) * 0.016 + captureKick),
      baseScale *
        (1 + breath * 0.5 - Math.abs(walk.passing) * 0.026 - captureKick * 0.5 + loopTension * 0.025),
    );
    this.playerSprite.alpha = 1;
    this.playerSprite.tint =
      state.playerInvulnerability <= 0
        ? 0xffffff
        : state.reducedFlash
          ? 0xffaaa2
          : Math.sin(state.elapsed * 34) > 0
            ? 0xff6f62
            : 0xffffff;
    this.playerSprite.visible = true;
  }

  private drawDrifterSpriteUnderlay(
    graphics: Graphics,
    enemy: PlaygroundEnemyView,
    walk: WalkCycleSample,
  ): void {
    graphics
      .ellipse(
        enemy.position.x - enemy.facing.y * walk.contact * enemy.radius * 0.08,
        enemy.position.y + enemy.radius * (0.68 + Math.abs(walk.passing) * 0.05),
        enemy.radius * (1.22 + Math.abs(walk.contact) * 0.16),
        enemy.radius * (0.42 + Math.abs(walk.passing) * 0.08),
      )
      .fill({ color: GAMEPLAY_COLORS.void, alpha: 0.58 });
    graphics.circle(
      enemy.position.x,
      enemy.position.y,
      enemy.radius * 1.46,
    ).fill({
      color:
        enemy.archetype === 'rusher'
          ? GAMEPLAY_COLORS.arterial
          : GAMEPLAY_COLORS.hostileCyan,
      alpha: 0.035,
    });
  }

  private drawCarrierSpriteUnderlay(
    graphics: Graphics,
    player: Vec2,
  ): void {
    const radius = PLAYGROUND_TUNING.playerRadius;
    graphics
      .ellipse(
        player.x,
        player.y + radius * 0.78,
        radius * 1.62,
        radius * 0.6,
      )
      .fill({ color: GAMEPLAY_COLORS.void, alpha: 0.7 });
    graphics.circle(player.x, player.y, radius * 1.85).fill({
      color: GAMEPLAY_COLORS.arterial,
      alpha: 0.035,
    });
  }

  private updateCapturedEchoSprites(
    closureEcho: ClosureEchoView | null,
    player: Vec2,
    elapsed: number,
  ): void {
    if (
      closureEcho === null ||
      closureEcho.captured <= 0 ||
      this.drifterTexture === null
    ) {
      this.hideCapturedEchoSprites();
      return;
    }

    const progress = clamp01(
      closureEcho.age / PLAYGROUND_TUNING.closureDurationSeconds,
    );
    const rasterAlpha =
      1 -
      smoothstep(
        CAPTURE_RASTER_HOLD_END,
        CAPTURE_RASTER_FADE_END,
        progress,
      );
    if (rasterAlpha <= 0) {
      this.hideCapturedEchoSprites();
      return;
    }

    closureEcho.capturedEnemies.forEach((enemy, index) => {
      const sprite = this.ensureCapturedEchoSprite(index);
      if (enemy.captureLayer === 'peeled') {
        sprite.visible = false;
        return;
      }
      const angle = Math.atan2(
        player.y - enemy.position.y,
        player.x - enemy.position.x,
      );
      const twitch = Math.sin(elapsed * 3.7 + enemy.phase * 1.9) * 0.025;
      const breath = Math.sin(elapsed * 2.2 + enemy.phase) * 0.022;
      const baseScale = (enemy.radius * 4.7) / this.drifterTexture!.height;
      const layerScale = enemy.captureLayer === 'killed' ? 0.84 : 1;

      sprite.texture = this.drifterTexture!;
      sprite.position.set(enemy.position.x, enemy.position.y);
      sprite.rotation = angle + Math.PI * 0.5 + twitch;
      sprite.scale.set(
        baseScale * layerScale * (1 - breath * 0.45),
        baseScale * layerScale * (1 + breath),
      );
      sprite.alpha = rasterAlpha * 0.98;
      sprite.tint =
        enemy.archetype === 'rusher'
          ? 0xff9a83
          : enemy.archetype === 'watcher'
            ? 0x77d6d2
            : enemy.archetype === 'cutter'
              ? 0xff6b62
              : enemy.archetype === 'mimic'
                ? 0xb7ffff
                : enemy.archetype === 'elite-husk'
                  ? enemy.captureLayer === 'killed'
                    ? 0xff6f5e
                    : 0xc6b79e
                  : enemy.captureProfile === 'armored'
                    ? 0xff806c
                    : 0xffffff;
      sprite.visible = true;
    });

    for (
      let index = closureEcho.capturedEnemies.length;
      index < this.capturedEchoSprites.length;
      index += 1
    ) {
      this.capturedEchoSprites[index]!.visible = false;
    }
  }

  private ensureCapturedEchoSprite(index: number): Sprite {
    const existing = this.capturedEchoSprites[index];
    if (existing !== undefined) {
      return existing;
    }

    const sprite = new Sprite(this.drifterTexture ?? Texture.EMPTY);
    sprite.anchor.set(0.5, 0.44);
    sprite.visible = false;
    this.capturedEchoSprites.push(sprite);
    this.capturedEchoLayer.addChild(sprite);
    return sprite;
  }

  private hideCapturedEchoSprites(): void {
    for (const sprite of this.capturedEchoSprites) {
      sprite.visible = false;
    }
  }

  private drawLoop(state: PlaygroundRenderState): void {
    const graphics = this.loopGraphics.clear();
    const points = state.loopSamples;
    const preview = state.loopPreview;
    const texturedTetherActive = this.updateTexturedTether(
      points,
      state.elapsed,
    );

    if (points.length === 0 || preview === null) {
      return;
    }

    const anchor = points[0]!;

    if (state.activeImprint === 'nerve') {
      const fieldPulse = 0.86 + Math.sin(state.elapsed * 4.2) * 0.08;
      graphics
        .circle(anchor.x, anchor.y, state.nerveFieldRadius * fieldPulse)
        .fill({ color: GAMEPLAY_COLORS.hostileCyan, alpha: 0.018 })
        .stroke({
          color: GAMEPLAY_COLORS.hostileCyan,
          width: 1.2,
          alpha: 0.18,
        });
      graphics
        .circle(
          anchor.x,
          anchor.y,
          state.nerveFieldRadius * 0.74 * fieldPulse,
        )
        .stroke({
          color: GAMEPLAY_COLORS.hostileCyan,
          width: 0.8,
          alpha: 0.1,
        });
    }

    if (preview.valid) {
      this.tracePath(graphics, preview.points, true);
      graphics
        .fill({ color: GAMEPLAY_COLORS.arterial, alpha: 0.052 })
        .stroke({
          color: GAMEPLAY_COLORS.bone,
          width: 1.2,
          alpha: 0.24,
        });

      for (const projected of state.projectedLoopPreviews) {
        this.tracePath(graphics, projected.points, true);
        graphics
          .fill({ color: GAMEPLAY_COLORS.hostileCyan, alpha: 0.025 })
          .stroke({
            color: GAMEPLAY_COLORS.hostileCyan,
            width: 1.4,
            alpha: 0.42,
          });
      }

      if (state.activeImprint === 'blade') {
        for (const bladePath of [preview, ...state.projectedLoopPreviews]) {
          this.tracePath(graphics, bladePath.points, true);
          graphics.stroke({
            color: GAMEPLAY_COLORS.arterialBright,
            width: state.bladeBandWidth * 2,
            alpha: 0.035,
          });
        }
      }
    }

    if (points.length >= 2) {
      if (texturedTetherActive) {
        this.drawTexturedTetherAccents(graphics, points, state.elapsed);
      } else {
        this.drawLivingTether(graphics, points, state.elapsed);
      }
    }

    if (preview.kind !== 'self-intersection') {
      graphics
        .moveTo(state.player.x, state.player.y)
        .lineTo(preview.snapPoint.x, preview.snapPoint.y)
        .stroke({
          color: GAMEPLAY_COLORS.void,
          width: preview.valid ? 4 : 2,
          alpha: 0.66,
        });
      graphics
        .moveTo(state.player.x, state.player.y)
        .lineTo(preview.snapPoint.x, preview.snapPoint.y)
        .stroke({
          color: preview.valid
            ? GAMEPLAY_COLORS.bone
            : GAMEPLAY_COLORS.tendon,
          width: preview.valid ? 2 : 1,
          alpha: preview.valid ? 0.55 : 0.22,
        });
    }

    if (preview.kind !== 'direct') {
      const snapPulse = 1 + Math.sin(state.elapsed * 11) * 0.14;
      graphics
        .circle(
          preview.snapPoint.x,
          preview.snapPoint.y,
          9 * snapPulse,
        )
        .stroke({
          color: GAMEPLAY_COLORS.bone,
          width: 2,
          alpha: 0.92,
        });
      this.drawSnapTeeth(graphics, preview.snapPoint, snapPulse);
    }

    const anchorPulse = 1 + Math.sin(state.elapsed * 8) * 0.12;
    graphics
      .circle(anchor.x, anchor.y, 15 * anchorPulse)
      .fill({ color: GAMEPLAY_COLORS.void, alpha: 0.62 })
      .stroke({ color: GAMEPLAY_COLORS.amber, width: 2.4, alpha: 0.82 });
    graphics
      .circle(anchor.x, anchor.y, 7)
      .stroke({ color: GAMEPLAY_COLORS.bone, width: 2.2, alpha: 0.95 });
    this.drawAnchorSpines(graphics, anchor, state.elapsed);
  }

  private drawAsphaltPatches(
    graphics: Graphics,
    width: number,
    height: number,
    edge: number,
  ): void {
    const patchCount = Math.max(
      28,
      Math.min(72, Math.floor((width * height) / 82_000)),
    );
    for (let index = 0; index < patchCount; index += 1) {
      const x = edge + deterministicUnit(index, 101) * (width - edge * 2);
      const y = edge + deterministicUnit(index, 103) * (height - edge * 2);
      const radiusX = 28 + deterministicUnit(index, 107) * 92;
      const radiusY = 12 + deterministicUnit(index, 109) * 38;
      const lightPatch = index % 3 === 0;

      graphics.ellipse(x, y, radiusX, radiusY).fill({
        color: lightPatch
          ? GAMEPLAY_COLORS.asphaltLight
          : GAMEPLAY_COLORS.void,
        alpha: lightPatch ? 0.13 : 0.12,
      });
    }

    graphics
      .moveTo(edge, height * 0.54)
      .bezierCurveTo(
        width * 0.28,
        height * 0.5,
        width * 0.68,
        height * 0.6,
        width - edge,
        height * 0.52,
      )
      .stroke({
        color: GAMEPLAY_COLORS.tendon,
        width: 2,
        alpha: 0.08,
      });
  }

  private drawPuddleBodies(graphics: Graphics): void {
    for (const puddle of DISTRICT_PUDDLES) {
      this.traceOrientedEllipse(
        graphics,
        puddle.position,
        puddle.radiusX,
        puddle.radiusY,
        puddle.rotation,
      );
      graphics
        .fill({ color: GAMEPLAY_COLORS.void, alpha: 0.36 })
        .stroke({
          color: GAMEPLAY_COLORS.rain,
          width: 1,
          alpha: 0.13,
        });
      const inner = this.localPoint(
        puddle.position,
        puddle.rotation,
        -puddle.radiusX * 0.14,
        -puddle.radiusY * 0.1,
      );
      this.traceOrientedEllipse(
        graphics,
        inner,
        puddle.radiusX * 0.54,
        puddle.radiusY * 0.4,
        puddle.rotation,
      );
      graphics.stroke({
        color: GAMEPLAY_COLORS.asphaltLight,
        width: 1,
        alpha: 0.26,
      });
    }
  }

  private drawRoadCracks(
    graphics: Graphics,
    width: number,
    height: number,
    edge: number,
  ): void {
    const crackCount = Math.max(
      24,
      Math.min(64, Math.floor((width * height) / 96_000)),
    );
    for (let crackIndex = 0; crackIndex < crackCount; crackIndex += 1) {
      let x = edge + deterministicUnit(crackIndex, 131) * (width - edge * 2);
      let y = edge + deterministicUnit(crackIndex, 137) * (height - edge * 2);
      let angle = deterministicUnit(crackIndex, 139) * Math.PI * 2;

      graphics.moveTo(x, y);
      for (let segment = 0; segment < 4; segment += 1) {
        const distance = 9 + deterministicUnit(crackIndex * 5 + segment, 149) * 15;
        angle += (deterministicUnit(crackIndex * 7 + segment, 151) - 0.5) * 0.8;
        x += Math.cos(angle) * distance;
        y += Math.sin(angle) * distance;
        graphics.lineTo(x, y);

        if (segment === 1) {
          const branchAngle = angle + (crackIndex % 2 === 0 ? 0.92 : -0.92);
          graphics
            .moveTo(x, y)
            .lineTo(
              x + Math.cos(branchAngle) * distance * 0.58,
              y + Math.sin(branchAngle) * distance * 0.58,
            )
            .moveTo(x, y);
        }
      }
      graphics.stroke({
        color: GAMEPLAY_COLORS.rain,
        width: 0.8,
        alpha: 0.16,
      });
    }
  }

  private drawCrossingMarks(graphics: Graphics): void {
    for (const crosswalk of DISTRICT_CROSSWALKS) {
      const totalWidth =
        (crosswalk.stripeCount - 1) * crosswalk.stripeGap;
      for (let index = 0; index < crosswalk.stripeCount; index += 1) {
        const offset = index * crosswalk.stripeGap - totalWidth / 2;
        const center = this.localPoint(
          crosswalk.position,
          crosswalk.rotation,
          0,
          offset,
        );
        this.traceOrientedQuad(
          graphics,
          center,
          crosswalk.stripeLength,
          crosswalk.stripeWidth,
          crosswalk.rotation,
        );
        graphics.fill({
          color: GAMEPLAY_COLORS.bone,
          alpha: index % 3 === 0 ? 0.12 : 0.085,
        });
        const wear = this.localPoint(
          center,
          crosswalk.rotation,
          crosswalk.stripeLength *
            (deterministicUnit(index, crosswalk.stripeCount + 301) - 0.5) *
            0.45,
          0,
        );
        this.traceOrientedQuad(
          graphics,
          wear,
          crosswalk.stripeLength * 0.22,
          Math.max(1, crosswalk.stripeWidth * 0.18),
          crosswalk.rotation,
        );
        graphics.fill({ color: GAMEPLAY_COLORS.rain, alpha: 0.15 });
      }
    }
  }

  private drawBarricades(
    graphics: Graphics,
    width: number,
    height: number,
  ): void {
    const horizontalCount = Math.ceil(width / WORLD_BARRIER_LENGTH);
    for (let index = 0; index < horizontalCount; index += 1) {
      const x =
        ((index + 0.5) / horizontalCount) * width;
      this.drawConcreteBlock(
        graphics,
        { x, y: WORLD_BARRIER_INSET },
        width / horizontalCount + 4,
        WORLD_BARRIER_DEPTH,
        index % 2 === 0 ? 0.012 : -0.012,
        index,
      );
      this.drawConcreteBlock(
        graphics,
        { x, y: height - WORLD_BARRIER_INSET },
        width / horizontalCount + 4,
        WORLD_BARRIER_DEPTH,
        Math.PI + (index % 2 === 0 ? -0.012 : 0.012),
        index + 101,
      );
    }

    const verticalCount = Math.ceil(height / WORLD_BARRIER_LENGTH);
    for (let index = 1; index < verticalCount - 1; index += 1) {
      const y = ((index + 0.5) / verticalCount) * height;
      this.drawConcreteBlock(
        graphics,
        { x: WORLD_BARRIER_INSET, y },
        height / verticalCount + 4,
        WORLD_BARRIER_DEPTH,
        Math.PI / 2 + (index % 2 === 0 ? 0.012 : -0.012),
        index + 211,
      );
      this.drawConcreteBlock(
        graphics,
        { x: width - WORLD_BARRIER_INSET, y },
        height / verticalCount + 4,
        WORLD_BARRIER_DEPTH,
        -Math.PI / 2 + (index % 2 === 0 ? -0.012 : 0.012),
        index + 307,
      );
    }
  }

  private drawConcreteBlock(
    graphics: Graphics,
    center: Vec2,
    length: number,
    width: number,
    angle: number,
    seed: number,
  ): void {
    this.traceOrientedQuad(graphics, center, length, width, angle);
    graphics
      .fill({ color: GAMEPLAY_COLORS.asphaltLight, alpha: 0.96 })
      .stroke({
        color: GAMEPLAY_COLORS.rain,
        width: 1.4,
        alpha: 0.3,
      });

    const chipOffset = (deterministicUnit(seed, 181) - 0.5) * length * 0.35;
    const chip = this.localPoint(center, angle, chipOffset, -width * 0.52);
    this.drawShard(
      graphics,
      chip,
      angle + Math.PI * 0.5,
      5,
      3,
      GAMEPLAY_COLORS.void,
      0.9,
    );

    const warningCenter = this.localPoint(center, angle, length * 0.18, 0);
    this.traceOrientedQuad(
      graphics,
      warningCenter,
      length * 0.22,
      width * 0.22,
      angle,
    );
    graphics.fill({ color: GAMEPLAY_COLORS.amber, alpha: 0.2 });
  }

  private drawEdgeBiomass(graphics: Graphics): void {
    DISTRICT_BIOMASS.forEach((colony, colonyIndex) => {
      for (let massIndex = 0; massIndex < colony.massCount; massIndex += 1) {
        const along =
          12 + deterministicUnit(colonyIndex * 17 + massIndex, 191) * 74;
        const lateral =
          (deterministicUnit(colonyIndex * 13 + massIndex, 197) - 0.5) *
          colony.spread;
        const position = this.localPoint(
          colony.origin,
          colony.inwardAngle,
          along,
          lateral,
        );
        const radius = 8 + deterministicUnit(massIndex, 199) * 14;
        graphics
          .circle(position.x, position.y, radius)
          .fill({ color: GAMEPLAY_COLORS.void, alpha: 0.94 })
          .stroke({
            color: GAMEPLAY_COLORS.tendon,
            width: 1,
            alpha: 0.18,
          });
      }

      for (let tendrilIndex = 0; tendrilIndex < 5; tendrilIndex += 1) {
        const lateral = (tendrilIndex - 2) * (colony.spread / 9);
        const reach =
          58 + deterministicUnit(tendrilIndex, colonyIndex + 211) * 92;
        const end = this.localPoint(
          colony.origin,
          colony.inwardAngle,
          reach,
          lateral,
        );
        const controlOne = this.localPoint(
          colony.origin,
          colony.inwardAngle,
          reach * 0.28,
          lateral * 0.08,
        );
        const controlTwo = this.localPoint(
          colony.origin,
          colony.inwardAngle,
          reach * 0.74,
          lateral * 0.72,
        );

        this.drawBezierStroke(
          graphics,
          colony.origin,
          controlOne,
          controlTwo,
          end,
          GAMEPLAY_COLORS.void,
          8 - tendrilIndex * 0.7,
          0.88,
        );
        this.drawBezierStroke(
          graphics,
          colony.origin,
          controlOne,
          controlTwo,
          end,
          GAMEPLAY_COLORS.arterial,
          1.2,
          0.19,
        );
      }
    });
  }

  private drawDistrictVents(graphics: Graphics): void {
    for (const vent of DISTRICT_VENTS) {
      this.traceOrientedQuad(
        graphics,
        vent.position,
        vent.width,
        vent.height,
        vent.rotation,
      );
      graphics
        .fill({ color: GAMEPLAY_COLORS.void, alpha: 0.96 })
        .stroke({ color: GAMEPLAY_COLORS.rain, width: 2, alpha: 0.38 });

      for (let slat = -3; slat <= 3; slat += 1) {
        const along = (slat / 3) * vent.width * 0.36;
        const start = this.localPoint(
          vent.position,
          vent.rotation,
          along,
          -vent.height * 0.35,
        );
        const end = this.localPoint(
          vent.position,
          vent.rotation,
          along,
          vent.height * 0.35,
        );
        graphics.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({
          color: GAMEPLAY_COLORS.asphaltLight,
          width: 3,
          alpha: 0.7,
        });
        graphics.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({
          color: GAMEPLAY_COLORS.rain,
          width: 0.8,
          alpha: 0.28,
        });
      }
    }
  }

  private drawEnvironmentAtmosphere(state: PlaygroundRenderState): void {
    const graphics = this.environmentAtmosphere.clear();
    for (const light of DISTRICT_LIGHTS) {
      this.drawEmergencyLight(
        graphics,
        light.position,
        state.elapsed,
        light.phase,
        state.reducedFlash,
      );
    }

    DISTRICT_PUDDLES.forEach((puddle, index) => {
      const shimmer =
        0.5 + Math.sin(state.elapsed * 1.6 + index * 2.1) * 0.5;
      const center = this.localPoint(
        puddle.position,
        puddle.rotation,
        -puddle.radiusX * 0.16 + shimmer * 3,
        -puddle.radiusY * 0.14,
      );
      const start = this.localPoint(
        center,
        puddle.rotation,
        -puddle.radiusX * (0.08 + shimmer * 0.08),
        0,
      );
      const end = this.localPoint(
        center,
        puddle.rotation,
        puddle.radiusX * (0.08 + shimmer * 0.08),
        0,
      );
      graphics.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({
        color: GAMEPLAY_COLORS.rain,
        width: 1.1,
        alpha: 0.16 + shimmer * 0.12,
      });
    });
  }

  private drawWeather(state: PlaygroundRenderState): void {
    const { width, height, elapsed } = state;
    const graphics = this.weather.clear();

    const rainCount = Math.max(
      28,
      Math.min(62, Math.floor((width * height) / 17_000)),
    );
    for (let index = 0; index < rainCount; index += 1) {
      const rainX =
        positiveModulo(index * 137 + elapsed * (92 + (index % 3) * 13), width + 100) -
        50;
      const rainY =
        positiveModulo(index * 83 + elapsed * (244 + (index % 4) * 17), height + 120) -
        60;
      const length = 10 + (index % 5) * 2.2;
      graphics
        .moveTo(rainX, rainY)
        .lineTo(rainX - length * 0.34, rainY + length)
        .stroke({
          color: GAMEPLAY_COLORS.rain,
          width: index % 7 === 0 ? 1.25 : 0.8,
          alpha: index % 7 === 0 ? 0.26 : 0.13,
        });
    }
  }

  private drawEmergencyLight(
    graphics: Graphics,
    position: Vec2,
    elapsed: number,
    seed: number,
    reducedFlash: boolean,
  ): void {
    const pulse = reducedFlash
      ? 0.35
      : 0.5 + Math.sin(elapsed * 2.7 + seed * 2.4) * 0.5;
    graphics.circle(position.x, position.y, 42 + pulse * 8).fill({
      color: GAMEPLAY_COLORS.arterial,
      alpha: 0.018 + pulse * 0.018,
    });
    graphics.circle(position.x, position.y, 22 + pulse * 4).fill({
      color: GAMEPLAY_COLORS.arterialBright,
      alpha: 0.025 + pulse * 0.028,
    });
    graphics
      .circle(position.x, position.y, 3.2)
      .fill({ color: GAMEPLAY_COLORS.arterialBright, alpha: 0.72 });
    graphics
      .moveTo(position.x - 7, position.y)
      .lineTo(position.x + 7, position.y)
      .stroke({
        color: GAMEPLAY_COLORS.bone,
        width: 1,
        alpha: 0.38,
      });
  }

  private drawDrifter(
    graphics: Graphics,
    enemy: PlaygroundEnemyView,
    player: Vec2,
    elapsed: number,
  ): void {
    const radius = enemy.radius;
    const breath = 1 + Math.sin(elapsed * 2.2 + enemy.phase) * 0.035;
    const twitch = Math.sin(elapsed * 3.7 + enemy.phase * 1.9) * 0.055;
    const angle =
      Math.atan2(
        player.y - enemy.position.y,
        player.x - enemy.position.x,
      ) + twitch;

    graphics
      .ellipse(
        enemy.position.x,
        enemy.position.y + radius * 0.72,
        radius * 1.24,
        radius * 0.48,
      )
      .fill({ color: GAMEPLAY_COLORS.void, alpha: 0.58 });
    graphics.circle(enemy.position.x, enemy.position.y, radius * 1.38).fill({
      color: GAMEPLAY_COLORS.hostileCyan,
      alpha: 0.035,
    });

    for (const side of [-1, 1] as const) {
      const strideOffset =
        Math.sin(elapsed * 2 + enemy.phase + side * 1.4) * radius * 0.08;
      const rearLimb = [
        this.localPoint(
          enemy.position,
          angle,
          -radius * 0.3,
          side * radius * 0.42,
        ),
        this.localPoint(
          enemy.position,
          angle,
          -radius * 0.94 + strideOffset,
          side * radius * 0.72,
        ),
        this.localPoint(
          enemy.position,
          angle,
          -radius * 1.08 + strideOffset,
          side * radius * 1.06,
        ),
      ];
      this.drawJointedLimb(graphics, rearLimb, radius * 0.23, 0.68);

      const foreLimb = [
        this.localPoint(
          enemy.position,
          angle,
          radius * 0.12,
          side * radius * 0.52,
        ),
        this.localPoint(
          enemy.position,
          angle,
          radius * (0.02 + side * 0.05),
          side * radius * 0.98,
        ),
        this.localPoint(
          enemy.position,
          angle,
          radius * 0.52,
          side * radius * 1.28,
        ),
      ];
      this.drawJointedLimb(graphics, foreLimb, radius * 0.25, 0.82);
    }

    const torso = [
      this.localPoint(enemy.position, angle, radius * 0.72, 0),
      this.localPoint(
        enemy.position,
        angle,
        radius * 0.28,
        -radius * 0.6 * breath,
      ),
      this.localPoint(
        enemy.position,
        angle,
        -radius * 0.58,
        -radius * 0.52 * breath,
      ),
      this.localPoint(enemy.position, angle, -radius * 0.86, radius * 0.08),
      this.localPoint(
        enemy.position,
        angle,
        -radius * 0.5,
        radius * 0.5 * breath,
      ),
      this.localPoint(
        enemy.position,
        angle,
        radius * 0.28,
        radius * 0.54 * breath,
      ),
    ];
    this.tracePath(graphics, torso, true);
    graphics
      .fill({ color: GAMEPLAY_COLORS.tendon, alpha: 0.7 })
      .stroke({ color: GAMEPLAY_COLORS.void, width: 5.5, alpha: 0.92 });
    this.tracePath(graphics, torso, true);
    graphics.stroke({
      color: GAMEPLAY_COLORS.bone,
      width: 1.1,
      alpha: 0.48,
    });

    for (let plateIndex = 0; plateIndex < 3; plateIndex += 1) {
      const forward = radius * (0.2 - plateIndex * 0.27);
      const plateCenter = this.localPoint(enemy.position, angle, forward, 0);
      this.traceOrientedQuad(
        graphics,
        plateCenter,
        radius * 0.18,
        radius * (0.76 - plateIndex * 0.11),
        angle + Math.PI * 0.5,
      );
      graphics.fill({
        color: GAMEPLAY_COLORS.bone,
        alpha: 0.28 + plateIndex * 0.06,
      });
    }

    const head = this.localPoint(enemy.position, angle, radius * 0.78, 0);
    const skull = [
      this.localPoint(head, angle, radius * 0.48, 0),
      this.localPoint(head, angle, radius * 0.02, -radius * 0.42),
      this.localPoint(head, angle, -radius * 0.26, -radius * 0.24),
      this.localPoint(head, angle, -radius * 0.2, radius * 0.28),
      this.localPoint(head, angle, radius * 0.08, radius * 0.37),
    ];
    this.tracePath(graphics, skull, true);
    graphics
      .fill({ color: GAMEPLAY_COLORS.bone, alpha: 0.76 })
      .stroke({ color: GAMEPLAY_COLORS.void, width: 2.2, alpha: 0.9 });

    const core = this.localPoint(enemy.position, angle, -radius * 0.02, 0);
    graphics.circle(core.x, core.y, radius * 0.39).fill({
      color: GAMEPLAY_COLORS.hostileCyan,
      alpha: 0.14,
    });
    const coreDiamond = [
      this.localPoint(core, angle, radius * 0.31, 0),
      this.localPoint(core, angle, 0, radius * 0.22),
      this.localPoint(core, angle, -radius * 0.31, 0),
      this.localPoint(core, angle, 0, -radius * 0.22),
    ];
    this.tracePath(graphics, coreDiamond, true);
    graphics
      .fill({ color: GAMEPLAY_COLORS.hostileCyan, alpha: 0.92 })
      .stroke({ color: GAMEPLAY_COLORS.bone, width: 1, alpha: 0.52 });
    graphics
      .circle(core.x, core.y, Math.max(1.4, radius * 0.09))
      .fill({ color: GAMEPLAY_COLORS.void, alpha: 0.9 });
  }

  private drawCarrier(
    graphics: Graphics,
    state: PlaygroundRenderState,
  ): void {
    const center = state.player;
    const radius = PLAYGROUND_TUNING.playerRadius;
    const angle = this.playerFacingAngle(state);
    const breath = 1 + Math.sin(state.elapsed * 3.1) * 0.04;

    graphics
      .ellipse(
        center.x,
        center.y + radius * 0.74,
        radius * 1.58,
        radius * 0.58,
      )
      .fill({ color: GAMEPLAY_COLORS.void, alpha: 0.68 });
    graphics.circle(center.x, center.y, radius * 1.85).fill({
      color: GAMEPLAY_COLORS.arterial,
      alpha: 0.035,
    });

    for (let tendrilIndex = 0; tendrilIndex < 3; tendrilIndex += 1) {
      const side = tendrilIndex - 1;
      const start = this.localPoint(
        center,
        angle,
        -radius * 0.38,
        side * radius * 0.36,
      );
      const controlOne = this.localPoint(
        center,
        angle,
        -radius * (0.92 + tendrilIndex * 0.13),
        side * radius * (0.76 + tendrilIndex * 0.12),
      );
      const controlTwo = this.localPoint(
        center,
        angle,
        -radius * (1.52 + tendrilIndex * 0.18),
        side * radius * (0.4 + tendrilIndex * 0.28),
      );
      const end = this.localPoint(
        center,
        angle,
        -radius * (1.92 + tendrilIndex * 0.17),
        side * radius * (0.56 + tendrilIndex * 0.16),
      );
      this.drawBezierStroke(
        graphics,
        start,
        controlOne,
        controlTwo,
        end,
        GAMEPLAY_COLORS.void,
        7 - tendrilIndex * 0.6,
        0.96,
      );
      this.drawBezierStroke(
        graphics,
        start,
        controlOne,
        controlTwo,
        end,
        GAMEPLAY_COLORS.arterial,
        1.35,
        0.68,
      );
    }

    const leftArm = [
      this.localPoint(center, angle, radius * 0.24, -radius * 0.56),
      this.localPoint(center, angle, -radius * 0.06, -radius * 1.04),
      this.localPoint(center, angle, radius * 0.52, -radius * 1.5),
    ];
    const rightArm = [
      this.localPoint(center, angle, -radius * 0.08, radius * 0.5),
      this.localPoint(center, angle, -radius * 0.62, radius * 0.98),
      this.localPoint(center, angle, -radius * 0.16, radius * 1.32),
    ];
    this.drawJointedLimb(graphics, leftArm, radius * 0.3, 0.84);
    this.drawJointedLimb(graphics, rightArm, radius * 0.25, 0.66);

    const body = [
      this.localPoint(center, angle, radius * 0.92, -radius * 0.08),
      this.localPoint(center, angle, radius * 0.42, -radius * 0.7 * breath),
      this.localPoint(center, angle, -radius * 0.36, -radius * 0.84 * breath),
      this.localPoint(center, angle, -radius * 1.02, -radius * 0.28),
      this.localPoint(center, angle, -radius * 1.18, radius * 0.32),
      this.localPoint(center, angle, -radius * 0.34, radius * 0.62 * breath),
      this.localPoint(center, angle, radius * 0.38, radius * 0.48 * breath),
    ];
    this.tracePath(graphics, body, true);
    graphics
      .fill({ color: GAMEPLAY_COLORS.void, alpha: 0.99 })
      .stroke({
        color: GAMEPLAY_COLORS.tendon,
        width: 6,
        alpha: 0.28,
      });
    this.tracePath(graphics, body, true);
    graphics.stroke({
      color: GAMEPLAY_COLORS.bone,
      width: 1.35,
      alpha: 0.66,
    });

    const dorsalStart = this.localPoint(center, angle, -radius * 0.92, 0);
    const dorsalEnd = this.localPoint(center, angle, radius * 0.72, 0);
    graphics
      .moveTo(dorsalStart.x, dorsalStart.y)
      .lineTo(dorsalEnd.x, dorsalEnd.y)
      .stroke({
        color: GAMEPLAY_COLORS.arterial,
        width: 2,
        alpha: 0.74,
      });

    for (let ribIndex = 0; ribIndex < 3; ribIndex += 1) {
      const ribForward = radius * (0.18 - ribIndex * 0.3);
      const ribCenter = this.localPoint(center, angle, ribForward, 0);
      this.traceOrientedQuad(
        graphics,
        ribCenter,
        radius * 0.16,
        radius * (0.9 - ribIndex * 0.12),
        angle + Math.PI * 0.5,
      );
      graphics.fill({
        color: GAMEPLAY_COLORS.bone,
        alpha: 0.26 + ribIndex * 0.09,
      });
    }

    const core = this.localPoint(center, angle, -radius * 0.08, radius * 0.05);
    graphics.circle(core.x, core.y, radius * 0.43).fill({
      color: GAMEPLAY_COLORS.arterial,
      alpha: 0.14,
    });
    const coreShape = [
      this.localPoint(core, angle, radius * 0.34, 0),
      this.localPoint(core, angle, 0, radius * 0.17),
      this.localPoint(core, angle, -radius * 0.3, 0),
      this.localPoint(core, angle, 0, -radius * 0.17),
    ];
    this.tracePath(graphics, coreShape, true);
    graphics.fill({ color: GAMEPLAY_COLORS.arterialBright, alpha: 0.9 });
    graphics
      .circle(core.x, core.y, radius * 0.08)
      .fill({ color: GAMEPLAY_COLORS.bone, alpha: 0.92 });

    const hookBase = this.localPoint(center, angle, radius * 0.7, 0);
    const cranialHook = [
      this.localPoint(hookBase, angle, radius * 0.9, -radius * 0.06),
      this.localPoint(hookBase, angle, radius * 0.34, -radius * 0.46),
      this.localPoint(hookBase, angle, -radius * 0.12, -radius * 0.3),
      this.localPoint(hookBase, angle, radius * 0.08, radius * 0.28),
      this.localPoint(hookBase, angle, radius * 0.52, radius * 0.16),
      this.localPoint(hookBase, angle, radius * 0.7, radius * 0.52),
      this.localPoint(hookBase, angle, radius * 0.96, radius * 0.44),
      this.localPoint(hookBase, angle, radius * 0.7, radius * 0.04),
    ];
    this.tracePath(graphics, cranialHook, true);
    graphics
      .fill({ color: GAMEPLAY_COLORS.bone, alpha: 0.96 })
      .stroke({ color: GAMEPLAY_COLORS.void, width: 2, alpha: 0.9 });

    const hookSlitStart = this.localPoint(hookBase, angle, radius * 0.2, 0);
    const hookSlitEnd = this.localPoint(hookBase, angle, radius * 0.7, 0);
    graphics
      .moveTo(hookSlitStart.x, hookSlitStart.y)
      .lineTo(hookSlitEnd.x, hookSlitEnd.y)
      .stroke({ color: GAMEPLAY_COLORS.void, width: 2.1, alpha: 0.88 });
  }

  private playerFacingAngle(state: PlaygroundRenderState): number {
    if (Number.isFinite(this.lastPlayerX) && Number.isFinite(this.lastPlayerY)) {
      const dx = state.player.x - this.lastPlayerX;
      const dy = state.player.y - this.lastPlayerY;
      if (Math.hypot(dx, dy) > 0.2) {
        this.playerFacing = Math.atan2(dy, dx);
      }
    }

    this.lastPlayerX = state.player.x;
    this.lastPlayerY = state.player.y;
    return this.playerFacing;
  }

  private drawJointedLimb(
    graphics: Graphics,
    points: readonly Vec2[],
    width: number,
    alpha: number,
  ): void {
    this.tracePath(graphics, points, false);
    graphics.stroke({
      color: GAMEPLAY_COLORS.void,
      width: width + 3.4,
      alpha: 0.94,
    });
    this.tracePath(graphics, points, false);
    graphics.stroke({
      color: GAMEPLAY_COLORS.tendon,
      width,
      alpha,
    });

    for (let index = 1; index < points.length - 1; index += 1) {
      const joint = points[index]!;
      graphics.circle(joint.x, joint.y, Math.max(1.4, width * 0.48)).fill({
        color: GAMEPLAY_COLORS.bone,
        alpha: alpha * 0.72,
      });
    }

    const last = points.at(-1);
    const previous = points.at(-2);
    if (last !== undefined && previous !== undefined) {
      const angle = Math.atan2(last.y - previous.y, last.x - previous.x);
      this.drawShard(
        graphics,
        last,
        angle,
        width * 2.1,
        width * 0.7,
        GAMEPLAY_COLORS.bone,
        alpha * 0.9,
      );
    }
  }

  private updateTexturedTether(
    points: readonly Vec2[],
    elapsed: number,
  ): boolean {
    const rope = this.tetherRope;
    if (rope === null || points.length < 2) {
      if (rope !== null) {
        rope.visible = false;
      }
      return false;
    }

    const cappedPointCount = Math.min(
      points.length,
      this.tetherCumulativeDistances.length,
    );
    let totalDistance = 0;
    this.tetherCumulativeDistances[0] = 0;

    for (let index = 1; index < cappedPointCount; index += 1) {
      const previous = points[index - 1]!;
      const point = points[index]!;
      totalDistance += Math.hypot(
        point.x - previous.x,
        point.y - previous.y,
      );
      this.tetherCumulativeDistances[index] = totalDistance;
    }

    if (totalDistance < 1) {
      rope.visible = false;
      return false;
    }

    let segmentIndex = 1;
    for (
      let ropeIndex = 0;
      ropeIndex < this.tetherRopePoints.length;
      ropeIndex += 1
    ) {
      const amount = ropeIndex / (this.tetherRopePoints.length - 1);
      const targetDistance = totalDistance * amount;
      while (
        segmentIndex < cappedPointCount - 1 &&
        this.tetherCumulativeDistances[segmentIndex]! < targetDistance
      ) {
        segmentIndex += 1;
      }

      const previousIndex = Math.max(0, segmentIndex - 1);
      const previous = points[previousIndex]!;
      const next = points[segmentIndex]!;
      const previousDistance = this.tetherCumulativeDistances[previousIndex]!;
      const segmentDistance = Math.max(
        0.0001,
        this.tetherCumulativeDistances[segmentIndex]! - previousDistance,
      );
      const segmentAmount = clamp01(
        (targetDistance - previousDistance) / segmentDistance,
      );
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const directionLength = Math.max(1, Math.hypot(dx, dy));
      const livingOffset =
        Math.sin(ropeIndex * 0.78 + elapsed * 5.2) * 0.46;
      const x =
        previous.x +
        dx * segmentAmount +
        (-dy / directionLength) * livingOffset;
      const y =
        previous.y +
        dy * segmentAmount +
        (dx / directionLength) * livingOffset;

      this.tetherRopePoints[ropeIndex]!.set(
        x / TETHER_ROPE_SCALE,
        y / TETHER_ROPE_SCALE,
      );
    }

    rope.visible = true;
    return true;
  }

  private drawTexturedTetherAccents(
    graphics: Graphics,
    points: readonly Vec2[],
    elapsed: number,
  ): void {
    this.traceWovenStrand(graphics, points, elapsed);
    graphics.stroke({
      color: GAMEPLAY_COLORS.arterialBright,
      width: 1.35,
      alpha: 0.56,
    });

    const stride = Math.max(3, Math.ceil(points.length / 14));
    for (let index = stride; index < points.length - 1; index += stride) {
      const previous = points[Math.max(0, index - 1)]!;
      const point = points[index]!;
      const next = points[Math.min(points.length - 1, index + 1)]!;
      const pathAngle = Math.atan2(
        next.y - previous.y,
        next.x - previous.x,
      );
      const side = Math.floor(index / stride) % 2 === 0 ? 1 : -1;
      this.drawShard(
        graphics,
        point,
        pathAngle + side * Math.PI * 0.5,
        4.4,
        1.65,
        GAMEPLAY_COLORS.bone,
        0.58,
      );
    }
  }

  private drawLivingTether(
    graphics: Graphics,
    points: readonly Vec2[],
    elapsed: number,
  ): void {
    this.tracePath(graphics, points, false);
    graphics.stroke({
      color: GAMEPLAY_COLORS.void,
      width: 15,
      alpha: 0.97,
    });
    this.tracePath(graphics, points, false);
    graphics.stroke({
      color: GAMEPLAY_COLORS.tendon,
      width: 10,
      alpha: 0.52,
    });
    this.tracePath(graphics, points, false);
    graphics.stroke({
      color: GAMEPLAY_COLORS.asphaltLight,
      width: 6.5,
      alpha: 0.96,
    });
    this.traceWovenStrand(graphics, points, elapsed);
    graphics.stroke({
      color: GAMEPLAY_COLORS.arterialBright,
      width: 2.5,
      alpha: 0.88,
    });

    const stride = Math.max(2, Math.ceil(points.length / 22));
    for (let index = stride; index < points.length - 1; index += stride) {
      const previous = points[Math.max(0, index - 1)]!;
      const point = points[index]!;
      const next = points[Math.min(points.length - 1, index + 1)]!;
      const angle = Math.atan2(next.y - previous.y, next.x - previous.x);
      const side = Math.floor(index / stride) % 2 === 0 ? 1 : -1;
      const normalAngle = angle + side * Math.PI * 0.5;
      const pulse = 0.75 + Math.sin(elapsed * 7 + index * 0.9) * 0.12;
      const boneBarb = Math.floor(index / stride) % 3 === 0;

      this.drawShard(
        graphics,
        point,
        normalAngle,
        (boneBarb ? 7 : 4.5) * pulse,
        boneBarb ? 2.5 : 1.8,
        boneBarb ? GAMEPLAY_COLORS.bone : GAMEPLAY_COLORS.tendon,
        boneBarb ? 0.78 : 0.56,
      );
    }
  }

  private traceWovenStrand(
    graphics: Graphics,
    points: readonly Vec2[],
    elapsed: number,
  ): void {
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index]!;
      const previous = points[Math.max(0, index - 1)]!;
      const next = points[Math.min(points.length - 1, index + 1)]!;
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const offset = Math.sin(index * 1.55 + elapsed * 5.8) * 1.55;
      const x = point.x + (-dy / length) * offset;
      const y = point.y + (dx / length) * offset;

      if (index === 0) {
        graphics.moveTo(x, y);
      } else {
        graphics.lineTo(x, y);
      }
    }
  }

  private drawSnapTeeth(
    graphics: Graphics,
    position: Vec2,
    pulse: number,
  ): void {
    for (let index = 0; index < 4; index += 1) {
      const angle = (index / 4) * Math.PI * 2;
      const tooth = {
        x: position.x + Math.cos(angle) * 7.5 * pulse,
        y: position.y + Math.sin(angle) * 7.5 * pulse,
      };
      this.drawShard(
        graphics,
        tooth,
        angle + Math.PI,
        4.2,
        1.8,
        GAMEPLAY_COLORS.bone,
        0.9,
      );
    }
  }

  private drawAnchorSpines(
    graphics: Graphics,
    anchor: Vec2,
    elapsed: number,
  ): void {
    const pulse = 0.92 + Math.sin(elapsed * 8) * 0.08;
    for (let index = 0; index < 5; index += 1) {
      const angle = -Math.PI * 0.5 + (index / 5) * Math.PI * 2;
      const base = {
        x: anchor.x + Math.cos(angle) * 6,
        y: anchor.y + Math.sin(angle) * 6,
      };
      this.drawShard(
        graphics,
        base,
        angle,
        (index === 0 ? 9 : 6) * pulse,
        2.3,
        GAMEPLAY_COLORS.bone,
        0.94,
      );
    }
    graphics
      .circle(anchor.x, anchor.y, 2.8)
      .fill({ color: GAMEPLAY_COLORS.arterialBright, alpha: 0.9 });
  }

  private drawBezierStroke(
    graphics: Graphics,
    start: Vec2,
    controlOne: Vec2,
    controlTwo: Vec2,
    end: Vec2,
    color: number,
    width: number,
    alpha: number,
  ): void {
    graphics
      .moveTo(start.x, start.y)
      .bezierCurveTo(
        controlOne.x,
        controlOne.y,
        controlTwo.x,
        controlTwo.y,
        end.x,
        end.y,
      )
      .stroke({ color, width, alpha });
  }

  private traceOrientedQuad(
    graphics: Graphics,
    center: Vec2,
    length: number,
    width: number,
    angle: number,
  ): void {
    const points = [
      this.localPoint(center, angle, length * 0.5, width * 0.5),
      this.localPoint(center, angle, length * 0.5, -width * 0.5),
      this.localPoint(center, angle, -length * 0.5, -width * 0.5),
      this.localPoint(center, angle, -length * 0.5, width * 0.5),
    ];
    this.tracePath(graphics, points, true);
  }

  private traceOrientedEllipse(
    graphics: Graphics,
    center: Vec2,
    radiusX: number,
    radiusY: number,
    angle: number,
  ): void {
    const segmentCount = 24;
    const points = Array.from({ length: segmentCount }, (_, index) => {
      const radians = (index / segmentCount) * Math.PI * 2;
      return this.localPoint(
        center,
        angle,
        Math.cos(radians) * radiusX,
        Math.sin(radians) * radiusY,
      );
    });
    this.tracePath(graphics, points, true);
  }

  private localPoint(
    center: Vec2,
    angle: number,
    forward: number,
    lateral: number,
  ): Vec2 {
    return {
      x:
        center.x +
        Math.cos(angle) * forward -
        Math.sin(angle) * lateral,
      y:
        center.y +
        Math.sin(angle) * forward +
        Math.cos(angle) * lateral,
    };
  }

  private drawEffects(
    closureEcho: ClosureEchoView | null,
    player: Vec2,
    loopCutEcho: LoopCutEchoView | null,
    reducedFlash: boolean,
  ): void {
    const graphics = this.effects.clear();

    if (loopCutEcho !== null) {
      this.drawLoopCutEcho(graphics, loopCutEcho, reducedFlash);
    }

    if (closureEcho === null) {
      return;
    }

    const progress = clamp01(
      closureEcho.age / PLAYGROUND_TUNING.closureDurationSeconds,
    );
    const centroid = polygonCentroid(closureEcho.closure.points);

    if (closureEcho.captured === 0) {
      this.drawMissEcho(graphics, closureEcho, centroid, progress);
      return;
    }

    this.drawCaptureEcho(
      graphics,
      closureEcho,
      centroid,
      player,
      progress,
      reducedFlash,
    );
  }

  private drawLoopCutEcho(
    graphics: Graphics,
    echo: LoopCutEchoView,
    reducedFlash: boolean,
  ): void {
    const progress = clamp01(echo.age / 0.46);
    const impact = 1 - smoothstep(0.08, 0.72, progress);
    const radius = 10 + easeOutCubic(progress) * 42;
    const rotation = progress * 0.7;
    const flashScale = reducedFlash ? 0.42 : 1;

    graphics.circle(echo.position.x, echo.position.y, radius).stroke({
      color: GAMEPLAY_COLORS.arterialBright,
      width: 3 - progress * 1.5,
      alpha: impact * 0.76 * flashScale,
    });
    for (const angleOffset of [-0.58, 0.58]) {
      const angle = rotation + angleOffset;
      const halfLength = 38 + progress * 18;
      graphics
        .moveTo(
          echo.position.x - Math.cos(angle) * halfLength,
          echo.position.y - Math.sin(angle) * halfLength,
        )
        .lineTo(
          echo.position.x + Math.cos(angle) * halfLength,
          echo.position.y + Math.sin(angle) * halfLength,
        )
        .stroke({
          color: GAMEPLAY_COLORS.bone,
          width: 5 - progress * 3,
          alpha: impact * 0.92 * flashScale,
        });
    }
    for (let index = 0; index < 8; index += 1) {
      const angle = rotation + (index / 8) * Math.PI * 2;
      const distance = 12 + progress * 54;
      this.drawShard(
        graphics,
        {
          x: echo.position.x + Math.cos(angle) * distance,
          y: echo.position.y + Math.sin(angle) * distance,
        },
        angle,
        9 + (index % 3) * 2,
        2.8,
        index % 2 === 0
          ? GAMEPLAY_COLORS.bone
          : GAMEPLAY_COLORS.arterialBright,
        impact * 0.8 * flashScale,
      );
    }
  }

  private drawMissEcho(
    graphics: Graphics,
    closureEcho: ClosureEchoView,
    centroid: Vec2,
    progress: number,
  ): void {
    const contraction = easeOutCubic(phase(progress, 0.04, 0.82));
    const fade = 1 - smoothstep(0.48, 1, progress);
    const contracted = closureEcho.closure.points.map((point) =>
      lerpVec2(point, centroid, contraction * 0.42),
    );

    this.tracePath(graphics, contracted, true);
    graphics
      .fill({ color: GAMEPLAY_COLORS.tendon, alpha: fade * 0.035 })
      .stroke({
        color: GAMEPLAY_COLORS.tendon,
        width: Math.max(0.8, 2.2 * fade),
        alpha: fade * 0.5,
      });

    const ripple = 8 + easeOutCubic(progress) * 18;
    graphics.circle(centroid.x, centroid.y, ripple).stroke({
      color: GAMEPLAY_COLORS.tendon,
      width: 1,
      alpha: (1 - progress) * 0.18,
    });
  }

  private drawCaptureEcho(
    graphics: Graphics,
    closureEcho: ClosureEchoView,
    centroid: Vec2,
    player: Vec2,
    progress: number,
    reducedFlash: boolean,
  ): void {
    const flash =
      (1 - smoothstep(0.02, 0.15, progress)) *
      (reducedFlash ? 0.3 : 1);
    const contraction = easeInOutCubic(phase(progress, 0.05, 0.62));
    const ringFade = 1 - smoothstep(0.62, 0.94, progress);
    const contracted = closureEcho.closure.points.map((point) =>
      lerpVec2(point, centroid, contraction * 0.88),
    );

    for (const projection of closureEcho.projections.slice(1)) {
      const projectionCentroid = polygonCentroid(projection.points);
      const projectedPath = projection.points.map((point) =>
        lerpVec2(point, projectionCentroid, contraction * 0.88),
      );
      this.tracePath(graphics, projectedPath, true);
      graphics.stroke({
        color:
          closureEcho.imprintKind === 'symmetry'
            ? GAMEPLAY_COLORS.hostileCyan
            : GAMEPLAY_COLORS.bone,
        width: 5 - contraction * 2,
        alpha: ringFade * 0.68,
      });
    }

    if (closureEcho.imprintKind === 'blade') {
      const bladePulse = windowPulse(progress, 0.02, 0.48);
      for (const projection of closureEcho.projections) {
        this.tracePath(graphics, projection.points, true);
        graphics.stroke({
          color: GAMEPLAY_COLORS.arterialBright,
          width: closureEcho.bladeBandWidth * 2,
          alpha: bladePulse * 0.08,
        });
        this.tracePath(graphics, projection.points, true);
        graphics.stroke({
          color: GAMEPLAY_COLORS.bone,
          width: 2.5,
          alpha: bladePulse * 0.72,
        });
      }
    }

    // Closure: an immediate ivory seam confirms that the loop became lethal.
    if (flash > 0) {
      this.tracePath(graphics, closureEcho.closure.points, true);
      graphics.stroke({
        color: GAMEPLAY_COLORS.bone,
        width: 5 + flash * 5,
        alpha: flash * 0.78,
      });
      this.tracePath(graphics, closureEcho.closure.points, true);
      graphics.stroke({
        color: GAMEPLAY_COLORS.arterialBright,
        width: 2,
        alpha: flash,
      });
    }

    // Contraction: layered strokes read as one heavy living rope, not a UI line.
    this.tracePath(graphics, contracted, true);
    graphics
      .fill({
        color: GAMEPLAY_COLORS.arterial,
        alpha: ringFade * (0.07 + contraction * 0.07),
      })
      .stroke({
        color: GAMEPLAY_COLORS.void,
        width: 13 - contraction * 4,
        alpha: ringFade * 0.82,
      });
    this.tracePath(graphics, contracted, true);
    graphics.stroke({
      color: GAMEPLAY_COLORS.arterial,
      width: 8 - contraction * 3,
      alpha: ringFade * 0.92,
    });
    this.tracePath(graphics, contracted, true);
    graphics.stroke({
      color: GAMEPLAY_COLORS.bone,
      width: 2.4 - contraction * 0.8,
      alpha: ringFade * 0.88,
    });

    this.drawRingSpines(
      graphics,
      contracted,
      centroid,
      ringFade,
      contraction,
    );
    if (closureEcho.imprintKind === 'spike') {
      this.drawSpikeImprint(graphics, centroid, progress);
    }
    this.drawCapturedDrifterRemnants(
      graphics,
      closureEcho.capturedEnemies,
      centroid,
      player,
      progress,
    );
    this.drawLayeredCaptureEcho(graphics, closureEcho.capturedEnemies, progress);
    this.drawDecomposition(
      graphics,
      closureEcho.capturedEnemies.length === 0
        ? closureEcho.capturedPositions
        : closureEcho.capturedEnemies
            .filter((enemy) => enemy.captureLayer !== 'peeled')
            .map((enemy) => enemy.position),
      centroid,
      progress,
    );
    this.drawIntake(
      graphics,
      closureEcho.capturedPositions,
      centroid,
      player,
      progress,
    );

    const implosion = phase(progress, 0.43, 0.73);
    const implosionAlpha = windowPulse(progress, 0.36, 0.82);
    if (implosionAlpha > 0) {
      const radius = 52 * (1 - easeOutCubic(implosion)) + 6;
      graphics.circle(centroid.x, centroid.y, radius).stroke({
        color: GAMEPLAY_COLORS.arterialBright,
        width: 1.5 + (1 - implosion) * 2,
        alpha: implosionAlpha * 0.68,
      });
      graphics.circle(centroid.x, centroid.y, 3 + implosion * 7).fill({
        color: GAMEPLAY_COLORS.bone,
        alpha: implosionAlpha * 0.82,
      });
    }
  }

  private drawLayeredCaptureEcho(
    graphics: Graphics,
    enemies: readonly CapturedEnemyEchoView[],
    progress: number,
  ): void {
    const pulse = windowPulse(progress, 0.02, 0.62);
    if (pulse <= 0) {
      return;
    }

    for (const enemy of enemies) {
      if (
        enemy.archetype !== 'elite-husk' &&
        enemy.captureProfile !== 'armored'
      ) {
        continue;
      }
      if (enemy.captureLayer === 'peeled') {
        const radius = enemy.radius * (1.05 + easeOutCubic(progress) * 0.9);
        graphics.circle(enemy.position.x, enemy.position.y, radius).stroke({
          color: GAMEPLAY_COLORS.bone,
          width: 7 - progress * 4,
          alpha: pulse * 0.86,
        });
        const shardCount = enemy.archetype === 'elite-husk' ? 9 : 6;
        for (let index = 0; index < shardCount; index += 1) {
          const angle = enemy.phase + (index / shardCount) * Math.PI * 2;
          this.drawShard(
            graphics,
            {
              x: enemy.position.x + Math.cos(angle) * radius,
              y: enemy.position.y + Math.sin(angle) * radius,
            },
            angle,
            12,
            4,
            GAMEPLAY_COLORS.bone,
            pulse * 0.72,
          );
        }
      } else if (enemy.captureLayer === 'killed') {
        const radius = enemy.radius * (1.35 - easeInOutCubic(progress) * 1.05);
        graphics.circle(enemy.position.x, enemy.position.y, radius).stroke({
          color: GAMEPLAY_COLORS.arterialBright,
          width: 4 + (1 - progress) * 3,
          alpha: pulse * 0.92,
        });
        graphics.circle(enemy.position.x, enemy.position.y, 8 + progress * 12).fill({
          color: GAMEPLAY_COLORS.arterialBright,
          alpha: pulse * 0.54,
        });
      }
    }
  }

  private drawSpikeImprint(
    graphics: Graphics,
    centroid: Vec2,
    progress: number,
  ): void {
    const pulse = windowPulse(progress, 0.18, 0.68);
    if (pulse <= 0) {
      return;
    }

    const radius = 48 - easeInOutCubic(phase(progress, 0.18, 0.68)) * 30;
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2;
      const base = {
        x: centroid.x + Math.cos(angle) * radius,
        y: centroid.y + Math.sin(angle) * radius,
      };
      this.drawShard(
        graphics,
        base,
        angle + Math.PI,
        13,
        3,
        GAMEPLAY_COLORS.bone,
        pulse * 0.86,
      );
    }
  }

  private drawRingSpines(
    graphics: Graphics,
    points: readonly Vec2[],
    centroid: Vec2,
    alpha: number,
    contraction: number,
  ): void {
    const stride = Math.max(1, Math.ceil(points.length / 28));

    for (let index = 0; index < points.length; index += stride) {
      const point = points[index]!;
      const dx = point.x - centroid.x;
      const dy = point.y - centroid.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const angle = Math.atan2(dy, dx);
      const size = 4.5 + deterministicUnit(index, points.length) * 4;
      const base = {
        x: point.x + (dx / distance) * 1.5,
        y: point.y + (dy / distance) * 1.5,
      };

      this.drawShard(
        graphics,
        base,
        angle,
        size * (1 - contraction * 0.22),
        3.2,
        GAMEPLAY_COLORS.bone,
        alpha * 0.9,
      );
    }
  }

  private drawCapturedDrifterRemnants(
    graphics: Graphics,
    capturedEnemies: readonly CapturedEnemyEchoView[],
    centroid: Vec2,
    player: Vec2,
    progress: number,
  ): void {
    capturedEnemies.forEach((enemy, enemyIndex) => {
      if (enemy.captureLayer === 'peeled') {
        return;
      }
      const stagger = Math.min(0.08, enemyIndex * 0.012);
      const tear = easeInOutCubic(
        phase(progress, 0.1 + stagger, 0.56 + stagger),
      );
      const proceduralReveal = this.drifterTexture === null
        ? 1
        : smoothstep(
            CAPTURE_RASTER_HOLD_END,
            CAPTURE_RASTER_FADE_END,
            progress,
          );
      const fade =
        proceduralReveal *
        (1 -
          smoothstep(
            0.3 + stagger,
            0.66 + stagger,
            progress,
          ));

      if (fade <= 0) {
        return;
      }

      this.drawCapturedDrifterRemnant(
        graphics,
        enemy,
        centroid,
        player,
        tear,
        fade,
      );
    });
  }

  private drawCapturedDrifterRemnant(
    graphics: Graphics,
    enemy: CapturedEnemyEchoView,
    centroid: Vec2,
    player: Vec2,
    tear: number,
    alpha: number,
  ): void {
    const radius = enemy.radius;
    const angle =
      Math.atan2(
        player.y - enemy.position.y,
        player.x - enemy.position.x,
      ) +
      Math.sin(enemy.phase * 1.9) * 0.055;
    const pulledCenter = lerpVec2(
      enemy.position,
      centroid,
      easeInCubic(tear) * 0.28,
    );

    graphics
      .ellipse(
        pulledCenter.x,
        pulledCenter.y + radius * 0.66,
        radius * (1.15 - tear * 0.22),
        radius * 0.4,
      )
      .fill({
        color: GAMEPLAY_COLORS.void,
        alpha: alpha * (0.5 - tear * 0.22),
      });

    for (const side of [-1, 1] as const) {
      const pieceCenter = this.localPoint(
        pulledCenter,
        angle,
        -tear * radius * (side > 0 ? 0.08 : 0.02),
        side * tear * radius * 0.56,
      );
      const limbPull = this.localPoint(
        pieceCenter,
        angle,
        -tear * radius * 0.18,
        side * tear * radius * 0.34,
      );
      const rearLimb = [
        this.localPoint(
          pieceCenter,
          angle,
          -radius * 0.3,
          side * radius * 0.38,
        ),
        this.localPoint(
          limbPull,
          angle,
          -radius * 0.88,
          side * radius * 0.7,
        ),
        this.localPoint(
          limbPull,
          angle,
          -radius * 1.04,
          side * radius * 1.02,
        ),
      ];
      const foreLimb = [
        this.localPoint(
          pieceCenter,
          angle,
          radius * 0.08,
          side * radius * 0.48,
        ),
        this.localPoint(
          limbPull,
          angle,
          -radius * 0.02,
          side * radius * 0.94,
        ),
        this.localPoint(
          limbPull,
          angle,
          radius * 0.46,
          side * radius * 1.2,
        ),
      ];
      this.drawRemnantLimb(
        graphics,
        rearLimb,
        radius * 0.2,
        alpha * (1 - tear * 0.5),
      );
      this.drawRemnantLimb(
        graphics,
        foreLimb,
        radius * 0.22,
        alpha * (1 - tear * 0.42),
      );

      const torsoHalf = side < 0
        ? [
            this.localPoint(pieceCenter, angle, radius * 0.62, 0),
            this.localPoint(
              pieceCenter,
              angle,
              radius * 0.25,
              -radius * 0.56,
            ),
            this.localPoint(
              pieceCenter,
              angle,
              -radius * 0.56,
              -radius * 0.49,
            ),
            this.localPoint(
              pieceCenter,
              angle,
              -radius * 0.8,
              -radius * 0.02,
            ),
            this.localPoint(pieceCenter, angle, -radius * 0.18, 0),
          ]
        : [
            this.localPoint(pieceCenter, angle, radius * 0.62, 0),
            this.localPoint(pieceCenter, angle, -radius * 0.18, 0),
            this.localPoint(
              pieceCenter,
              angle,
              -radius * 0.8,
              radius * 0.04,
            ),
            this.localPoint(
              pieceCenter,
              angle,
              -radius * 0.5,
              radius * 0.48,
            ),
            this.localPoint(
              pieceCenter,
              angle,
              radius * 0.25,
              radius * 0.52,
            ),
          ];
      this.tracePath(graphics, torsoHalf, true);
      graphics
        .fill({
          color: GAMEPLAY_COLORS.tendon,
          alpha: alpha * (0.68 - tear * 0.24),
        })
        .stroke({
          color: GAMEPLAY_COLORS.void,
          width: 4.5,
          alpha: alpha * 0.88,
        });
      this.tracePath(graphics, torsoHalf, true);
      graphics.stroke({
        color: GAMEPLAY_COLORS.bone,
        width: 1,
        alpha: alpha * (0.44 - tear * 0.18),
      });

      const tornSeam = this.localPoint(
        pieceCenter,
        angle,
        -radius * 0.1,
        -side * radius * 0.02,
      );
      const coreTarget = lerpVec2(pulledCenter, centroid, tear * 0.48);
      graphics
        .moveTo(tornSeam.x, tornSeam.y)
        .lineTo(coreTarget.x, coreTarget.y)
        .stroke({
          color: GAMEPLAY_COLORS.arterialBright,
          width: 1.2 + tear * 0.8,
          alpha: alpha * (0.28 + tear * 0.52),
        });
    }

    const headBase = this.localPoint(
      pulledCenter,
      angle,
      radius * (0.74 + tear * 0.18),
      -tear * radius * 0.14,
    );
    const skull = [
      this.localPoint(headBase, angle, radius * 0.45, 0),
      this.localPoint(headBase, angle, 0, -radius * 0.38),
      this.localPoint(headBase, angle, -radius * 0.24, -radius * 0.2),
      this.localPoint(headBase, angle, -radius * 0.17, radius * 0.25),
      this.localPoint(headBase, angle, radius * 0.06, radius * 0.32),
    ];
    this.tracePath(graphics, skull, true);
    graphics
      .fill({
        color: GAMEPLAY_COLORS.bone,
        alpha: alpha * (0.76 - tear * 0.18),
      })
      .stroke({
        color: GAMEPLAY_COLORS.void,
        width: 1.8,
        alpha: alpha * 0.84,
      });

    const core = lerpVec2(pulledCenter, centroid, tear * 0.62);
    const coreScale = Math.max(0.18, 1 - tear * 0.78);
    graphics.circle(core.x, core.y, radius * 0.38 * coreScale).fill({
      color: GAMEPLAY_COLORS.hostileCyan,
      alpha: alpha * (0.16 + (1 - tear) * 0.16),
    });
    const coreDiamond = [
      this.localPoint(core, angle, radius * 0.28 * coreScale, 0),
      this.localPoint(core, angle, 0, radius * 0.2 * coreScale),
      this.localPoint(core, angle, -radius * 0.28 * coreScale, 0),
      this.localPoint(core, angle, 0, -radius * 0.2 * coreScale),
    ];
    this.tracePath(graphics, coreDiamond, true);
    graphics
      .fill({
        color: GAMEPLAY_COLORS.hostileCyan,
        alpha: alpha * (0.86 - tear * 0.46),
      })
      .stroke({
        color: GAMEPLAY_COLORS.bone,
        width: 0.9,
        alpha: alpha * (0.45 - tear * 0.18),
      });
  }

  private drawRemnantLimb(
    graphics: Graphics,
    points: readonly Vec2[],
    width: number,
    alpha: number,
  ): void {
    this.tracePath(graphics, points, false);
    graphics.stroke({
      color: GAMEPLAY_COLORS.void,
      width: width + 2.8,
      alpha: alpha * 0.84,
    });
    this.tracePath(graphics, points, false);
    graphics.stroke({
      color: GAMEPLAY_COLORS.tendon,
      width,
      alpha: alpha * 0.76,
    });

    const last = points.at(-1);
    const previous = points.at(-2);
    if (last !== undefined && previous !== undefined) {
      this.drawShard(
        graphics,
        last,
        Math.atan2(last.y - previous.y, last.x - previous.x),
        width * 1.9,
        width * 0.62,
        GAMEPLAY_COLORS.bone,
        alpha * 0.78,
      );
    }
  }

  private drawDecomposition(
    graphics: Graphics,
    capturedPositions: readonly Vec2[],
    centroid: Vec2,
    progress: number,
  ): void {
    capturedPositions.forEach((position, enemyIndex) => {
      const stagger = Math.min(0.08, enemyIndex * 0.012);
      const decomposition = phase(progress, 0.17 + stagger, 0.68 + stagger);
      const tissueAlpha = windowPulse(
        progress,
        0.13 + stagger,
        0.72 + stagger,
      );

      if (tissueAlpha <= 0) {
        return;
      }

      const pull = easeInOutCubic(decomposition);
      const knot = lerpVec2(position, centroid, pull * 0.72);
      const coreRadius = 13 * (1 - pull) + 2;
      graphics.circle(knot.x, knot.y, coreRadius + 5).fill({
        color: GAMEPLAY_COLORS.void,
        alpha: tissueAlpha * 0.7,
      });
      graphics.circle(knot.x, knot.y, coreRadius).fill({
        color: GAMEPLAY_COLORS.arterial,
        alpha: tissueAlpha * 0.86,
      });

      for (let filamentIndex = 0; filamentIndex < 3; filamentIndex += 1) {
        const filamentProgress = phase(
          progress,
          0.2 + stagger + filamentIndex * 0.018,
          0.62 + stagger,
        );
        this.drawFilament(
          graphics,
          position,
          centroid,
          filamentProgress,
          enemyIndex * 5 + filamentIndex,
          tissueAlpha,
        );
      }

      for (let shardIndex = 0; shardIndex < 7; shardIndex += 1) {
        const seed = enemyIndex * 31 + shardIndex * 7;
        const radialAngle =
          Math.atan2(position.y - centroid.y, position.x - centroid.x) +
          (deterministicUnit(seed, 17) - 0.5) * 2.3;
        const travel =
          Math.sin(Math.PI * decomposition) *
          (14 + deterministicUnit(seed, 29) * 25);
        const shardPosition = {
          x: position.x + Math.cos(radialAngle) * travel,
          y: position.y + Math.sin(radialAngle) * travel,
        };
        const boneShard = shardIndex % 3 === 0;

        this.drawShard(
          graphics,
          shardPosition,
          radialAngle + decomposition * 2.8,
          boneShard ? 8 : 5,
          boneShard ? 4 : 3,
          boneShard ? GAMEPLAY_COLORS.bone : GAMEPLAY_COLORS.arterialBright,
          tissueAlpha * (1 - decomposition * 0.55),
        );
      }
    });
  }

  private drawFilament(
    graphics: Graphics,
    start: Vec2,
    target: Vec2,
    progress: number,
    seed: number,
    alpha: number,
  ): void {
    if (progress <= 0) {
      return;
    }

    const end = lerpVec2(start, target, easeOutCubic(progress));
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const normalX = -dy / length;
    const normalY = dx / length;
    const bend = (deterministicUnit(seed, 43) - 0.5) * 18;
    const segments = 5;

    graphics.moveTo(start.x, start.y);
    for (let segment = 1; segment <= segments; segment += 1) {
      const amount = segment / segments;
      const wave = Math.sin(amount * Math.PI) * bend;
      graphics.lineTo(
        start.x + dx * amount + normalX * wave,
        start.y + dy * amount + normalY * wave,
      );
    }
    graphics.stroke({
      color: GAMEPLAY_COLORS.arterialBright,
      width: 1.2 + (seed % 3) * 0.45,
      alpha: alpha * (0.42 + progress * 0.42),
    });
  }

  private drawIntake(
    graphics: Graphics,
    capturedPositions: readonly Vec2[],
    centroid: Vec2,
    player: Vec2,
    progress: number,
  ): void {
    const intake = phase(progress, 0.47, 1);
    if (intake <= 0) {
      return;
    }

    const particleCount = Math.min(24, 8 + capturedPositions.length * 3);
    for (let index = 0; index < particleCount; index += 1) {
      const delay = deterministicUnit(index, 61) * 0.42;
      const particleProgress = clamp01((intake - delay) / (1 - delay));
      if (particleProgress <= 0 || particleProgress >= 1) {
        continue;
      }

      const source = capturedPositions[index % capturedPositions.length] ?? centroid;
      const start = lerpVec2(source, centroid, 0.76);
      const seed = index * 13 + capturedPositions.length * 17;
      const angle = deterministicUnit(seed, 79) * Math.PI * 2;
      const radius = 5 + deterministicUnit(seed, 83) * 19;
      const scatteredStart = {
        x: start.x + Math.cos(angle) * radius,
        y: start.y + Math.sin(angle) * radius,
      };
      const eased = easeInCubic(particleProgress);
      const position = lerpVec2(scatteredStart, player, eased);
      const previous = lerpVec2(
        scatteredStart,
        player,
        easeInCubic(Math.max(0, particleProgress - 0.09)),
      );
      const alpha = Math.sin(particleProgress * Math.PI) * 0.92;
      const boneParticle = index % 4 === 0;

      graphics.moveTo(previous.x, previous.y).lineTo(position.x, position.y).stroke({
        color: boneParticle
          ? GAMEPLAY_COLORS.bone
          : GAMEPLAY_COLORS.arterialBright,
        width: boneParticle ? 2.2 : 1.5,
        alpha: alpha * 0.68,
      });
      graphics.circle(position.x, position.y, boneParticle ? 2.8 : 2).fill({
        color: boneParticle
          ? GAMEPLAY_COLORS.bone
          : GAMEPLAY_COLORS.arterialBright,
        alpha,
      });
    }

    const arrival = phase(progress, 0.78, 1);
    if (arrival > 0) {
      const pulse = Math.sin(arrival * Math.PI);
      graphics.circle(player.x, player.y, 11 + arrival * 18).stroke({
        color: GAMEPLAY_COLORS.bone,
        width: 2,
        alpha: pulse * 0.55,
      });
      graphics.circle(player.x, player.y, 5 + pulse * 5).fill({
        color: GAMEPLAY_COLORS.arterialBright,
        alpha: pulse * 0.5,
      });
    }
  }

  private drawShard(
    graphics: Graphics,
    position: Vec2,
    angle: number,
    length: number,
    width: number,
    color: number,
    alpha: number,
  ): void {
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    const normalX = -directionY;
    const normalY = directionX;
    const tip = {
      x: position.x + directionX * length,
      y: position.y + directionY * length,
    };
    const base = {
      x: position.x - directionX * length * 0.35,
      y: position.y - directionY * length * 0.35,
    };

    graphics
      .moveTo(tip.x, tip.y)
      .lineTo(base.x + normalX * width, base.y + normalY * width)
      .lineTo(base.x - normalX * width, base.y - normalY * width)
      .closePath()
      .fill({ color, alpha });
  }

  private tracePath(
    graphics: Graphics,
    points: readonly Vec2[],
    closed: boolean,
  ): void {
    const first = points[0];
    if (first === undefined) {
      return;
    }

    graphics.moveTo(first.x, first.y);
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index]!;
      graphics.lineTo(point.x, point.y);
    }

    if (closed) {
      graphics.closePath();
    }
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function phase(progress: number, start: number, end: number): number {
  return clamp01((progress - start) / Math.max(0.0001, end - start));
}

function smoothstep(start: number, end: number, value: number): number {
  const amount = phase(value, start, end);
  return amount * amount * (3 - 2 * amount);
}

function windowPulse(progress: number, start: number, end: number): number {
  const midpoint = (start + end) * 0.5;
  return progress <= midpoint
    ? smoothstep(start, midpoint, progress)
    : 1 - smoothstep(midpoint, end, progress);
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

function easeInCubic(value: number): number {
  return value ** 3;
}

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value ** 3
    : 1 - (-2 * value + 2) ** 3 / 2;
}

function deterministicUnit(seedA: number, seedB: number): number {
  const value = Math.sin(seedA * 12.9898 + seedB * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
