/**
 * The single data contract between the simulation and any renderer.
 *
 * GameApp builds one PlaygroundRenderState per frame; a renderer consumes it
 * and owns nothing about game rules. Every type here is plain data — no Pixi,
 * no three.js — so the same state drives both the 2D and the 3D backends.
 */

import type {
  EnemyCaptureProfile,
  EnemyImprintKind,
} from '../content/enemies';
import type { FullRunEnemyArchetype } from '../content/fullRunEnemies';
import type { WorldBounds } from '../config/world';
import type { Vec2 } from '../core/geometry/vector';
import type {
  WardenAttackGeometry,
  WardenSnapshot,
} from '../game/boss/WardenModel';
import type { LoopClosure, LoopPreview } from '../game/loop/LoopPath';
import type { Camera2DSnapshot } from '../game/world/Camera2D';

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
