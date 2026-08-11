export type MutationId =
  | 'blade-gland'
  | 'carrion'
  | 'fourfold-hunt'
  | 'hunger'
  | 'marrow'
  | 'memory'
  | 'mirror-organ'
  | 'nerve-lattice'
  | 'spike-crown'
  | 'strider'
  | 'synapse';

export type MutationEffect =
  | {
      readonly kind: 'movement-speed-percent';
      readonly percent: number;
    }
  | {
      readonly kind: 'max-hp-flat';
      readonly amount: number;
    }
  | {
      readonly kind: 'current-hp-flat';
      readonly amount: number;
    }
  | {
      readonly kind: 'capture-recovery-flat';
      readonly amount: number;
    }
  | {
      readonly kind: 'capture-recovery-cap-flat';
      readonly amount: number;
    }
  | {
      readonly kind: 'xp-gain-percent';
      readonly percent: number;
    }
  | {
      readonly kind: 'snap-radius-flat';
      readonly amount: number;
    }
  | {
      readonly kind: 'imprint-duration-flat-seconds';
      readonly seconds: number;
    }
  | {
      readonly kind: 'blade-band-flat';
      readonly amount: number;
    }
  | {
      readonly kind: 'blade-stability-damage-flat';
      readonly amount: number;
    }
  | {
      readonly kind: 'spike-recovery-flat';
      readonly amount: number;
    }
  | {
      readonly kind: 'spike-elite-stability-damage-flat';
      readonly amount: number;
    }
  | {
      readonly kind: 'nerve-radius-flat';
      readonly amount: number;
    }
  | {
      readonly kind: 'nerve-slow-percent-points';
      readonly amount: number;
    }
  | {
      readonly kind: 'symmetry-xp-gain-percent';
      readonly percent: number;
    }
  | {
      readonly kind: 'symmetry-preview-unlock';
    }
  | {
      readonly kind: 'fourfold-projection-unlock';
    };

export interface MutationDefinition {
  readonly id: MutationId;
  readonly name: string;
  readonly description: string;
  readonly maxRank: number;
  readonly effectsPerRank: readonly MutationEffect[];
  readonly effectsByRank?: readonly (readonly MutationEffect[])[];
}

export type MutationDefinitionMap = Readonly<
  Record<MutationId, MutationDefinition>
>;

const freezeEffects = (
  effects: readonly MutationEffect[],
): readonly MutationEffect[] =>
  Object.freeze(effects.map((effect) => Object.freeze({ ...effect })));

const defineMutation = (
  definition: MutationDefinition,
): MutationDefinition =>
  Object.freeze({
    ...definition,
    effectsPerRank: freezeEffects(definition.effectsPerRank),
    effectsByRank:
      definition.effectsByRank === undefined
        ? undefined
        : Object.freeze(definition.effectsByRank.map(freezeEffects)),
  });

export const BASE_MUTATION_IDS: readonly MutationId[] = Object.freeze([
  'strider',
  'marrow',
  'carrion',
  'hunger',
  'synapse',
  'memory',
]);

export const LINEAGE_MUTATION_IDS: readonly MutationId[] = Object.freeze([
  'blade-gland',
  'spike-crown',
  'nerve-lattice',
  'mirror-organ',
]);

export const APEX_MUTATION_ID: MutationId = 'fourfold-hunt';

export const MUTATION_IDS: readonly MutationId[] = Object.freeze([
  ...BASE_MUTATION_IDS,
  ...LINEAGE_MUTATION_IDS,
  APEX_MUTATION_ID,
]);

export const MUTATION_DEFINITIONS: MutationDefinitionMap = Object.freeze({
  strider: defineMutation({
    id: 'strider',
    name: 'Strider',
    description: 'Movement speed +10%',
    maxRank: 2,
    effectsPerRank: [{ kind: 'movement-speed-percent', percent: 10 }],
  }),
  marrow: defineMutation({
    id: 'marrow',
    name: 'Marrow',
    description: 'Maximum HP +20 and current HP +20',
    maxRank: 2,
    effectsPerRank: [
      { kind: 'max-hp-flat', amount: 20 },
      { kind: 'current-hp-flat', amount: 20 },
    ],
  }),
  carrion: defineMutation({
    id: 'carrion',
    name: 'Carrion',
    description: 'Capture recovery +2 and recovery cap +4',
    maxRank: 2,
    effectsPerRank: [
      { kind: 'capture-recovery-flat', amount: 2 },
      { kind: 'capture-recovery-cap-flat', amount: 4 },
    ],
  }),
  hunger: defineMutation({
    id: 'hunger',
    name: 'Hunger',
    description: 'XP gain +10%',
    maxRank: 2,
    effectsPerRank: [{ kind: 'xp-gain-percent', percent: 10 }],
  }),
  synapse: defineMutation({
    id: 'synapse',
    name: 'Synapse',
    description: 'Loop snap radius +4 px',
    maxRank: 2,
    effectsPerRank: [{ kind: 'snap-radius-flat', amount: 4 }],
  }),
  memory: defineMutation({
    id: 'memory',
    name: 'Memory',
    description: 'Imprint duration +8 seconds',
    maxRank: 2,
    effectsPerRank: [
      { kind: 'imprint-duration-flat-seconds', seconds: 8 },
    ],
  }),
  'blade-gland': defineMutation({
    id: 'blade-gland',
    name: 'Blade Gland',
    description: 'Blade ring +18 px; rank 2 pierces one extra stability.',
    maxRank: 2,
    effectsPerRank: [{ kind: 'blade-band-flat', amount: 18 }],
    effectsByRank: [
      [{ kind: 'blade-band-flat', amount: 18 }],
      [
        { kind: 'blade-band-flat', amount: 18 },
        { kind: 'blade-stability-damage-flat', amount: 1 },
      ],
    ],
  }),
  'spike-crown': defineMutation({
    id: 'spike-crown',
    name: 'Spike Crown',
    description: 'Spike recovery +2; rank 2 cracks elite stability.',
    maxRank: 2,
    effectsPerRank: [{ kind: 'spike-recovery-flat', amount: 2 }],
    effectsByRank: [
      [{ kind: 'spike-recovery-flat', amount: 2 }],
      [
        { kind: 'spike-recovery-flat', amount: 2 },
        { kind: 'spike-elite-stability-damage-flat', amount: 1 },
      ],
    ],
  }),
  'nerve-lattice': defineMutation({
    id: 'nerve-lattice',
    name: 'Nerve Lattice',
    description: 'Nerve field +28 px and prey speed -10 percentage points.',
    maxRank: 2,
    effectsPerRank: [
      { kind: 'nerve-radius-flat', amount: 28 },
      { kind: 'nerve-slow-percent-points', amount: 10 },
    ],
  }),
  'mirror-organ': defineMutation({
    id: 'mirror-organ',
    name: 'Mirror Organ',
    description: 'Symmetry copy XP +10%; rank 2 reveals its preview.',
    maxRank: 2,
    effectsPerRank: [
      { kind: 'symmetry-xp-gain-percent', percent: 10 },
    ],
    effectsByRank: [
      [{ kind: 'symmetry-xp-gain-percent', percent: 10 }],
      [
        { kind: 'symmetry-xp-gain-percent', percent: 10 },
        { kind: 'symmetry-preview-unlock' },
      ],
    ],
  }),
  'fourfold-hunt': defineMutation({
    id: 'fourfold-hunt',
    name: 'Fourfold Hunt',
    description: 'Project every closure in four cardinal directions.',
    maxRank: 1,
    effectsPerRank: [{ kind: 'fourfold-projection-unlock' }],
  }),
});

export const getMutationDefinition = (
  id: MutationId,
): MutationDefinition => MUTATION_DEFINITIONS[id];
