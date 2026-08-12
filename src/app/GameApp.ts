import type { RendererHost } from '../presentation/RendererHost';
import {
  nextAudioVolumeStep,
  PlaygroundAudio,
} from '../audio/PlaygroundAudio';
import type { EnemyArchetype, EnemyImprintKind } from '../content/enemies';
import { captureProfileForDrifterSpawn } from '../content/armoredDrifters';
import type { FullRunEnemyArchetype } from '../content/fullRunEnemies';
import {
  APEX_MUTATION_ID,
  LINEAGE_MUTATION_IDS,
  MUTATION_IDS,
  type MutationEffect,
  type MutationId,
} from '../content/mutations';
import { PLAYGROUND_TUNING } from '../config/graphics';
import { PROGRESSION_BASELINE } from '../config/progression';
import {
  QUARANTINE_WORLD_BOUNDS,
  QUARANTINE_WORLD_START,
  WORLD_TUNING,
} from '../config/world';
import { findFreePosition, resolveCircleColliders } from '../core/geometry/collision';
import type { Vec2 } from '../core/geometry/vector';
import { QUARANTINE_COLLIDERS } from '../content/quarantineColliders';
import { SeededRandom } from '../core/random/SeededRandom';
import {
  WardenModel,
  type WardenAction,
  type WardenCaptureResult,
  type WardenStage,
} from '../game/boss/WardenModel';
import {
  EnemyModel,
  type EnemyArenaBounds,
} from '../game/enemies/EnemyModel';
import { CutterModel } from '../game/enemies/CutterModel';
import { EliteHuskModel } from '../game/enemies/EliteHuskModel';
import { MimicModel } from '../game/enemies/MimicModel';
import {
  ProjectileModel,
  type ProjectileStepResult,
} from '../game/enemies/ProjectileModel';
import {
  LoopPath,
  type LoopClosure,
  type LoopClosureKind,
  type LoopPreview,
} from '../game/loop/LoopPath';
import { classifyLoopAttackPoint } from '../game/loop/LoopAttackGeometry';
import { projectLoopClosure } from '../game/loop/LoopProjection';
import { PlayerVitals } from '../game/player/PlayerVitals';
import { Experience } from '../game/progression/Experience';
import { ImprintState } from '../game/progression/ImprintState';
import {
  MutationDraft,
  type MutationCandidate,
} from '../game/progression/MutationDraft';
import { ChoiceClock } from '../game/run/ChoiceClock';
import {
  RunFlow,
  type RunOutcome,
  type RunResult,
  type RunResultInput,
  type RunScene,
} from '../game/run/RunFlow';
import { FullRunWaveDirector } from '../game/waves/FullRunWaveDirector';
import {
  Camera2D,
  cameraViewportForScreen,
} from '../game/world/Camera2D';
import { selectOffscreenSpawnRegion } from '../game/world/WorldSpawnRegion';

/** Body radii used only to validate spawn points against street colliders. */
const SPAWN_BODY_RADII: Readonly<Record<FullRunEnemyArchetype, number>> =
  Object.freeze({
    drifter: 20,
    rusher: 16,
    watcher: 22,
    cutter: 20,
    mimic: 18,
    'elite-husk': 34,
  });
import {
  TutorialDirector,
  type TutorialStep,
} from '../game/tutorial/TutorialDirector';
import {
  LoopInputController,
  type LoopInputMode,
} from '../input/LoopInputController';
import { KeyboardInputAdapter } from '../input/KeyboardInputAdapter';
import { PointerInputAdapter } from '../input/PointerInputAdapter';
import type { ChoiceIndex, InputIntent } from '../input/InputIntent';
import type {
  CapturedEnemyEchoView,
  PlaygroundEnemyView,
  WardenAttackEchoView,
} from '../presentation/RenderState';
import { classifyCaptureFeedback } from '../presentation/CaptureFeedback';

export interface GameStatus {
  readonly state:
    | 'title'
    | 'idle'
    | 'drawing'
    | 'valid'
    | 'success'
    | 'armor-peeled'
    | 'miss'
    | 'hurt'
    | 'dead'
    | 'mutation'
     | 'imprint'
     | 'complete'
     | 'warden-arrival'
     | 'warden-arms'
     | 'warden-shell'
     | 'warden-core'
     | 'ending'
     | 'victory';
  readonly captured: number;
  readonly loopArea: number;
  readonly closureKind: LoopClosureKind | null;
  readonly inputMode: LoopInputMode;
  readonly hp: number;
  readonly maxHp: number;
  readonly level: number;
  readonly xp: number;
  readonly xpForNextLevel: number;
  readonly pendingLevelChoices: number;
  readonly unspentChoices: number;
  readonly activeImprint: EnemyImprintKind | null;
  readonly imprintSeconds: number;
  readonly imprintCandidates: readonly EnemyImprintKind[];
  readonly mutationCandidates: readonly MutationCandidate[];
  readonly runSeconds: number;
  readonly runSeed: number;
  readonly runComplete: boolean;
  readonly runScene: RunScene;
  readonly runResult: RunResult | null;
  readonly wardenStage: WardenStage | null;
  readonly wardenProgress: number;
  readonly wardenProgressRequired: number;
  readonly wardenSeconds: number;
  readonly tutorialStep: TutorialStep;
  readonly tutorialPrompt: string;
  readonly tutorialAssist: boolean;
  readonly tutorialComplete: boolean;
  readonly decisionMode: 'none' | 'slow' | 'paused';
  readonly reducedMotion: boolean;
  readonly reducedFlash: boolean;
  readonly masterVolume: number;
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly hint: string;
}

export type AudioChannel = 'master' | 'music' | 'sfx';

export type GameQaScene =
  | 'enemy-gallery'
  | 'exposed-armored'
  | 'mutation'
  | 'imprint'
  | 'warden-arrival'
  | 'warden-arms'
  | 'warden-shell'
  | 'warden-core'
  | 'victory';

export interface GameAppOptions {
  /** Development-only representative state. Production never supplies it. */
  readonly qaScene?: GameQaScene;
}

interface MutableClosureEcho {
  readonly closure: LoopClosure;
  readonly projections: readonly LoopClosure[];
  readonly captured: number;
  readonly capturedEnemies: readonly CapturedEnemyEchoView[];
  readonly capturedPositions: readonly Vec2[];
  readonly imprintKind: EnemyImprintKind | null;
  readonly bladeBandWidth: number;
  age: number;
}

const RUN_SEED = 0xf1e5_1009;
interface EnemySeed {
  readonly archetype: EnemyArchetype;
  readonly u: number;
  readonly v: number;
  readonly phase: number;
}

interface CombatStepResult {
  readonly projectileHits: readonly Extract<
    ProjectileStepResult,
    { kind: 'hit' }
  >[];
  readonly loopCutPosition: Vec2 | null;
}

interface WardenCapturePresentation {
  readonly capturedEnemies: readonly CapturedEnemyEchoView[];
  readonly capturedPositions: readonly Vec2[];
  readonly capturedCount: number;
}

interface MutableLoopCutEcho {
  readonly position: Vec2;
  age: number;
}

interface MutableWardenAttackEcho extends WardenAttackEchoView {
  age: number;
}

const INITIAL_ENEMY_SEEDS: readonly EnemySeed[] = Object.freeze([
  { archetype: 'drifter', u: 0.24, v: 0.32, phase: 0.2 },
  { archetype: 'drifter', u: 0.76, v: 0.32, phase: 1.4 },
]);

export class GameApp {
  private canvas: HTMLCanvasElement | null = null;
  private readonly audio = new PlaygroundAudio();
  private readonly camera = new Camera2D({
    bounds: QUARANTINE_WORLD_BOUNDS,
    viewportWidth: 1,
    viewportHeight: 1,
    deadZoneRatioX: WORLD_TUNING.cameraDeadZoneRatioX,
    deadZoneRatioY: WORLD_TUNING.cameraDeadZoneRatioY,
    followSharpness: WORLD_TUNING.cameraFollowSharpness,
  });
  private readonly keyboard = new KeyboardInputAdapter();
  private readonly pointer = new PointerInputAdapter();
  private readonly runFlow = new RunFlow(RUN_SEED);
  private mutationRandom = new SeededRandom(RUN_SEED);
  private waveRandom = new SeededRandom(RUN_SEED ^ 0xa51c_0de5);
  private readonly vitals = new PlayerVitals({
    maxHp: PROGRESSION_BASELINE.maxHp,
    contactInvulnerabilitySeconds: 0.65,
  });
  private readonly experience = new Experience({
    firstThreshold: 30,
    thresholdGrowth: 1.4,
  });
  private readonly imprint = new ImprintState(
    PROGRESSION_BASELINE.imprintDurationSeconds,
  );
  private mutationDraft = this.createMutationDraft();
  private readonly waveDirector = new FullRunWaveDirector({
    random: () => this.waveRandom.next(),
  });
  private readonly tutorial = new TutorialDirector();
  private readonly choiceClock = new ChoiceClock();
  private readonly loopInput = new LoopInputController('toggle');
  private loopPath = this.createLoopPath();
  private enemies: EnemyModel[] = [];
  private cutters: CutterModel[] = [];
  private mimics: MimicModel[] = [];
  private eliteHusks: EliteHuskModel[] = [];
  private projectiles: ProjectileModel[] = [];
  private warden: WardenModel | null = null;
  private wardenArenaBounds: EnemyArenaBounds | null = null;
  private nextProjectileId = 1;
  private postCheckpointDrifterSequence = 0;

  private player = { x: 0, y: 0 };
  private playerVelocity = { x: 0, y: 0 };
  private presentationElapsed = 0;
  private captured = 0;
  private closureEcho: MutableClosureEcho | null = null;
  private loopCutEcho: MutableLoopCutEcho | null = null;
  private wardenAttackEcho: MutableWardenAttackEcho | null = null;
  private feedbackState: GameStatus['state'] = 'idle';
  private feedbackTime = 0;
  private lastStatusSignature = '';
  private closureReadyCue: LoopClosureKind | null = null;
  private started = false;
  private lineageUnlocked = false;
  private apexQueued = false;
  private readonly gatheredImprints = new Set<EnemyImprintKind>();
  private unspentChoicesAtTransition = 0;
  private reducedMotion = false;
  private reducedFlash = false;

  public constructor(
    private readonly onStatus: (status: GameStatus) => void,
    private readonly rendererHost: RendererHost,
    private readonly options: GameAppOptions = {},
  ) {}

  public async start(host: HTMLElement): Promise<void> {
    this.canvas = await this.rendererHost.init(host);

    this.reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    this.canvas.className = 'game-canvas';
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-label', 'FLESHLOOM 격리구역 사냥 화면');
    this.started = true;
    void this.rendererHost.loadDeferredAssets().catch(() => undefined);

    this.player = {
      x: QUARANTINE_WORLD_START.x,
      y: QUARANTINE_WORLD_START.y,
    };
    this.syncCameraViewport();
    this.camera.setBounds(QUARANTINE_WORLD_BOUNDS);
    this.camera.jumpTo(this.player);
    this.configureRunSeed(this.runFlow.snapshot.runSeed);
    this.playerVelocity = { x: 0, y: 0 };
    this.lineageUnlocked = false;
    this.apexQueued = false;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    this.canvas.addEventListener('pointerdown', this.focusCanvas);
    this.rendererHost.addFrameListener(this.update);

    if (import.meta.env.DEV) {
      // Dev-only QA hook: renders the current viewport on demand and returns
      // a base64 PNG. Headless capture uses this because SwiftShader
      // compositing never surfaces frames from the saturated game loop. Dead
      // code in production builds, like qaScene.
      (window as unknown as Record<string, unknown>).__fleshloomQa = {
        screenshot: () => this.rendererHost.captureViewport(),
      };
    }
    if (this.started) {
      this.canvas?.focus();
    }
    this.draw(null);
    this.publishStatus('title', 0, null);
  }

  public setLoopInputMode(mode: LoopInputMode): void {
    this.audio.unlock();
    this.keyboard.reset();
    this.pointer.reset();
    this.loopInput.setMode(mode);
    this.loopPath.cancel();
    this.feedbackState = 'idle';
    this.feedbackTime = 0;
    this.closureReadyCue = null;
    this.lastStatusSignature = '';
    this.publishStatus('idle', 0, null);
    if (this.started) {
      this.canvas?.focus();
    }
  }

  public chooseDecision(index: ChoiceIndex): void {
    this.audio.unlock();
    this.pointer.choiceButtonPress(index);
    if (this.started) {
      this.canvas?.focus();
    }
  }

  public beginPointerMove(pointerId: number, x: number, y: number): void {
    this.audio.unlock();
    this.pointer.movementPointerDown(pointerId, x, y);
  }

  public movePointer(pointerId: number, x: number, y: number): void {
    this.pointer.pointerMove(pointerId, x, y);
  }

  public endPointer(pointerId: number): void {
    this.pointer.pointerUp(pointerId);
  }

  public cancelPointer(pointerId: number): void {
    this.pointer.pointerCancel(pointerId);
  }

  public beginPointerLoop(pointerId: number): void {
    this.audio.unlock();
    this.pointer.loopButtonDown(pointerId);
  }

  public endPointerLoop(pointerId: number): void {
    this.pointer.loopButtonUp(pointerId);
  }

  public requestPointerRestart(): void {
    this.pointer.restartButtonPress();
  }

  public requestStartRun(): void {
    this.audio.unlock();
    if (!this.runFlow.startNewRun()) {
      return;
    }
    this.configureRunSeed(this.runFlow.snapshot.runSeed);
    this.resetGameplayState();
  }

  public requestReturnToTitle(): void {
    if (!this.runFlow.returnToTitle()) {
      return;
    }
    this.clearTransientInput();
    this.enemies = [];
    this.cutters = [];
    this.mimics = [];
    this.eliteHusks = [];
    this.projectiles = [];
    this.warden = null;
    this.wardenArenaBounds = null;
    this.camera.setBounds(QUARANTINE_WORLD_BOUNDS);
    this.closureEcho = null;
    this.loopCutEcho = null;
    this.wardenAttackEcho = null;
    this.lastStatusSignature = '';
    this.draw(null);
    this.publishStatus('title', 0, null);
  }

  public toggleReducedMotion(): void {
    this.reducedMotion = !this.reducedMotion;
    this.refreshPublishedStatus();
  }

  public toggleReducedFlash(): void {
    this.reducedFlash = !this.reducedFlash;
    this.refreshPublishedStatus();
  }

  public cycleAudioVolume(channel: AudioChannel): void {
    const next = nextAudioVolumeStep(this.audio.mix[channel]);
    this.audio.setMix({ ...this.audio.mix, [channel]: next });
    this.audio.unlock();
    this.refreshPublishedStatus();
  }

  private readonly focusCanvas = (): void => {
    this.canvas?.focus();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (
      event.target instanceof HTMLButtonElement &&
      (event.code === 'Enter' ||
        event.code === 'NumpadEnter' ||
        event.code === 'Space')
    ) {
      this.audio.unlock();
      return;
    }
    if (!this.keyboard.keyDown(event.code)) {
      return;
    }

    event.preventDefault();
    this.audio.unlock();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (
      event.target instanceof HTMLButtonElement &&
      (event.code === 'Enter' ||
        event.code === 'NumpadEnter' ||
        event.code === 'Space')
    ) {
      return;
    }
    if (!this.keyboard.keyUp(event.code)) {
      return;
    }

    event.preventDefault();
  };

  private readonly handleBlur = (): void => {
    this.keyboard.reset();
    this.pointer.blur();
    this.loopInput.reset();
    this.loopPath.cancel();
    this.closureReadyCue = null;
    this.feedbackState = 'idle';
  };

  private resolvePendingDecision(
    intent: InputIntent,
    requestedChoice: ChoiceIndex | null,
  ): 'mutation' | 'imprint' | null {
    const mutationCandidates = this.mutationDraft.snapshot.candidates;
    if (mutationCandidates.length > 0) {
      const choice = requestedChoice ?? (intent.confirmPressed ? 0 : null);
      const candidate = choice === null ? undefined : mutationCandidates[choice];

      if (candidate !== undefined) {
        const result = this.mutationDraft.select(candidate.id);
        if (result.kind === 'selected') {
          this.applyMutationEffects(result.candidate.effects);
          this.experience.resolvePendingChoice();
          this.audio.playEvolution();
          this.clearTransientInput();
          this.updateFullRunUnlocks();
          this.ensureMutationDraft();
        }
      }
      return 'mutation';
    }

    const imprint = this.imprint.snapshot;
    if (imprint.candidates.length > 0) {
      const choice = requestedChoice ?? (intent.confirmPressed ? 0 : null);
      const candidate = choice === null ? undefined : imprint.candidates[choice];
      let resolved = false;

      if (candidate !== undefined) {
        this.imprint.replace(candidate);
        this.audio.playImprint(candidate);
        this.clearTransientInput();
        resolved = true;
      } else if (
        imprint.active !== null &&
        (choice === 2 || intent.cancelPressed)
      ) {
        this.imprint.keep();
        this.audio.playImprint(imprint.active.kind);
        this.clearTransientInput();
        resolved = true;
      }

      if (resolved) {
        this.choiceClock.closeImprint();
        return 'imprint';
      }
      return this.choiceClock.snapshot(false, true).mode === 'paused'
        ? 'imprint'
        : null;
    }

    return null;
  }

  private clearTransientInput(): void {
    this.keyboard.reset();
    this.pointer.reset();
    this.loopInput.reset();
    this.loopPath.cancel();
    this.closureReadyCue = null;
  }

  private settleChoicesForRunTransition(): void {
    if (this.imprint.snapshot.candidates.length > 0) {
      this.imprint.keep();
    }
    this.mutationDraft.dismiss();
    this.unspentChoicesAtTransition +=
      this.experience.discardPendingChoices();
    this.choiceClock.closeImprint();
  }

  private beginWardenEncounter(): void {
    this.settleChoicesForRunTransition();
    this.runFlow.beginWarden();
    this.wardenArenaBounds = this.createWardenArenaBounds();
    this.camera.setBounds(this.wardenArenaBounds);
    this.camera.jumpTo(this.player);
    this.warden = new WardenModel({ id: 'warden-prototype', phase: 0.36 });
    this.warden.begin();
    this.warden.step(0.001, {
      playerPosition: this.player,
      bounds: this.wardenArenaBounds,
    });
    this.audio.playWardenArrival();
    this.enemies = [];
    this.cutters = [];
    this.mimics = [];
    this.eliteHusks = [];
    this.projectiles = [];
    this.wardenAttackEcho = null;
    this.clearTransientInput();
    this.feedbackState = 'warden-arrival';
    this.feedbackTime = 1.2;
  }

  private resolveWardenActions(actions: readonly WardenAction[]): void {
    for (const action of actions) {
      if (action.type === 'warden-collapse-complete') {
        continue;
      }

      this.wardenAttackEcho = {
        kind: action.type === 'warden-lash' ? 'lash' : 'discharge',
        geometry: action.geometry,
        age: 0,
      };
      this.audio.playWardenAttack(action.type);

      const hit =
        action.geometry.kind === 'corridor'
          ? this.pointSegmentDistance(
              this.player,
              action.geometry.start,
              action.geometry.end,
            ) <=
            action.geometry.halfWidth + PLAYGROUND_TUNING.playerRadius
          : Math.abs(
              Math.hypot(
                this.player.x - action.geometry.center.x,
                this.player.y - action.geometry.center.y,
              ) - action.geometry.radius,
            ) <=
            action.geometry.halfWidth + PLAYGROUND_TUNING.playerRadius;
      if (!hit) {
        continue;
      }

      const result = this.vitals.damage(
        action.damage,
        `${action.sourceId}:${action.type}:${this.warden?.snapshot.encounterElapsed ?? 0}`,
      );
      if (result.kind !== 'ignored') {
        this.applyDamageFeedback(result.kind === 'death');
        return;
      }
    }
  }

  private pointSegmentDistance(point: Vec2, start: Vec2, end: Vec2): number {
    const segmentX = end.x - start.x;
    const segmentY = end.y - start.y;
    const lengthSquared = segmentX * segmentX + segmentY * segmentY;
    if (lengthSquared <= 1e-9) {
      return Math.hypot(point.x - start.x, point.y - start.y);
    }
    const amount = Math.min(
      1,
      Math.max(
        0,
        ((point.x - start.x) * segmentX +
          (point.y - start.y) * segmentY) /
          lengthSquared,
      ),
    );
    return Math.hypot(
      point.x - (start.x + segmentX * amount),
      point.y - (start.y + segmentY * amount),
    );
  }

  private finishDeathFlow(): void {
    this.runFlow.finishDeath(this.createRunResult('death'));
  }

  private createRunResult(outcome: RunOutcome): RunResultInput {
    const ranks = this.mutationDraft.snapshot.ranks;
    return {
      outcome,
      huntSeconds: this.waveDirector.snapshot.elapsedSeconds,
      wardenSeconds: this.warden?.snapshot.encounterElapsed ?? 0,
      captured: this.captured,
      level: this.experience.snapshot.level,
      activeImprint: this.imprint.snapshot.active?.kind ?? null,
      mutations: MUTATION_IDS.flatMap((id) =>
        ranks[id] > 0 ? [{ id, rank: ranks[id] }] : [],
      ),
      fourfold: ranks[APEX_MUTATION_ID] > 0,
      unspentChoices: this.unspentChoicesAtTransition,
    };
  }

  private ensureMutationDraft(): boolean {
    const hadCandidates = this.mutationDraft.snapshot.candidates.length > 0;
    while (this.experience.snapshot.pendingChoices > 0) {
      const draft = this.mutationDraft.draft();
      if (draft.kind !== 'empty') {
        return !hadCandidates && draft.kind === 'offered';
      }
      this.experience.resolvePendingChoice();
    }
    return false;
  }

  private applyMutationEffects(effects: readonly MutationEffect[]): void {
    let maximumHpIncrease = 0;
    let currentHpIncrease = 0;
    let rebuildLoopPath = false;

    for (const effect of effects) {
      switch (effect.kind) {
        case 'max-hp-flat':
          maximumHpIncrease += effect.amount;
          break;
        case 'current-hp-flat':
          currentHpIncrease += effect.amount;
          break;
        case 'imprint-duration-flat-seconds':
          this.imprint.increaseDuration(effect.seconds);
          break;
        case 'snap-radius-flat':
          rebuildLoopPath = true;
          break;
        default:
          break;
      }
    }

    if (maximumHpIncrease > 0) {
      this.vitals.increaseMaximum(maximumHpIncrease, currentHpIncrease);
    }
    if (rebuildLoopPath) {
      this.loopPath = this.createLoopPath();
    }
  }

  private readonly update = (frameDeltaSeconds: number): void => {
    const deltaSeconds = Math.min(frameDeltaSeconds, 0.05);
    const intent = this.consumeInputIntent();
    const runSceneAtFrameStart = this.runFlow.snapshot.scene;

    if (intent.restartPressed) {
      this.reset();
      return;
    }

    this.presentationElapsed += deltaSeconds;
    this.feedbackTime = Math.max(0, this.feedbackTime - deltaSeconds);
    const livingEnemyCount =
      this.enemies.length +
      this.cutters.length +
      this.mimics.length +
      this.eliteHusks.length;
    this.audio.updateMusic({
      intensity: Math.min(1, livingEnemyCount / 24),
      loopActive: this.loopPath.active,
      apex: this.mutationRank(APEX_MUTATION_ID) > 0,
      boss: this.warden !== null,
    });

    if (this.runFlow.snapshot.scene === 'title') {
      if (intent.confirmPressed) {
        this.requestStartRun();
        return;
      }
      this.draw(null);
      this.publishStatus('title', 0, null);
      return;
    }

    if (
      this.runFlow.snapshot.scene === 'results' &&
      intent.cancelPressed
    ) {
      this.requestReturnToTitle();
      return;
    }

    // Advance only echoes that already existed at frame start. A closure made
    // below renders once at age zero so its brief confirmation flash is never
    // skipped on a slow frame.
    if (this.closureEcho !== null) {
      this.closureEcho.age += deltaSeconds;
      if (this.closureEcho.age >= PLAYGROUND_TUNING.closureDurationSeconds) {
        this.closureEcho = null;
      }
    }
    if (this.loopCutEcho !== null) {
      this.loopCutEcho.age += deltaSeconds;
      if (this.loopCutEcho.age >= 0.46) {
        this.loopCutEcho = null;
      }
    }
    if (this.wardenAttackEcho !== null) {
      this.wardenAttackEcho.age += deltaSeconds;
      if (this.wardenAttackEcho.age >= 0.32) {
        this.wardenAttackEcho = null;
      }
    }

    if (this.vitals.snapshot.dead) {
      this.finishDeathFlow();
      this.draw(null);
      this.publishStatus('dead', 0, null);
      return;
    }

    if (this.runFlow.snapshot.scene === 'results') {
      const outcome = this.runFlow.snapshot.result?.outcome;
      this.draw(null);
      this.publishStatus(outcome === 'death' ? 'dead' : 'victory', 0, null);
      return;
    }

    if (this.waveDirector.snapshot.completed && this.warden === null) {
      this.beginWardenEncounter();
    }

    const mutationPending =
      this.mutationDraft.snapshot.candidates.length > 0;
    const imprintPending = this.imprint.snapshot.candidates.length > 0;
    this.choiceClock.updatePresentation(
      deltaSeconds,
      mutationPending,
      imprintPending,
    );

    const decisionState = this.resolvePendingDecision(
      intent,
      intent.choiceIndex,
    );
    if (decisionState !== null) {
      this.draw(null);
      this.publishStatus(decisionState, 0, null);
      return;
    }

    const simulationScale = this.choiceClock.snapshot(
      false,
      imprintPending,
    ).simulationScale;
    const simulationDelta = deltaSeconds * simulationScale;
    this.vitals.update(simulationDelta);
    this.imprint.update(simulationDelta);
    this.updatePlayer(simulationDelta, intent);
    this.updateCamera(deltaSeconds);
    const wardenActions =
      this.warden?.step(simulationDelta, {
        playerPosition: this.player,
        bounds: this.wardenBounds(),
      }) ?? [];
    const combat =
      this.warden === null
        ? this.updateEnemiesAndProjectiles(simulationDelta)
        : Object.freeze({
            projectileHits: Object.freeze([]),
            loopCutPosition: null,
          });
    let wardenCaptureResolved = false;
    if (combat.loopCutPosition !== null) {
      this.loopInput.interrupt(intent.loopHeld);
      this.loopPath.cancel();
      this.closureReadyCue = null;
      this.audio.playLoopCut();
      this.loopCutEcho = {
        position: combat.loopCutPosition,
        age: 0,
      };
      this.feedbackState = 'miss';
      this.feedbackTime = 0.9;
    } else {
      wardenCaptureResolved = this.updateLoopInput(intent);
    }
    this.resolveProjectileDamage(combat.projectileHits);
    if (!wardenCaptureResolved) {
      this.resolveWardenActions(wardenActions);
    }
    const reachedVictoryResults =
      runSceneAtFrameStart === 'ending' &&
      this.runFlow.updatePresentation(deltaSeconds);
    if (reachedVictoryResults) {
      this.draw(null);
      this.publishStatus('victory', 0, null);
      return;
    }
    if (this.warden === null) {
      this.resolveEnemyContactDamage();
    }
    if (!this.vitals.snapshot.dead) {
      if (this.warden === null) {
        this.tutorial.update(simulationDelta);
        this.advanceWaves(simulationDelta);
        this.updateFullRunUnlocks();
      }
    }
    if (this.waveDirector.snapshot.completed && this.warden === null) {
      this.beginWardenEncounter();
      this.draw(null);
      this.publishStatus('warden-arrival', 0, null);
      return;
    }
    if (this.warden === null && this.ensureMutationDraft()) {
      this.clearTransientInput();
      this.draw(null);
      this.publishStatus('mutation', 0, null);
      return;
    }
    const loopPreview = this.loopPath.preview(this.player);
    this.updateClosureReadyCue(loopPreview);

    this.draw(loopPreview);
    this.publishCurrentStatus(loopPreview);
  };

  private consumeInputIntent(): InputIntent {
    const keyboard = this.keyboard.consumeIntent();
    const pointer = this.pointer.consumeIntent();
    const keyboardMoving = keyboard.moveX !== 0 || keyboard.moveY !== 0;

    return {
      moveX: keyboardMoving ? keyboard.moveX : pointer.moveX,
      moveY: keyboardMoving ? keyboard.moveY : pointer.moveY,
      loopHeld: keyboard.loopHeld || pointer.loopHeld,
      confirmPressed: keyboard.confirmPressed || pointer.confirmPressed,
      cancelPressed: keyboard.cancelPressed || pointer.cancelPressed,
      restartPressed: keyboard.restartPressed || pointer.restartPressed,
      choiceIndex: keyboard.choiceIndex ?? pointer.choiceIndex,
    };
  }

  private updatePlayer(deltaSeconds: number, intent: InputIntent): void {
    const previousX = this.player.x;
    const previousY = this.player.y;
    if (intent.moveX !== 0 || intent.moveY !== 0) {
      const speedMultiplier = 1 + this.mutationRank('strider') * 0.1;
      const distance =
        PLAYGROUND_TUNING.playerSpeed * speedMultiplier * deltaSeconds;
      this.player.x += intent.moveX * distance;
      this.player.y += intent.moveY * distance;
    }

    const bounds = this.playerMovementBounds();
    const padding = Math.max(
      PLAYGROUND_TUNING.playerRadius,
      WORLD_TUNING.playerBoundaryPadding,
    );
    const minX = bounds.minX + padding;
    const maxX = bounds.maxX - padding;
    const minY = bounds.minY + padding;
    const maxY = bounds.maxY - padding;
    this.player.x =
      minX <= maxX
        ? Math.max(minX, Math.min(maxX, this.player.x))
        : (bounds.minX + bounds.maxX) / 2;
    this.player.y =
      minY <= maxY
        ? Math.max(minY, Math.min(maxY, this.player.y))
        : (bounds.minY + bounds.maxY) / 2;

    // Static street structures stop the body but never the loop (D-028).
    // Resolving before velocity derivation keeps playerVelocity honest for
    // the walk cycle and for mimics that mirror it.
    const resolved = resolveCircleColliders(
      this.player,
      PLAYGROUND_TUNING.playerRadius,
      QUARANTINE_COLLIDERS,
    );
    if (resolved !== this.player) {
      this.player.x = resolved.x;
      this.player.y = resolved.y;
    }

    if (deltaSeconds > 0) {
      this.playerVelocity = {
        x: (this.player.x - previousX) / deltaSeconds,
        y: (this.player.y - previousY) / deltaSeconds,
      };
    } else {
      this.playerVelocity = { x: 0, y: 0 };
    }

    this.tutorial.recordMovement(
      Math.hypot(this.player.x - previousX, this.player.y - previousY),
    );
  }

  private updateEnemiesAndProjectiles(
    deltaSeconds: number,
  ): CombatStepResult {
    const bounds = this.enemyBounds();
    let loopCutPosition: Vec2 | null = null;

    for (const enemy of this.enemies) {
      if (!enemy.snapshot.alive) {
        continue;
      }

      const enemyDelta = this.enemyDeltaAtPosition(
        enemy.snapshot.position,
        deltaSeconds,
      );
      for (const action of enemy.step(enemyDelta, this.player, bounds)) {
        this.projectiles.push(
          new ProjectileModel({
            id: `projectile-${this.nextProjectileId}`,
            action,
          }),
        );
        this.nextProjectileId += 1;
      }
      enemy.applyStaticColliders(QUARANTINE_COLLIDERS);
    }

    for (const cutter of this.cutters) {
      const snapshot = cutter.snapshot;
      if (!snapshot.alive) {
        continue;
      }
      const actions = cutter.step(
        this.enemyDeltaAtPosition(snapshot.position, deltaSeconds),
        {
          playerPosition: this.player,
          bounds,
          tetherSamples: this.loopPath.samples,
        },
      );
      if (loopCutPosition === null && actions[0] !== undefined) {
        loopCutPosition = actions[0].position;
      }
      cutter.applyStaticColliders(QUARANTINE_COLLIDERS);
    }

    for (const mimic of this.mimics) {
      const snapshot = mimic.snapshot;
      if (!snapshot.alive) {
        continue;
      }
      mimic.step(
        this.enemyDeltaAtPosition(snapshot.position, deltaSeconds),
        {
          playerPosition: this.player,
          playerVelocity: this.playerVelocity,
          bounds,
        },
      );
      mimic.applyStaticColliders(QUARANTINE_COLLIDERS);
    }

    for (const husk of this.eliteHusks) {
      const snapshot = husk.snapshot;
      if (!snapshot.alive) {
        continue;
      }
      husk.step(
        this.enemyDeltaAtPosition(snapshot.position, deltaSeconds),
        this.player,
        bounds,
      );
      husk.applyStaticColliders(QUARANTINE_COLLIDERS);
    }

    const hits: Extract<ProjectileStepResult, { kind: 'hit' }>[] = [];
    for (const projectile of this.projectiles) {
      const result = projectile.step(deltaSeconds, bounds, {
        center: this.player,
        radius: PLAYGROUND_TUNING.playerRadius,
      });
      if (result.kind === 'hit') {
        hits.push(result);
      }
    }

    this.projectiles = this.projectiles.filter(
      (projectile) => projectile.snapshot.alive,
    );
    return Object.freeze({
      projectileHits: Object.freeze(hits),
      loopCutPosition,
    });
  }

  private enemyDeltaAtPosition(
    position: Vec2,
    deltaSeconds: number,
  ): number {
    const activeImprint = this.imprint.snapshot.active;
    const anchor = this.loopPath.samples[0];
    const nerveRank = this.mutationRank('nerve-lattice');
    const radius = PROGRESSION_BASELINE.nerveFieldRadius + nerveRank * 28;
    const slowFactor = Math.max(
      0.25,
      PROGRESSION_BASELINE.nerveEnemySpeedFactor - nerveRank * 0.1,
    );
    if (
      activeImprint?.kind !== 'nerve' ||
      anchor === undefined ||
      Math.hypot(
        position.x - anchor.x,
        position.y - anchor.y,
      ) > radius
    ) {
      return deltaSeconds;
    }
    return deltaSeconds * slowFactor;
  }

  private resolveProjectileDamage(
    hits: readonly Extract<ProjectileStepResult, { kind: 'hit' }>[],
  ): void {
    for (const hit of hits) {
      const result = this.vitals.damage(
        hit.damage,
        `${hit.sourceId}:${hit.projectileId}`,
      );
      if (result.kind === 'ignored') {
        continue;
      }

      this.applyDamageFeedback(result.kind === 'death');
      break;
    }
  }

  private resolveEnemyContactDamage(): void {
    for (const enemy of this.enemies) {
      const snapshot = enemy.snapshot;
      if (!snapshot.alive) {
        continue;
      }

      if (
        this.applyContactDamage(
          snapshot.id,
          snapshot.position,
          snapshot.radius,
          snapshot.contactDamage,
        )
      ) {
        return;
      }
    }

    for (const enemy of [...this.cutters, ...this.mimics]) {
      const snapshot = enemy.snapshot;
      if (
        snapshot.alive &&
        this.applyContactDamage(
          snapshot.id,
          snapshot.position,
          snapshot.radius,
          snapshot.contactDamage,
        )
      ) {
        return;
      }
    }

    for (const husk of this.eliteHusks) {
      const snapshot = husk.snapshot;
      if (
        snapshot.alive &&
        this.applyContactDamage(
          snapshot.id,
          snapshot.position,
          snapshot.radius,
          snapshot.contactDamage,
        )
      ) {
        return;
      }
    }
  }

  private applyContactDamage(
    sourceId: string,
    position: Vec2,
    radius: number,
    damage: number,
  ): boolean {
    if (
      Math.hypot(
        position.x - this.player.x,
        position.y - this.player.y,
      ) > PLAYGROUND_TUNING.playerRadius + radius
    ) {
      return false;
    }

    const result = this.vitals.damage(damage, sourceId);
    if (result.kind === 'ignored') {
      return false;
    }
    this.applyDamageFeedback(result.kind === 'death');
    return true;
  }

  private applyDamageFeedback(dead: boolean): void {
    this.audio.playDamage(dead);
    this.feedbackState = dead ? 'dead' : 'hurt';
    this.feedbackTime = dead ? Number.POSITIVE_INFINITY : 0.55;

    if (!dead) {
      return;
    }

    this.keyboard.reset();
    this.pointer.reset();
    this.loopInput.reset();
    this.loopPath.cancel();
    this.closureReadyCue = null;
  }

  private enemyBounds(): EnemyArenaBounds {
    return QUARANTINE_WORLD_BOUNDS;
  }

  private playerMovementBounds(): EnemyArenaBounds {
    return this.wardenArenaBounds ?? QUARANTINE_WORLD_BOUNDS;
  }

  private wardenBounds(): EnemyArenaBounds {
    return this.wardenArenaBounds ?? QUARANTINE_WORLD_BOUNDS;
  }

  private syncCameraViewport(): void {
    const view = this.rendererHost.viewSize();
    const width = Math.max(1, view.width);
    const height = Math.max(1, view.height);
    const viewport = cameraViewportForScreen(
      width,
      height,
      WORLD_TUNING.cameraZoom,
    );
    const camera = this.camera.snapshot;
    if (
      camera.viewportWidth !== viewport.width ||
      camera.viewportHeight !== viewport.height
    ) {
      this.camera.resize(viewport.width, viewport.height);
    }
  }

  private updateCamera(deltaSeconds: number): void {
    this.syncCameraViewport();
    this.camera.update(this.player, deltaSeconds);
  }

  private spawnBounds(): EnemyArenaBounds {
    const camera = this.camera.snapshot;
    const offscreenRegion = selectOffscreenSpawnRegion(
      camera,
      QUARANTINE_WORLD_BOUNDS,
      this.waveDirector.snapshot.totalSpawnRequests,
      {
        cameraMargin: WORLD_TUNING.spawnCameraMargin,
        bandDepth: WORLD_TUNING.spawnBandDepth,
        flankPadding: WORLD_TUNING.spawnFlankPadding,
        minimumDepth: WORLD_TUNING.spawnMinimumDepth,
        minimumSpan: WORLD_TUNING.spawnMinimumSpan,
      },
    );
    if (offscreenRegion !== null) {
      return offscreenRegion;
    }

    const worldWidth =
      QUARANTINE_WORLD_BOUNDS.maxX - QUARANTINE_WORLD_BOUNDS.minX;
    const worldHeight =
      QUARANTINE_WORLD_BOUNDS.maxY - QUARANTINE_WORLD_BOUNDS.minY;
    const width = Math.min(
      worldWidth,
      Math.max(
        camera.viewportWidth,
        WORLD_TUNING.spawnMinimumSpan,
      ),
    );
    const height = Math.min(
      worldHeight,
      Math.max(
        camera.viewportHeight,
        WORLD_TUNING.spawnMinimumSpan,
      ),
    );
    return this.centeredWorldBounds(
      {
        x: camera.x + camera.viewportWidth / 2,
        y: camera.y + camera.viewportHeight / 2,
      },
      width,
      height,
    );
  }

  private createWardenArenaBounds(): EnemyArenaBounds {
    const worldWidth =
      QUARANTINE_WORLD_BOUNDS.maxX - QUARANTINE_WORLD_BOUNDS.minX;
    const worldHeight =
      QUARANTINE_WORLD_BOUNDS.maxY - QUARANTINE_WORLD_BOUNDS.minY;
    const view = this.rendererHost.viewSize();
    const width = Math.min(
      worldWidth,
      Math.max(
        WORLD_TUNING.wardenArenaMinimumWidth,
        view.width + WORLD_TUNING.wardenArenaViewportPadding,
      ),
    );
    const height = Math.min(
      worldHeight,
      Math.max(
        WORLD_TUNING.wardenArenaMinimumHeight,
        view.height + WORLD_TUNING.wardenArenaViewportPadding,
      ),
    );
    return this.centeredWorldBounds(this.player, width, height);
  }

  private centeredWorldBounds(
    center: Vec2,
    width: number,
    height: number,
  ): EnemyArenaBounds {
    const minX = Math.max(
      QUARANTINE_WORLD_BOUNDS.minX,
      Math.min(
        QUARANTINE_WORLD_BOUNDS.maxX - width,
        center.x - width / 2,
      ),
    );
    const minY = Math.max(
      QUARANTINE_WORLD_BOUNDS.minY,
      Math.min(
        QUARANTINE_WORLD_BOUNDS.maxY - height,
        center.y - height / 2,
      ),
    );
    return Object.freeze({
      minX,
      minY,
      maxX: minX + width,
      maxY: minY + height,
    });
  }

  private advanceWaves(deltaSeconds: number): void {
    const aliveCounts: Record<FullRunEnemyArchetype, number> = {
      drifter: 0,
      rusher: 0,
      watcher: 0,
      cutter: 0,
      mimic: 0,
      'elite-husk': 0,
    };

    for (const enemy of this.enemies) {
      const snapshot = enemy.snapshot;
      if (snapshot.alive) {
        aliveCounts[snapshot.archetype] += 1;
      }
    }
    aliveCounts.cutter = this.cutters.filter(
      (enemy) => enemy.snapshot.alive,
    ).length;
    aliveCounts.mimic = this.mimics.filter(
      (enemy) => enemy.snapshot.alive,
    ).length;
    aliveCounts['elite-husk'] = this.eliteHusks.filter(
      (enemy) => enemy.snapshot.alive,
    ).length;

    const requests = this.waveDirector.step(deltaSeconds, {
      playerPosition: this.player,
      bounds: this.spawnBounds(),
      aliveCounts,
    });

    for (const request of requests) {
      // Never seed a body inside a street structure (D-028).
      const position = this.freeSpawnPosition(
        request.position,
        SPAWN_BODY_RADII[request.archetype],
      );
      switch (request.archetype) {
        case 'cutter':
          this.cutters.push(new CutterModel({ ...request, position }));
          break;
        case 'mimic':
          this.mimics.push(new MimicModel({ ...request, position }));
          break;
        case 'elite-husk':
          this.eliteHusks.push(new EliteHuskModel({ ...request, position }));
          break;
        case 'drifter': {
          if (request.scheduledAtSeconds >= 180) {
            this.postCheckpointDrifterSequence += 1;
          }
          this.enemies.push(
            new EnemyModel({
              id: request.id,
              archetype: request.archetype,
              position,
              phase: request.phase,
              captureProfile: captureProfileForDrifterSpawn(
                request.scheduledAtSeconds,
                this.postCheckpointDrifterSequence,
              ),
            }),
          );
          break;
        }
        case 'rusher':
        case 'watcher':
          this.enemies.push(
            new EnemyModel({
              id: request.id,
              archetype: request.archetype,
              position,
              phase: request.phase,
            }),
          );
          break;
      }
    }
  }

  private freeSpawnPosition(preferred: Vec2, radius: number): Vec2 {
    return findFreePosition(
      preferred,
      radius,
      QUARANTINE_COLLIDERS,
      QUARANTINE_WORLD_BOUNDS,
    );
  }

  private updateFullRunUnlocks(): void {
    if (
      !this.lineageUnlocked &&
      this.waveDirector.snapshot.elapsedSeconds >= 180
    ) {
      this.mutationDraft.unlock(LINEAGE_MUTATION_IDS);
      this.lineageUnlocked = true;
    }

    if (this.apexQueued || this.mutationRank(APEX_MUTATION_ID) > 0) {
      return;
    }

    const activated = new Set(this.imprint.activatedKinds);
    const hasEveryImprint = (
      ['blade', 'nerve', 'spike', 'symmetry'] as const
    ).every((kind) => activated.has(kind));
    const hasEveryLineage = LINEAGE_MUTATION_IDS.every(
      (id) => this.mutationRank(id) >= 1,
    );
    if (hasEveryImprint && hasEveryLineage) {
      this.mutationDraft.unlock([APEX_MUTATION_ID]);
      this.apexQueued = this.mutationDraft.prioritizeNext(APEX_MUTATION_ID);
    }
  }

  private updateLoopInput(intent: InputIntent): boolean {
    const frame = this.loopInput.update(intent.loopHeld);
    let wardenCaptureResolved = false;

    if (frame.started) {
      this.loopPath.begin(this.player);
      this.tutorial.recordLoopStarted();
      this.audio.playAnchor();
      this.closureReadyCue = null;
      this.feedbackState = 'drawing';
      this.feedbackTime = 0;
    }

    if (frame.active) {
      this.loopPath.sample(this.player);
    }

    if (frame.completed) {
      const projectionOrigin = this.loopPath.samples[0] ?? this.player;
      const closure = this.loopPath.complete(this.player);

      if (closure !== null) {
        this.tutorial.recordLoopClosed(true);
        const imprintKind = this.imprint.snapshot.active?.kind ?? null;
        const projectionCount =
          this.mutationRank(APEX_MUTATION_ID) > 0
            ? 4
            : imprintKind === 'symmetry'
              ? 2
              : 1;
        const projections = projectLoopClosure(
          closure,
          projectionOrigin,
          projectionCount,
        );
        const bladeBandWidth =
          imprintKind === 'blade'
            ? PROGRESSION_BASELINE.bladeBandWidth +
              this.mutationRank('blade-gland') * 18
            : 0;
        const wardenCapture =
          this.warden === null
            ? null
            : this.resolveWardenCapture(projections);
        const capturedEnemies =
          wardenCapture?.capturedEnemies ?? this.resolveCapture(projections);
        const capturedPositions =
          wardenCapture?.capturedPositions ??
          capturedEnemies.map((enemy) => enemy.position);
        const capturedNow =
          wardenCapture?.capturedCount ?? capturedEnemies.length;
        wardenCaptureResolved = (wardenCapture?.capturedCount ?? 0) > 0;
        this.closureEcho = {
          closure,
          projections,
          captured: capturedNow,
          capturedEnemies,
          capturedPositions,
          imprintKind,
          bladeBandWidth,
          age: 0,
        };
        const captureFeedback = classifyCaptureFeedback(
          capturedNow,
          capturedEnemies,
        );
        this.audio.playClosure(
          capturedNow > 0,
          captureFeedback.audioCue,
        );
        this.feedbackState =
          captureFeedback.kind === 'captured'
            ? 'success'
            : captureFeedback.kind;
        this.feedbackTime = 1.8;
      } else {
        this.audio.playClosure(false);
        this.feedbackState = 'miss';
        this.feedbackTime = 1.2;
      }
    }
    return wardenCaptureResolved;
  }

  private updateClosureReadyCue(preview: LoopPreview | null): void {
    const nextCue = preview?.valid === true ? preview.kind : null;

    if (nextCue !== null && nextCue !== this.closureReadyCue) {
      this.audio.playClosureReady(nextCue);
    }

    this.closureReadyCue = nextCue;
  }

  private resolveCapture(
    projections: readonly LoopClosure[],
  ): CapturedEnemyEchoView[] {
    const capturedEnemies: CapturedEnemyEchoView[] = [];
    const imprintKinds: EnemyImprintKind[] = [];
    let recovery = 0;
    let xp = 0;
    const activeImprint = this.imprint.snapshot.active?.kind ?? null;
    const bladeBandWidth =
      activeImprint === 'blade'
        ? PROGRESSION_BASELINE.bladeBandWidth +
          this.mutationRank('blade-gland') * 18
        : 0;
    const carrionBonus = this.mutationRank('carrion') * 2;
    const copyXpMultiplier = (projectionIndex: number): number =>
      activeImprint === 'symmetry' && projectionIndex > 0
        ? 1 + this.mutationRank('mirror-organ') * 0.1
        : 1;

    for (const enemy of this.enemies) {
      const snapshot = enemy.snapshot;
      if (!snapshot.alive) {
        continue;
      }

      const hit = classifyLoopAttackPoint(
        projections,
        snapshot.position,
        bladeBandWidth,
      );
      if (hit === null) {
        continue;
      }

      const definition = enemy.definition;
      const result = enemy.capture();
      if (result.kind === 'ignored') {
        continue;
      }
      capturedEnemies.push({
        archetype: snapshot.archetype,
        position: snapshot.position,
        radius: snapshot.radius,
        phase: snapshot.phase,
        captureLayer:
          snapshot.captureProfile === 'armored' ? result.kind : 'ordinary',
        captureProfile: snapshot.captureProfile,
      });
      recovery += result.reward.recovery + carrionBonus;
      if (
        activeImprint === 'spike' &&
        definition.archetype === 'rusher'
      ) {
        recovery +=
          PROGRESSION_BASELINE.spikeRusherRecoveryBonus +
          this.mutationRank('spike-crown') * 2;
      }
      xp += result.reward.xp * copyXpMultiplier(hit.projectionIndex);
      if (result.kind === 'killed' && definition.imprintKind !== undefined) {
        imprintKinds.push(definition.imprintKind);
        this.gatheredImprints.add(definition.imprintKind);
      }
    }

    for (const cutter of this.cutters) {
      const snapshot = cutter.snapshot;
      if (!snapshot.alive) {
        continue;
      }
      const hit = classifyLoopAttackPoint(
        projections,
        snapshot.position,
        bladeBandWidth,
      );
      if (hit === null) {
        continue;
      }
      capturedEnemies.push({
        archetype: 'cutter',
        position: snapshot.position,
        radius: snapshot.radius,
        phase: snapshot.phase,
        captureLayer: 'ordinary',
      });
      recovery += snapshot.captureRecovery + carrionBonus;
      xp += snapshot.xp * copyXpMultiplier(hit.projectionIndex);
      imprintKinds.push('blade');
      this.gatheredImprints.add('blade');
      cutter.kill();
    }

    for (const mimic of this.mimics) {
      const snapshot = mimic.snapshot;
      if (!snapshot.alive) {
        continue;
      }
      const hit = classifyLoopAttackPoint(
        projections,
        snapshot.position,
        bladeBandWidth,
      );
      if (hit === null) {
        continue;
      }
      capturedEnemies.push({
        archetype: 'mimic',
        position: snapshot.position,
        radius: snapshot.radius,
        phase: snapshot.phase,
        captureLayer: 'ordinary',
      });
      recovery += snapshot.captureRecovery + carrionBonus;
      xp += snapshot.xp * copyXpMultiplier(hit.projectionIndex);
      imprintKinds.push('symmetry');
      this.gatheredImprints.add('symmetry');
      mimic.kill();
    }

    for (const husk of this.eliteHusks) {
      const snapshot = husk.snapshot;
      if (!snapshot.alive) {
        continue;
      }
      const hit = classifyLoopAttackPoint(
        projections,
        snapshot.position,
        bladeBandWidth,
      );
      if (hit === null) {
        continue;
      }

      let stabilityDamage = 1;
      if (
        hit.source === 'blade-band' &&
        this.mutationRank('blade-gland') >= 2
      ) {
        stabilityDamage += 1;
      }
      if (
        activeImprint === 'spike' &&
        this.mutationRank('spike-crown') >= 2
      ) {
        stabilityDamage += 1;
      }

      let paidLayerReward = false;
      for (let layer = 0; layer < stabilityDamage; layer += 1) {
        const layerSnapshot = husk.snapshot;
        const result = husk.capture();
        if (result.kind === 'ignored') {
          break;
        }
        recovery += result.reward.recovery;
        xp +=
          result.reward.xp * copyXpMultiplier(hit.projectionIndex);
        paidLayerReward ||=
          result.reward.xp > 0 || result.reward.recovery > 0;
        capturedEnemies.push({
          archetype: 'elite-husk',
          position: layerSnapshot.position,
          radius: layerSnapshot.radius,
          phase: layerSnapshot.phase + layer * 0.67,
          captureLayer: result.kind,
        });
        if (result.kind === 'killed') {
          imprintKinds.push(...this.gatheredImprints);
          break;
        }
      }

      if (paidLayerReward) {
        recovery += carrionBonus;
      }
    }

    this.captured += capturedEnemies.length;
    if (capturedEnemies.length > 0) {
      this.tutorial.recordCapture(capturedEnemies.length);
      this.enemies = this.enemies.filter((enemy) => enemy.snapshot.alive);
      this.cutters = this.cutters.filter((enemy) => enemy.snapshot.alive);
      this.mimics = this.mimics.filter((enemy) => enemy.snapshot.alive);
      this.eliteHusks = this.eliteHusks.filter(
        (enemy) => enemy.snapshot.alive,
      );
      const recoveryCap =
        PROGRESSION_BASELINE.captureRecoveryCap +
        this.mutationRank('carrion') * 4;
      const xpMultiplier = 1 + this.mutationRank('hunger') * 0.1;
      this.vitals.heal(Math.min(recoveryCap, recovery));
      this.experience.gain(xp * xpMultiplier);
      if (this.imprint.offer(imprintKinds).kind === 'offered') {
        this.choiceClock.openImprint();
        this.clearTransientInput();
      }
    }
    return capturedEnemies;
  }

  private resolveWardenCapture(
    projections: readonly LoopClosure[],
  ): WardenCapturePresentation {
    const warden = this.warden;
    if (warden === null) {
      return {
        capturedEnemies: Object.freeze([]),
        capturedPositions: Object.freeze([]),
        capturedCount: 0,
      };
    }

    const before = warden.snapshot;
    const result: WardenCaptureResult = warden.capture(projections);
    if (result.kind === 'ignored') {
      return {
        capturedEnemies: Object.freeze([]),
        capturedPositions: Object.freeze([]),
        capturedCount: 0,
      };
    }

    let capturedPositions: readonly Vec2[];
    if (result.kind === 'arm-severed') {
      capturedPositions = Object.freeze([
        before.armTargets[result.armIndex]!.position,
      ]);
    } else if (result.kind === 'shell-peeled') {
      capturedPositions = Object.freeze([
        before.shellPlates[result.plateIndex]!.position,
      ]);
    } else {
      capturedPositions = Object.freeze([
        before.core.position,
        ...before.controlNodes.map((node) => node.position),
      ]);
    }

    this.captured += 1;
    this.vitals.heal(result.recovery);
    this.audio.playWardenCapture(result.kind);
    if (result.kind === 'core-closed') {
      this.runFlow.finishVictory(this.createRunResult('victory'));
    }

    return {
      capturedEnemies: Object.freeze([]),
      capturedPositions,
      capturedCount: 1,
    };
  }

  private draw(loopPreview: LoopPreview | null): void {
    this.syncCameraViewport();
    const activeImprint = this.imprint.snapshot.active?.kind ?? null;
    const projectionOrigin = this.loopPath.samples[0];
    const previewProjectionCount =
      this.mutationRank(APEX_MUTATION_ID) > 0
        ? 4
        : activeImprint === 'symmetry' &&
            this.mutationRank('mirror-organ') >= 2
          ? 2
          : 1;
    const projectedLoopPreviews =
      loopPreview?.valid === true &&
      projectionOrigin !== undefined &&
      previewProjectionCount > 1
        ? projectLoopClosure(
            loopPreview,
            projectionOrigin,
            previewProjectionCount,
          ).slice(1)
        : [];

    const view = this.rendererHost.viewSize();
    this.rendererHost.render({
      width: view.width,
      height: view.height,
      worldBounds: QUARANTINE_WORLD_BOUNDS,
      camera: this.camera.snapshot,
      elapsed: this.presentationElapsed,
      player: this.player,
      playerVelocity: this.playerVelocity,
      warden: this.warden?.snapshot ?? null,
      enemies: [
        ...this.enemies.map((enemy): PlaygroundEnemyView => {
          const snapshot = enemy.snapshot;
          return {
            id: snapshot.id,
            archetype: snapshot.archetype,
            position: snapshot.position,
            velocity: snapshot.velocity,
            facing: snapshot.facing,
            behaviorState: snapshot.behaviorState,
            lockedTarget: snapshot.lockedTarget,
            radius: snapshot.radius,
            phase: snapshot.phase,
            alive: snapshot.alive,
            captureProfile: snapshot.captureProfile,
            armored: snapshot.armored,
            staggerRemaining: snapshot.staggerRemaining,
          };
        }),
        ...this.cutters.map((enemy): PlaygroundEnemyView => {
          const snapshot = enemy.snapshot;
          return {
            id: snapshot.id,
            archetype: 'cutter',
            position: snapshot.position,
            velocity: snapshot.velocity,
            facing: snapshot.facing,
            behaviorState: snapshot.state,
            lockedTarget: snapshot.lockedMidpoint,
            radius: snapshot.radius,
            phase: snapshot.phase,
            alive: snapshot.alive,
          };
        }),
        ...this.mimics.map((enemy): PlaygroundEnemyView => {
          const snapshot = enemy.snapshot;
          return {
            id: snapshot.id,
            archetype: 'mimic',
            position: snapshot.position,
            velocity: snapshot.velocity,
            facing: snapshot.facing,
            behaviorState: snapshot.behaviorState,
            lockedTarget: null,
            radius: snapshot.radius,
            phase: snapshot.phase,
            alive: snapshot.alive,
          };
        }),
        ...this.eliteHusks.map((enemy): PlaygroundEnemyView => {
          const snapshot = enemy.snapshot;
          return {
            id: snapshot.id,
            archetype: 'elite-husk',
            position: snapshot.position,
            velocity: snapshot.velocity,
            facing: snapshot.facing,
            behaviorState: snapshot.exposed ? 'exposed' : 'armored',
            lockedTarget: null,
            radius: snapshot.radius,
            phase: snapshot.phase,
            alive: snapshot.alive,
          };
        }),
      ],
      projectiles: this.projectiles.map((projectile) => projectile.snapshot),
      playerInvulnerability: this.vitals.snapshot.invulnerabilityRemaining,
      activeImprint,
      bladeBandWidth:
        activeImprint === 'blade'
          ? PROGRESSION_BASELINE.bladeBandWidth +
            this.mutationRank('blade-gland') * 18
          : 0,
      nerveFieldRadius:
        PROGRESSION_BASELINE.nerveFieldRadius +
        this.mutationRank('nerve-lattice') * 28,
      loopSamples: this.loopPath.samples,
      loopPreview,
      projectedLoopPreviews,
      closureEcho: this.closureEcho,
      loopCutEcho: this.loopCutEcho,
      wardenAttackEcho: this.wardenAttackEcho,
      reducedMotion: this.reducedMotion,
      reducedFlash: this.reducedFlash,
    });
  }

  private publishCurrentStatus(preview: LoopPreview | null): void {
    if (preview !== null) {
      this.publishStatus(
        preview.valid ? 'valid' : 'drawing',
        preview.area,
        preview.kind,
      );
      return;
    }

    if (this.runFlow.snapshot.scene === 'ending') {
      this.publishStatus('ending', 0, null);
      return;
    }

    if (this.feedbackTime <= 0 && this.warden !== null) {
      const stateByStage: Record<WardenStage, GameStatus['state']> = {
        arrival: 'warden-arrival',
        arms: 'warden-arms',
        shell: 'warden-shell',
        core: 'warden-core',
        defeated: 'ending',
      };
      this.publishStatus(stateByStage[this.warden.snapshot.stage], 0, null);
      return;
    }

    this.publishStatus(
      this.feedbackTime > 0 ? this.feedbackState : 'idle',
      0,
      null,
    );
  }

  private publishStatus(
    state: GameStatus['state'],
    loopArea: number,
    closureKind: LoopClosureKind | null,
  ): void {
    const hint = this.statusHint(state, closureKind);
    const vitals = this.vitals.snapshot;
    const experience = this.experience.snapshot;
    const imprint = this.imprint.snapshot;
    const tutorial = this.tutorial.snapshot;
    const warden = this.warden?.snapshot ?? null;
    const status = {
      state,
      captured: this.captured,
      loopArea,
      closureKind,
      inputMode: this.loopInput.inputMode,
      hp: vitals.hp,
      maxHp: vitals.maxHp,
      level: experience.level,
      xp: experience.xp,
      xpForNextLevel: experience.xpForNextLevel,
      pendingLevelChoices: experience.pendingChoices,
      unspentChoices: this.unspentChoicesAtTransition,
      activeImprint: imprint.active?.kind ?? null,
      imprintSeconds: imprint.active?.remainingSeconds ?? 0,
      imprintCandidates: imprint.candidates,
      mutationCandidates: this.mutationDraft.snapshot.candidates,
      runSeconds: this.waveDirector.snapshot.elapsedSeconds,
      runSeed: this.runFlow.snapshot.runSeed,
      runComplete: this.runFlow.snapshot.scene === 'results',
      runScene: this.runFlow.snapshot.scene,
      runResult: this.runFlow.snapshot.result,
      wardenStage: warden?.stage ?? null,
      wardenProgress: warden?.stageProgress.completed ?? 0,
      wardenProgressRequired: warden?.stageProgress.required ?? 0,
      wardenSeconds: warden?.encounterElapsed ?? 0,
      tutorialStep: tutorial.step,
      tutorialPrompt: tutorial.prompt,
      tutorialAssist: tutorial.assistRequested,
      tutorialComplete: tutorial.completed,
      decisionMode: this.choiceClock.snapshot(
        this.mutationDraft.snapshot.candidates.length > 0,
        imprint.candidates.length > 0,
      ).mode,
      reducedMotion: this.reducedMotion,
      reducedFlash: this.reducedFlash,
      masterVolume: this.audio.mix.master,
      musicVolume: this.audio.mix.music,
      sfxVolume: this.audio.mix.sfx,
      hint,
    } satisfies GameStatus;
    const signature = [
      status.state,
      status.captured,
      Math.round(status.loopArea / 100),
      status.closureKind,
      status.inputMode,
      status.hp,
      status.level,
      status.xp,
      status.pendingLevelChoices,
      status.unspentChoices,
      status.activeImprint,
      Math.ceil(status.imprintSeconds),
      status.imprintCandidates.join(','),
      status.mutationCandidates
        .map((candidate) => `${candidate.id}-${candidate.nextRank}`)
        .join(','),
      Math.floor(status.runSeconds),
      status.runSeed,
      status.runComplete,
      status.runScene,
      status.runResult?.outcome,
      status.wardenStage,
      status.wardenProgress,
      status.wardenProgressRequired,
      Math.floor(status.wardenSeconds),
      status.tutorialStep,
      status.tutorialAssist,
      status.decisionMode,
      status.reducedMotion,
      status.reducedFlash,
      status.masterVolume,
      status.musicVolume,
      status.sfxVolume,
    ].join(':');

    if (signature === this.lastStatusSignature) {
      return;
    }

    this.lastStatusSignature = signature;
    this.onStatus(status);
  }

  private statusHint(
    state: GameStatus['state'],
    closureKind: LoopClosureKind | null,
  ): string {
    if (state === 'valid') {
      const validHintByKind: Record<LoopClosureKind, string> = {
        direct:
          this.loopInput.inputMode === 'hold'
            ? '유효한 고리입니다. SPACE를 놓아 닫으세요.'
            : '유효한 고리입니다. SPACE를 다시 눌러 닫으세요.',
        'anchor-snap': '생체 닻에 스냅되었습니다. 지금 닫으면 전체 경로를 포획합니다.',
        'trail-snap': '이전 궤적에 스냅되었습니다. 표시된 작은 고리가 닫힙니다.',
        'self-intersection': '교차 지점에서 폐곡선이 고정되었습니다. 지금 닫으세요.',
      };
      return validHintByKind[closureKind ?? 'direct'];
    }

    const hintByState: Partial<
      Record<Exclude<GameStatus['state'], 'valid'>, string>
    > = {
      title: 'Enter 또는 사냥 시작을 누르세요. 기본 고리 입력은 토글입니다.',
      idle:
        this.loopInput.inputMode === 'hold'
          ? '방향키로 움직이고 SPACE를 누른 채 적을 감싸세요.'
          : 'SPACE로 추적을 시작하고 이동한 뒤 다시 SPACE를 누르세요.',
      drawing: '계속 이동해 닻 주위에 충분한 면적을 만드세요.',
      success: '포획 성공 — 생체량과 경험치를 흡수했습니다.',
      'armor-peeled': '외피 파괴 — 노출된 몸체를 다음 고리로 포획하세요.',
      miss: '유효한 포획이 아니었습니다. 더 넓게 감싸 다시 시도하세요.',
    };
    if (state === 'hurt') {
      return '캐리어 조직이 손상되었습니다. 적을 포획해 체력을 회복하세요.';
    }
    if (state === 'dead') {
      return '캐리어가 소실되었습니다. R을 눌러 사냥을 다시 시작하세요.';
    }
    if (state === 'mutation') {
      return '1, 2, 3 중 하나의 영구 변이를 선택하세요.';
    }
    if (state === 'imprint') {
      return '임시 임프린트를 고르거나 현재 임프린트를 유지하세요.';
    }
    if (state === 'complete') {
      return '9분 사냥이 완료되었습니다. 워든 접촉을 준비합니다.';
    }
    if (state === 'warden-arrival') {
      return '워든이 출현합니다. 계속 이동하며 신체 구조를 파악하세요.';
    }
    if (state === 'warden-arms') {
      return '노출된 양팔 관절을 각각 고리로 포획하세요.';
    }
    if (state === 'warden-shell') {
      return '워든의 핵을 두 번 감싸 양쪽 외피를 벗기세요.';
    }
    if (state === 'warden-core') {
      return '하나의 고리에 핵과 양쪽 제어점을 모두 넣으세요.';
    }
    if (state === 'ending') {
      return '포획이 완료되었습니다. 워든이 붕괴하고 있습니다.';
    }
    if (state === 'victory') {
      return '워든을 무력화했습니다. R을 눌러 새 사냥을 시작하세요.';
    }
    return hintByState[state] ?? '계속 이동하며 사냥감을 고리로 감싸세요.';
  }

  private reset(): void {
    this.runFlow.restartRun();
    this.configureRunSeed(this.runFlow.snapshot.runSeed);
    this.resetGameplayState();
  }

  private refreshPublishedStatus(): void {
    this.lastStatusSignature = '';
    const scene = this.runFlow.snapshot.scene;
    if (scene === 'title') {
      this.draw(null);
      this.publishStatus('title', 0, null);
      return;
    }
    if (scene === 'results') {
      this.draw(null);
      this.publishStatus(
        this.runFlow.snapshot.result?.outcome === 'death' ? 'dead' : 'victory',
        0,
        null,
      );
      return;
    }
    const preview = this.loopPath.preview(this.player);
    this.draw(preview);
    this.publishCurrentStatus(preview);
  }

  private resetGameplayState(): void {
    this.presentationElapsed = 0;
    this.captured = 0;
    this.vitals.reset();
    this.experience.reset();
    this.imprint.reset();
    this.mutationDraft = this.createMutationDraft();
    this.waveDirector.reset();
    this.tutorial.reset();
    this.loopPath = this.createLoopPath();
    this.projectiles = [];
    this.warden = null;
    this.wardenArenaBounds = null;
    this.nextProjectileId = 1;
    this.postCheckpointDrifterSequence = 0;
    this.choiceClock.reset();
    this.keyboard.reset();
    this.pointer.reset();
    this.loopInput.reset();
    this.closureReadyCue = null;
    this.closureEcho = null;
    this.loopCutEcho = null;
    this.wardenAttackEcho = null;
    this.feedbackState = 'idle';
    this.feedbackTime = 0;
    this.player = {
      x: QUARANTINE_WORLD_START.x,
      y: QUARANTINE_WORLD_START.y,
    };
    this.playerVelocity = { x: 0, y: 0 };
    this.camera.setBounds(QUARANTINE_WORLD_BOUNDS);
    this.syncCameraViewport();
    this.camera.jumpTo(this.player);
    this.resetEnemies();
    this.lineageUnlocked = false;
    this.apexQueued = false;
    this.unspentChoicesAtTransition = 0;
    this.gatheredImprints.clear();
    this.lastStatusSignature = '';
    this.applyQaScene();
    this.publishStatus('idle', 0, null);
  }

  private applyQaScene(): void {
    const scene = this.options.qaScene;
    if (scene === undefined) {
      return;
    }

    if (scene === 'mutation') {
      this.experience.gain(this.experience.snapshot.xpForNextLevel);
      this.ensureMutationDraft();
      return;
    }
    if (scene === 'imprint') {
      this.imprint.offer(['blade', 'symmetry']);
      this.choiceClock.openImprint();
      return;
    }
    if (scene === 'enemy-gallery') {
      const { x, y } = this.player;
      this.enemies = [
        new EnemyModel({ id: 'qa-drifter', archetype: 'drifter', position: { x: x - 300, y: y - 125 }, phase: 0 }),
        new EnemyModel({ id: 'qa-armored-drifter', archetype: 'drifter', position: { x: x - 105, y: y - 145 }, phase: 0.8, captureProfile: 'armored' }),
        new EnemyModel({ id: 'qa-rusher', archetype: 'rusher', position: { x: x + 125, y: y - 140 }, phase: 1.6 }),
        new EnemyModel({ id: 'qa-watcher', archetype: 'watcher', position: { x: x + 320, y: y - 95 }, phase: 2.4 }),
      ];
      this.cutters = [new CutterModel({ id: 'qa-cutter', position: { x: x - 250, y: y + 135 }, phase: 3.2 })];
      this.mimics = [new MimicModel({ id: 'qa-mimic', position: { x, y: y + 165 }, phase: 4 })];
      this.eliteHusks = [new EliteHuskModel({ id: 'qa-elite-husk', position: { x: x + 270, y: y + 145 }, phase: 4.8 })];
      return;
    }
    if (scene === 'exposed-armored') {
      const exposed = new EnemyModel({
        id: 'qa-exposed-armored',
        archetype: 'drifter',
        position: { x: this.player.x + 170, y: this.player.y },
        phase: 0,
        captureProfile: 'armored',
      });
      exposed.capture();
      this.enemies = [exposed];
      this.cutters = [];
      this.mimics = [];
      this.eliteHusks = [];
      return;
    }

    this.beginWardenEncounter();
    if (scene === 'warden-arrival') {
      return;
    }

    const warden = this.warden;
    if (warden === null) {
      return;
    }
    const context = {
      playerPosition: this.player,
      bounds: this.wardenBounds(),
    };
    for (let step = 0; step < 12; step += 1) {
      warden.step(0.1, context);
    }
    this.feedbackTime = 0;
    if (scene === 'warden-arms') {
      this.feedbackState = 'warden-arms';
      return;
    }

    const armClosure = this.qaClosureAround(
      warden.snapshot.armTargets.map((target) => target.position),
      30,
    );
    warden.capture([armClosure]);
    warden.capture([armClosure]);
    if (scene === 'warden-shell') {
      this.feedbackState = 'warden-shell';
      return;
    }

    const shellClosure = this.qaClosureAround([warden.snapshot.center], 72);
    warden.capture([shellClosure]);
    warden.capture([shellClosure]);
    if (scene === 'warden-core') {
      this.feedbackState = 'warden-core';
      return;
    }

    this.runFlow.finishVictory({
      outcome: 'victory',
      huntSeconds: 540,
      wardenSeconds: 91,
      captured: 42,
      level: 9,
      activeImprint: 'symmetry',
      mutations: [
        { id: 'strider', rank: 2 },
        { id: 'marrow', rank: 2 },
        { id: 'mirror-organ', rank: 1 },
        { id: 'fourfold-hunt', rank: 1 },
      ],
      fourfold: true,
      unspentChoices: 0,
    });
    this.runFlow.updatePresentation(2);
  }

  private qaClosureAround(
    points: readonly Vec2[],
    margin: number,
  ): LoopClosure {
    const minX = Math.min(...points.map((point) => point.x)) - margin;
    const maxX = Math.max(...points.map((point) => point.x)) + margin;
    const minY = Math.min(...points.map((point) => point.y)) - margin;
    const maxY = Math.max(...points.map((point) => point.y)) + margin;
    const snapPoint = { x: minX, y: minY };
    return Object.freeze({
      points: Object.freeze([
        snapPoint,
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ]),
      area: (maxX - minX) * (maxY - minY),
      kind: 'direct',
      snapPoint,
    });
  }

  private createMutationDraft(): MutationDraft {
    return new MutationDraft({
      currentRanks: {},
      random: () => this.mutationRandom.next(),
    });
  }

  private configureRunSeed(seed: number): void {
    this.mutationRandom = new SeededRandom(seed ^ 0x1f12_0a9d);
    this.waveRandom = new SeededRandom(seed ^ 0xa51c_0de5);
  }

  private createLoopPath(): LoopPath {
    const snapBonus = this.mutationRank('synapse') * 4;
    return new LoopPath({
      minSampleDistance: PLAYGROUND_TUNING.minSampleDistance,
      minimumArea: PLAYGROUND_TUNING.minimumLoopArea,
      maxSamples: PLAYGROUND_TUNING.maxLoopSamples,
      anchorSnapRadius: PLAYGROUND_TUNING.anchorSnapRadius + snapBonus,
      trailSnapRadius: PLAYGROUND_TUNING.trailSnapRadius + snapBonus,
    });
  }

  private mutationRank(id: MutationId): number {
    return this.mutationDraft.snapshot.ranks[id];
  }

  private resetEnemies(): void {
    const bounds = this.spawnBounds();
    const usableWidth = Math.max(1, bounds.maxX - bounds.minX);
    const usableHeight = Math.max(1, bounds.maxY - bounds.minY);

    this.enemies = INITIAL_ENEMY_SEEDS.map(
      (seed, index) =>
        new EnemyModel({
          id: `enemy-${index + 1}`,
          archetype: seed.archetype,
          position: {
            x: bounds.minX + usableWidth * seed.u,
            y: bounds.minY + usableHeight * seed.v,
          },
          phase: seed.phase,
        }),
    );
    this.cutters = [];
    this.mimics = [];
    this.eliteHusks = [];
  }
}
