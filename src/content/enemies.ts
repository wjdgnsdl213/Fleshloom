export type EnemyArchetype = 'drifter' | 'rusher' | 'watcher';

export type EnemyImprintKind = 'blade' | 'nerve' | 'spike' | 'symmetry';

export interface EnemyDefinitionBase {
  readonly archetype: EnemyArchetype;
  readonly radius: number;
  readonly contactDamage: number;
  readonly xp: number;
  readonly captureRecovery: number;
  readonly baseSpeed: number;
  readonly imprintKind?: EnemyImprintKind;
}

export interface DrifterEnemyDefinition extends EnemyDefinitionBase {
  readonly archetype: 'drifter';
}

export interface RusherEnemyDefinition extends EnemyDefinitionBase {
  readonly archetype: 'rusher';
  readonly imprintKind: 'spike';
  readonly rushTriggerDistance: number;
  readonly telegraphSeconds: number;
  readonly chargeSpeed: number;
  readonly chargeSeconds: number;
  readonly recoverSeconds: number;
}

export interface WatcherEnemyDefinition extends EnemyDefinitionBase {
  readonly archetype: 'watcher';
  readonly imprintKind: 'nerve';
  readonly standoffMinDistance: number;
  readonly standoffMaxDistance: number;
  readonly lockSeconds: number;
  readonly cooldownSeconds: number;
}

export type EnemyDefinition =
  | DrifterEnemyDefinition
  | RusherEnemyDefinition
  | WatcherEnemyDefinition;

export interface EnemyDefinitionMap {
  readonly drifter: DrifterEnemyDefinition;
  readonly rusher: RusherEnemyDefinition;
  readonly watcher: WatcherEnemyDefinition;
}

const drifter = Object.freeze({
  archetype: 'drifter',
  radius: 18,
  contactDamage: 12,
  xp: 10,
  captureRecovery: 3,
  baseSpeed: 42,
} satisfies DrifterEnemyDefinition);

const rusher = Object.freeze({
  archetype: 'rusher',
  radius: 20,
  contactDamage: 18,
  xp: 16,
  captureRecovery: 4,
  baseSpeed: 58,
  imprintKind: 'spike',
  rushTriggerDistance: 180,
  telegraphSeconds: 0.8,
  chargeSpeed: 280,
  chargeSeconds: 0.42,
  recoverSeconds: 1.1,
} satisfies RusherEnemyDefinition);

const watcher = Object.freeze({
  archetype: 'watcher',
  radius: 19,
  contactDamage: 14,
  xp: 18,
  captureRecovery: 4,
  baseSpeed: 48,
  imprintKind: 'nerve',
  standoffMinDistance: 170,
  standoffMaxDistance: 250,
  lockSeconds: 0.9,
  cooldownSeconds: 2.1,
} satisfies WatcherEnemyDefinition);

export const ENEMY_DEFINITIONS: EnemyDefinitionMap = Object.freeze({
  drifter,
  rusher,
  watcher,
});

export const getEnemyDefinition = (
  archetype: EnemyArchetype,
): EnemyDefinition => ENEMY_DEFINITIONS[archetype];
