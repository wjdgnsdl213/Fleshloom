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
    name: '질주 근섬유',
    description: '이동 속도를 높여 더 빠르게 고리를 그립니다.',
    maxRank: 2,
    effectsPerRank: [{ kind: 'movement-speed-percent', percent: 10 }],
  }),
  marrow: defineMutation({
    id: 'marrow',
    name: '골수 증식',
    description: '최대 체력과 현재 체력을 함께 늘립니다.',
    maxRank: 2,
    effectsPerRank: [
      { kind: 'max-hp-flat', amount: 20 },
      { kind: 'current-hp-flat', amount: 20 },
    ],
  }),
  carrion: defineMutation({
    id: 'carrion',
    name: '사체 소화',
    description: '포획 회복량과 한 번에 회복할 수 있는 상한을 늘립니다.',
    maxRank: 2,
    effectsPerRank: [
      { kind: 'capture-recovery-flat', amount: 2 },
      { kind: 'capture-recovery-cap-flat', amount: 4 },
    ],
  }),
  hunger: defineMutation({
    id: 'hunger',
    name: '포식 본능',
    description: '모든 포획에서 얻는 경험치를 늘립니다.',
    maxRank: 2,
    effectsPerRank: [{ kind: 'xp-gain-percent', percent: 10 }],
  }),
  synapse: defineMutation({
    id: 'synapse',
    name: '감각 시냅스',
    description: '닻과 이전 궤적에 고리가 붙는 거리를 늘립니다.',
    maxRank: 2,
    effectsPerRank: [{ kind: 'snap-radius-flat', amount: 4 }],
  }),
  memory: defineMutation({
    id: 'memory',
    name: '생체 기억',
    description: '흡수한 임프린트의 지속시간을 늘립니다.',
    maxRank: 2,
    effectsPerRank: [
      { kind: 'imprint-duration-flat-seconds', seconds: 8 },
    ],
  }),
  'blade-gland': defineMutation({
    id: 'blade-gland',
    name: '칼날샘',
    description: '칼날 띠를 넓히고 최종 등급에서 안정도를 추가 파괴합니다.',
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
    name: '가시 왕관',
    description: '가시 임프린트의 회복량을 높이고 Elite 안정도를 파괴합니다.',
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
    name: '신경 격자',
    description: '신경장 범위와 둔화 강도를 함께 높입니다.',
    maxRank: 2,
    effectsPerRank: [
      { kind: 'nerve-radius-flat', amount: 28 },
      { kind: 'nerve-slow-percent-points', amount: 10 },
    ],
  }),
  'mirror-organ': defineMutation({
    id: 'mirror-organ',
    name: '거울 기관',
    description: '대칭 고리의 경험치를 높이고 최종 등급에서 미리보기를 해금합니다.',
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
    name: '사중 사냥',
    description: '모든 고리 폐쇄를 네 방향으로 투영하는 최종 변이입니다.',
    maxRank: 1,
    effectsPerRank: [{ kind: 'fourfold-projection-unlock' }],
  }),
});

export const getMutationDefinition = (
  id: MutationId,
): MutationDefinition => MUTATION_DEFINITIONS[id];
