import { pointInPolygon } from '../../core/geometry/polygon';
import type { Vec2 } from '../../core/geometry/vector';
import type { LoopClosure } from '../loop/LoopPath';

export const MAX_WARDEN_STEP_SECONDS = 0.1;

export const WARDEN_BALANCE = Object.freeze({
  arrivalSeconds: 1.2,
  armTargetRadius: 20,
  armOrbitRadiusX: 112,
  armOrbitRadiusY: 64,
  armOrbitRadiansPerSecond: 0.55,
  armTelegraphSeconds: 0.7,
  armRecoverySeconds: 0.9,
  armLashHalfWidth: 18,
  armLashDamage: 20,
  shellTargetRadius: 48,
  shellTelegraphSeconds: 0.8,
  shellRecoverySeconds: 1.1,
  shellRingRadius: 150,
  shellRingHalfWidth: 18,
  shellDischargeDamage: 18,
  captureRecovery: 8,
  coreRadius: 20,
  controlNodeRadius: 12,
  controlNodeOffsetX: 70,
  controlNodeOffsetY: 56,
  collapseSeconds: 1.4,
});

const EPSILON = 1e-9;
const TARGET_LAYOUT_WIDTH = 320;
const TARGET_LAYOUT_HEIGHT = 240;
const ARM_CAPTURE_GRACE_SECONDS = 0.3;
const SHELL_CAPTURE_GRACE_SECONDS = 0.4;

export type WardenStage =
  | 'arrival'
  | 'arms'
  | 'shell'
  | 'core'
  | 'defeated';

export interface WardenSpawn {
  readonly id: string;
  readonly phase?: number;
}

export interface WardenArenaBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface WardenStepContext {
  readonly playerPosition: Vec2;
  readonly bounds: WardenArenaBounds;
}

export interface WardenStageProgressSnapshot {
  readonly completed: number;
  readonly required: number;
}

export interface WardenArmTargetSnapshot {
  readonly id: string;
  readonly index: 0 | 1;
  readonly position: Vec2;
  readonly radius: number;
  readonly severed: boolean;
}

export interface WardenShellPlateSnapshot {
  readonly id: string;
  readonly index: 0 | 1;
  readonly side: 'left' | 'right';
  readonly position: Vec2;
  readonly radius: number;
  readonly intact: boolean;
}

export interface WardenCoreTargetSnapshot {
  readonly id: string;
  readonly position: Vec2;
  readonly radius: number;
  readonly active: boolean;
}

export interface WardenControlNodeSnapshot {
  readonly id: string;
  readonly index: 0 | 1;
  readonly position: Vec2;
  readonly radius: number;
  readonly active: boolean;
}

export interface WardenCorridorGeometry {
  readonly kind: 'corridor';
  readonly start: Vec2;
  readonly end: Vec2;
  readonly halfWidth: number;
}

export interface WardenRingGeometry {
  readonly kind: 'ring';
  readonly center: Vec2;
  readonly radius: number;
  readonly halfWidth: number;
}

export type WardenAttackGeometry =
  | WardenCorridorGeometry
  | WardenRingGeometry;

export type WardenAttackKind = 'arm-lash' | 'radial-discharge';
export type WardenAttackState = 'telegraph' | 'recovery';

export interface WardenAttackSnapshot {
  readonly kind: WardenAttackKind;
  readonly state: WardenAttackState;
  readonly sourceObjectiveId: string;
  readonly remainingSeconds: number;
  readonly lockedGeometry: WardenAttackGeometry | null;
}

export interface WardenSnapshot {
  readonly id: string;
  readonly phase: number;
  readonly stage: WardenStage;
  readonly stageProgress: WardenStageProgressSnapshot;
  readonly center: Vec2;
  readonly armTargets: readonly WardenArmTargetSnapshot[];
  readonly shellPlates: readonly WardenShellPlateSnapshot[];
  readonly core: WardenCoreTargetSnapshot;
  readonly controlNodes: readonly WardenControlNodeSnapshot[];
  readonly attack: WardenAttackSnapshot | null;
  readonly encounterElapsed: number;
  readonly collapseRemaining: number;
  readonly endingReady: boolean;
}

export interface WardenLashAction {
  readonly type: 'warden-lash';
  readonly sourceId: string;
  readonly armId: string;
  readonly damage: number;
  readonly geometry: WardenCorridorGeometry;
}

export interface WardenDischargeAction {
  readonly type: 'warden-discharge';
  readonly sourceId: string;
  readonly damage: number;
  readonly geometry: WardenRingGeometry;
}

export interface WardenCollapseCompleteAction {
  readonly type: 'warden-collapse-complete';
  readonly sourceId: string;
}

export type WardenAction =
  | WardenLashAction
  | WardenDischargeAction
  | WardenCollapseCompleteAction;

export type WardenCaptureResult =
  | {
      readonly kind: 'arm-severed';
      readonly objectiveId: string;
      readonly armIndex: 0 | 1;
      readonly projectionIndex: number;
      readonly recovery: number;
      readonly nextStage: WardenStage;
    }
  | {
      readonly kind: 'shell-peeled';
      readonly objectiveId: string;
      readonly plateIndex: 0 | 1;
      readonly projectionIndex: number;
      readonly recovery: number;
      readonly nextStage: WardenStage;
    }
  | {
      readonly kind: 'core-closed';
      readonly objectiveIds: readonly string[];
      readonly projectionIndex: number;
      readonly recovery: 0;
      readonly collapseSeconds: number;
    }
  | {
      readonly kind: 'ignored';
      readonly reason:
        | 'arrival'
        | 'defeated'
        | 'invalid'
        | 'no-objective-enclosed';
    };

interface MutableVec2 {
  x: number;
  y: number;
}

interface MutableAttack {
  kind: WardenAttackKind;
  state: WardenAttackState;
  sourceObjectiveId: string;
  remainingSeconds: number;
  lockedGeometry: WardenAttackGeometry | null;
  armIndex: 0 | 1 | null;
}

const EMPTY_ACTIONS: readonly WardenAction[] = Object.freeze([]);

const isFinitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const isFiniteVec2 = (value: unknown): value is Vec2 => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { readonly x?: unknown; readonly y?: unknown };
  return (
    typeof candidate.x === 'number' &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === 'number' &&
    Number.isFinite(candidate.y)
  );
};

const isValidBounds = (bounds: WardenArenaBounds): boolean =>
  Number.isFinite(bounds.minX) &&
  Number.isFinite(bounds.minY) &&
  Number.isFinite(bounds.maxX) &&
  Number.isFinite(bounds.maxY) &&
  bounds.minX <= bounds.maxX &&
  bounds.minY <= bounds.maxY;

const cleanZero = (value: number): number => (value === 0 ? 0 : value);

const frozenVec2 = (value: Vec2): Vec2 =>
  Object.freeze({ x: cleanZero(value.x), y: cleanZero(value.y) });

const freezeGeometry = (
  geometry: WardenAttackGeometry,
): WardenAttackGeometry =>
  geometry.kind === 'corridor'
    ? Object.freeze({
        kind: 'corridor',
        start: frozenVec2(geometry.start),
        end: frozenVec2(geometry.end),
        halfWidth: geometry.halfWidth,
      })
    : Object.freeze({
        kind: 'ring',
        center: frozenVec2(geometry.center),
        radius: geometry.radius,
        halfWidth: geometry.halfWidth,
      });

const isValidProjections = (
  projections: readonly LoopClosure[],
): boolean =>
  Array.isArray(projections) &&
  projections.every(
    (projection) =>
      typeof projection === 'object' &&
      projection !== null &&
      Number.isFinite(projection.area) &&
      isFiniteVec2(projection.snapPoint) &&
      Array.isArray(projection.points) &&
      projection.points.every(isFiniteVec2),
  );

const frozenIgnored = (
  reason: Extract<WardenCaptureResult, { readonly kind: 'ignored' }>['reason'],
): WardenCaptureResult => Object.freeze({ kind: 'ignored', reason });

export class WardenModel {
  private readonly id: string;
  private readonly phase: number;
  private stage: WardenStage = 'arrival';
  private arrivalRemaining: number = WARDEN_BALANCE.arrivalSeconds;
  private encounterElapsed = 0;
  private readonly center: MutableVec2 = { x: 0, y: 0 };
  private layoutScale = 0;
  private ringScale = 0;
  private readonly severedArms = [false, false];
  private readonly intactShellPlates = [true, true];
  private attack: MutableAttack | null = null;
  private attackCooldownRemaining = 0;
  private nextArmAttackIndex: 0 | 1 = 0;
  private collapseRemaining = 0;
  private endingReady = false;
  private collapseCompleteEmitted = false;

  public constructor(spawn: WardenSpawn) {
    if (typeof spawn.id !== 'string' || spawn.id.length === 0) {
      throw new RangeError('Warden id must not be empty');
    }

    const phase = spawn.phase ?? 0;
    if (!Number.isFinite(phase)) {
      throw new RangeError('Warden phase must be finite');
    }

    this.id = spawn.id;
    this.phase = phase;
  }

  public get snapshot(): WardenSnapshot {
    const armTargets = Object.freeze(
      ([0, 1] as const).map((index) =>
        Object.freeze({
          id: this.armId(index),
          index,
          position: frozenVec2(this.armPosition(index)),
          radius: WARDEN_BALANCE.armTargetRadius * this.layoutScale,
          severed: this.severedArms[index]!,
        }),
      ),
    );
    const shellPlates = Object.freeze(
      ([0, 1] as const).map((index) =>
        Object.freeze({
          id: this.shellPlateId(index),
          index,
          side: index === 0 ? ('left' as const) : ('right' as const),
          position: frozenVec2(this.center),
          radius: WARDEN_BALANCE.shellTargetRadius * this.layoutScale,
          intact: this.intactShellPlates[index]!,
        }),
      ),
    );
    const controlNodes = Object.freeze(
      ([0, 1] as const).map((index) =>
        Object.freeze({
          id: this.controlNodeId(index),
          index,
          position: frozenVec2(this.controlNodePosition(index)),
          radius: WARDEN_BALANCE.controlNodeRadius * this.layoutScale,
          active: this.stage === 'core',
        }),
      ),
    );

    return Object.freeze({
      id: this.id,
      phase: this.phase,
      stage: this.stage,
      stageProgress: this.stageProgress(),
      center: frozenVec2(this.center),
      armTargets,
      shellPlates,
      core: Object.freeze({
        id: this.coreId(),
        position: frozenVec2(this.center),
        radius: WARDEN_BALANCE.coreRadius * this.layoutScale,
        active: this.stage === 'core',
      }),
      controlNodes,
      attack: this.attackSnapshot(),
      encounterElapsed: this.encounterElapsed,
      collapseRemaining: this.collapseRemaining,
      endingReady: this.endingReady,
    });
  }

  public step(
    deltaSeconds: number,
    context: WardenStepContext,
  ): readonly WardenAction[] {
    if (
      !isFinitePositive(deltaSeconds) ||
      !isFiniteVec2(context.playerPosition) ||
      !isValidBounds(context.bounds) ||
      (this.stage === 'defeated' && this.endingReady)
    ) {
      return EMPTY_ACTIONS;
    }

    const stepSeconds = Math.min(deltaSeconds, MAX_WARDEN_STEP_SECONDS);
    this.updateLayout(context.bounds);
    this.encounterElapsed += stepSeconds;

    if (this.stage === 'arrival') {
      this.arrivalRemaining = Math.max(
        0,
        this.arrivalRemaining - stepSeconds,
      );
      if (this.arrivalRemaining <= EPSILON) {
        this.arrivalRemaining = 0;
        this.enterStage('arms');
      }
      return EMPTY_ACTIONS;
    }

    if (this.stage === 'defeated') {
      return this.stepCollapse(stepSeconds);
    }

    if (this.stage === 'core') {
      return EMPTY_ACTIONS;
    }

    return this.stepAttack(stepSeconds, context.playerPosition);
  }

  public capture(
    projections: readonly LoopClosure[],
  ): WardenCaptureResult {
    if (!isValidProjections(projections)) {
      return frozenIgnored('invalid');
    }

    switch (this.stage) {
      case 'arrival':
        return frozenIgnored('arrival');
      case 'arms':
        return this.captureArm(projections);
      case 'shell':
        return this.captureShell(projections);
      case 'core':
        return this.captureCore(projections);
      case 'defeated':
        return frozenIgnored('defeated');
    }
  }

  public begin(): void {
    this.stage = 'arrival';
    this.arrivalRemaining = WARDEN_BALANCE.arrivalSeconds;
    this.encounterElapsed = 0;
    this.center.x = 0;
    this.center.y = 0;
    this.layoutScale = 0;
    this.ringScale = 0;
    this.severedArms[0] = false;
    this.severedArms[1] = false;
    this.intactShellPlates[0] = true;
    this.intactShellPlates[1] = true;
    this.nextArmAttackIndex = 0;
    this.collapseRemaining = 0;
    this.endingReady = false;
    this.collapseCompleteEmitted = false;
    this.clearAttack();
  }

  public reset(): void {
    this.begin();
  }

  private captureArm(
    projections: readonly LoopClosure[],
  ): WardenCaptureResult {
    for (
      let projectionIndex = 0;
      projectionIndex < projections.length;
      projectionIndex += 1
    ) {
      const polygon = projections[projectionIndex]!.points;

      for (const armIndex of [0, 1] as const) {
        if (
          this.severedArms[armIndex] ||
          !pointInPolygon(this.armPosition(armIndex), polygon)
        ) {
          continue;
        }

        this.severedArms[armIndex] = true;
        const objectiveId = this.armId(armIndex);
        const stageComplete = this.severedArms.every(Boolean);

        if (stageComplete) {
          this.enterStage('shell');
        } else if (this.attack?.armIndex === armIndex) {
          this.clearAttack(ARM_CAPTURE_GRACE_SECONDS);
        }

        return Object.freeze({
          kind: 'arm-severed',
          objectiveId,
          armIndex,
          projectionIndex,
          recovery: WARDEN_BALANCE.captureRecovery,
          nextStage: this.stage,
        });
      }
    }

    return frozenIgnored('no-objective-enclosed');
  }

  private captureShell(
    projections: readonly LoopClosure[],
  ): WardenCaptureResult {
    const projectionIndex = projections.findIndex((projection) =>
      pointInPolygon(this.center, projection.points),
    );

    if (projectionIndex < 0) {
      return frozenIgnored('no-objective-enclosed');
    }

    const plateIndex = this.intactShellPlates.findIndex(Boolean);
    if (plateIndex !== 0 && plateIndex !== 1) {
      return frozenIgnored('no-objective-enclosed');
    }

    this.intactShellPlates[plateIndex] = false;
    const objectiveId = this.shellPlateId(plateIndex);
    const stageComplete = this.intactShellPlates.every(
      (intact) => !intact,
    );

    if (stageComplete) {
      this.enterStage('core');
    } else {
      this.clearAttack(SHELL_CAPTURE_GRACE_SECONDS);
    }

    return Object.freeze({
      kind: 'shell-peeled',
      objectiveId,
      plateIndex,
      projectionIndex,
      recovery: WARDEN_BALANCE.captureRecovery,
      nextStage: this.stage,
    });
  }

  private captureCore(
    projections: readonly LoopClosure[],
  ): WardenCaptureResult {
    const objectivePoints = [
      { id: this.coreId(), position: frozenVec2(this.center) },
      {
        id: this.controlNodeId(0),
        position: frozenVec2(this.controlNodePosition(0)),
      },
      {
        id: this.controlNodeId(1),
        position: frozenVec2(this.controlNodePosition(1)),
      },
    ];
    const projectionIndex = projections.findIndex((projection) =>
      objectivePoints.every((objective) =>
        pointInPolygon(objective.position, projection.points),
      ),
    );

    if (projectionIndex < 0) {
      return frozenIgnored('no-objective-enclosed');
    }

    this.enterStage('defeated');
    this.collapseRemaining = WARDEN_BALANCE.collapseSeconds;
    const objectiveIds = Object.freeze(
      objectivePoints.map((objective) => objective.id),
    );

    return Object.freeze({
      kind: 'core-closed',
      objectiveIds,
      projectionIndex,
      recovery: 0 as const,
      collapseSeconds: WARDEN_BALANCE.collapseSeconds,
    });
  }

  private stepAttack(
    deltaSeconds: number,
    playerPosition: Vec2,
  ): readonly WardenAction[] {
    if (this.attackCooldownRemaining > EPSILON) {
      this.attackCooldownRemaining = Math.max(
        0,
        this.attackCooldownRemaining - deltaSeconds,
      );
      return EMPTY_ACTIONS;
    }

    if (this.attack === null) {
      if (this.stage === 'arms') {
        this.startArmTelegraph(playerPosition);
      } else if (this.stage === 'shell') {
        this.startShellTelegraph();
      }
    }

    if (this.attack === null) {
      return EMPTY_ACTIONS;
    }

    this.attack.remainingSeconds = Math.max(
      0,
      this.attack.remainingSeconds - deltaSeconds,
    );

    if (this.attack.remainingSeconds > EPSILON) {
      return EMPTY_ACTIONS;
    }

    if (this.attack.state === 'recovery') {
      this.clearAttack();
      return EMPTY_ACTIONS;
    }

    const action = this.createAttackAction(this.attack);
    this.attack.state = 'recovery';
    this.attack.remainingSeconds =
      this.attack.kind === 'arm-lash'
        ? WARDEN_BALANCE.armRecoverySeconds
        : WARDEN_BALANCE.shellRecoverySeconds;
    this.attack.lockedGeometry = null;

    return Object.freeze([action]);
  }

  private startArmTelegraph(playerPosition: Vec2): void {
    const armIndex = this.nextAvailableArm(this.nextArmAttackIndex);
    if (armIndex === null) {
      return;
    }

    this.nextArmAttackIndex = armIndex === 0 ? 1 : 0;
    this.attack = {
      kind: 'arm-lash',
      state: 'telegraph',
      sourceObjectiveId: this.armId(armIndex),
      remainingSeconds: WARDEN_BALANCE.armTelegraphSeconds,
      lockedGeometry: {
        kind: 'corridor',
        start: frozenVec2(this.orbitArmPosition(armIndex)),
        end: frozenVec2(playerPosition),
        halfWidth:
          WARDEN_BALANCE.armLashHalfWidth * Math.max(0.5, this.layoutScale),
      },
      armIndex,
    };
  }

  private startShellTelegraph(): void {
    this.attack = {
      kind: 'radial-discharge',
      state: 'telegraph',
      sourceObjectiveId: `${this.id}:shell`,
      remainingSeconds: WARDEN_BALANCE.shellTelegraphSeconds,
      lockedGeometry: {
        kind: 'ring',
        center: frozenVec2(this.center),
        radius: WARDEN_BALANCE.shellRingRadius * this.ringScale,
        halfWidth: WARDEN_BALANCE.shellRingHalfWidth * this.ringScale,
      },
      armIndex: null,
    };
  }

  private createAttackAction(attack: MutableAttack): WardenAction {
    if (attack.kind === 'arm-lash') {
      const geometry = attack.lockedGeometry;
      if (geometry === null || geometry.kind !== 'corridor') {
        throw new Error('arm lash requires locked corridor geometry');
      }

      return Object.freeze({
        type: 'warden-lash',
        sourceId: this.id,
        armId: attack.sourceObjectiveId,
        damage: WARDEN_BALANCE.armLashDamage,
        geometry: freezeGeometry(geometry) as WardenCorridorGeometry,
      });
    }

    const geometry = attack.lockedGeometry;
    if (geometry === null || geometry.kind !== 'ring') {
      throw new Error('radial discharge requires locked ring geometry');
    }

    return Object.freeze({
      type: 'warden-discharge',
      sourceId: this.id,
      damage: WARDEN_BALANCE.shellDischargeDamage,
      geometry: freezeGeometry(geometry) as WardenRingGeometry,
    });
  }

  private stepCollapse(deltaSeconds: number): readonly WardenAction[] {
    this.collapseRemaining = Math.max(
      0,
      this.collapseRemaining - deltaSeconds,
    );

    if (
      this.collapseRemaining > EPSILON ||
      this.collapseCompleteEmitted
    ) {
      return EMPTY_ACTIONS;
    }

    this.collapseRemaining = 0;
    this.collapseCompleteEmitted = true;
    this.endingReady = true;
    return Object.freeze([
      Object.freeze({
        type: 'warden-collapse-complete' as const,
        sourceId: this.id,
      }),
    ]);
  }

  private enterStage(stage: WardenStage): void {
    this.stage = stage;
    this.clearAttack();
  }

  private clearAttack(cooldownSeconds = 0): void {
    this.attack = null;
    this.attackCooldownRemaining = cooldownSeconds;
  }

  private updateLayout(bounds: WardenArenaBounds): void {
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    this.center.x = bounds.minX + width / 2;
    this.center.y = bounds.minY + height / 2;
    this.layoutScale = Math.max(
      0,
      Math.min(1, width / TARGET_LAYOUT_WIDTH, height / TARGET_LAYOUT_HEIGHT),
    );
    const halfMinimumExtent = Math.max(0, Math.min(width, height) / 2);
    this.ringScale = Math.max(
      0,
      Math.min(
        1,
        halfMinimumExtent /
          (WARDEN_BALANCE.shellRingRadius +
            WARDEN_BALANCE.shellRingHalfWidth),
      ),
    );
  }

  private armPosition(index: 0 | 1): Vec2 {
    if (
      this.attack?.kind === 'arm-lash' &&
      this.attack.state === 'telegraph' &&
      this.attack.armIndex === index &&
      this.attack.lockedGeometry?.kind === 'corridor'
    ) {
      return this.attack.lockedGeometry.start;
    }

    return this.orbitArmPosition(index);
  }

  private orbitArmPosition(index: 0 | 1): Vec2 {
    const angle =
      this.phase +
      this.encounterElapsed * WARDEN_BALANCE.armOrbitRadiansPerSecond +
      index * Math.PI;
    return {
      x:
        this.center.x +
        Math.cos(angle) *
          WARDEN_BALANCE.armOrbitRadiusX *
          this.layoutScale,
      y:
        this.center.y +
        Math.sin(angle) *
          WARDEN_BALANCE.armOrbitRadiusY *
          this.layoutScale,
    };
  }

  private controlNodePosition(index: 0 | 1): Vec2 {
    return {
      x:
        this.center.x +
        (index === 0 ? -1 : 1) *
          WARDEN_BALANCE.controlNodeOffsetX *
          this.layoutScale,
      y:
        this.center.y +
        WARDEN_BALANCE.controlNodeOffsetY * this.layoutScale,
    };
  }

  private nextAvailableArm(start: 0 | 1): 0 | 1 | null {
    if (!this.severedArms[start]) {
      return start;
    }

    const other = start === 0 ? 1 : 0;
    return this.severedArms[other] ? null : other;
  }

  private stageProgress(): WardenStageProgressSnapshot {
    switch (this.stage) {
      case 'arrival':
        return Object.freeze({
          completed:
            WARDEN_BALANCE.arrivalSeconds - this.arrivalRemaining,
          required: WARDEN_BALANCE.arrivalSeconds,
        });
      case 'arms':
        return Object.freeze({
          completed: this.severedArms.filter(Boolean).length,
          required: 2,
        });
      case 'shell':
        return Object.freeze({
          completed: this.intactShellPlates.filter(
            (intact) => !intact,
          ).length,
          required: 2,
        });
      case 'core':
        return Object.freeze({ completed: 0, required: 1 });
      case 'defeated':
        return Object.freeze({ completed: 1, required: 1 });
    }
  }

  private attackSnapshot(): WardenAttackSnapshot | null {
    if (this.attack === null) {
      return null;
    }

    return Object.freeze({
      kind: this.attack.kind,
      state: this.attack.state,
      sourceObjectiveId: this.attack.sourceObjectiveId,
      remainingSeconds: this.attack.remainingSeconds,
      lockedGeometry:
        this.attack.lockedGeometry === null
          ? null
          : freezeGeometry(this.attack.lockedGeometry),
    });
  }

  private armId(index: 0 | 1): string {
    return `${this.id}:arm-${index}`;
  }

  private shellPlateId(index: 0 | 1): string {
    return `${this.id}:shell-${index}`;
  }

  private coreId(): string {
    return `${this.id}:core`;
  }

  private controlNodeId(index: 0 | 1): string {
    return `${this.id}:node-${index}`;
  }
}
