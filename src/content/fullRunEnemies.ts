import type { EnemyArchetype, EnemyImprintKind } from './enemies';

export type FullRunEnemyArchetype =
  | EnemyArchetype
  | 'cutter'
  | 'mimic'
  | 'elite-husk';

export type FullRunImprintKind = EnemyImprintKind;

export interface FullRunEnemyDefinition {
  readonly archetype: FullRunEnemyArchetype;
  readonly radius: number;
  readonly contactDamage: number;
  readonly xp: number;
  readonly captureRecovery: number;
  readonly baseSpeed: number;
  readonly imprintKind?: FullRunImprintKind;
  readonly stability: 1 | 2;
}

const cutter = Object.freeze({
  archetype: 'cutter',
  radius: 20,
  contactDamage: 16,
  xp: 24,
  captureRecovery: 5,
  baseSpeed: 55,
  imprintKind: 'blade',
  stability: 1,
} satisfies FullRunEnemyDefinition);

const mimic = Object.freeze({
  archetype: 'mimic',
  radius: 18,
  contactDamage: 15,
  xp: 22,
  captureRecovery: 4,
  baseSpeed: 70,
  imprintKind: 'symmetry',
  stability: 1,
} satisfies FullRunEnemyDefinition);

const eliteHusk = Object.freeze({
  archetype: 'elite-husk',
  radius: 34,
  contactDamage: 24,
  xp: 60,
  captureRecovery: 10,
  baseSpeed: 34,
  stability: 2,
} satisfies FullRunEnemyDefinition);

export const M3_ENEMY_DEFINITIONS = Object.freeze({
  cutter,
  mimic,
  'elite-husk': eliteHusk,
});
