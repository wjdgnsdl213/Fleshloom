import { describe, expect, it } from 'vitest';
import {
  APEX_MUTATION_ID,
  BASE_MUTATION_IDS,
  LINEAGE_MUTATION_IDS,
  MUTATION_DEFINITIONS,
  MUTATION_IDS,
  type MutationId,
} from '../../../src/content/mutations';
import {
  MutationDraft,
  type MutationRandom,
  type MutationRankInput,
} from '../../../src/game/progression/MutationDraft';

const sequenceRandom = (values: readonly number[]): MutationRandom => {
  let index = 0;
  return () => values[index++ % values.length]!;
};

const createDraft = (
  currentRanks: MutationRankInput = {},
  random: MutationRandom = sequenceRandom([0, 0, 0]),
): MutationDraft => new MutationDraft({ currentRanks, random });

describe('mutation definitions', () => {
  it('defines all six M2 mutations and their per-rank effects', () => {
    expect(BASE_MUTATION_IDS).toEqual([
      'strider',
      'marrow',
      'carrion',
      'hunger',
      'synapse',
      'memory',
    ]);
    expect(MUTATION_DEFINITIONS.strider.effectsPerRank).toEqual([
      { kind: 'movement-speed-percent', percent: 10 },
    ]);
    expect(MUTATION_DEFINITIONS.marrow.effectsPerRank).toEqual([
      { kind: 'max-hp-flat', amount: 20 },
      { kind: 'current-hp-flat', amount: 20 },
    ]);
    expect(MUTATION_DEFINITIONS.carrion.effectsPerRank).toEqual([
      { kind: 'capture-recovery-flat', amount: 2 },
      { kind: 'capture-recovery-cap-flat', amount: 4 },
    ]);
    expect(MUTATION_DEFINITIONS.hunger.effectsPerRank).toEqual([
      { kind: 'xp-gain-percent', percent: 10 },
    ]);
    expect(MUTATION_DEFINITIONS.synapse.effectsPerRank).toEqual([
      { kind: 'snap-radius-flat', amount: 4 },
    ]);
    expect(MUTATION_DEFINITIONS.memory.effectsPerRank).toEqual([
      { kind: 'imprint-duration-flat-seconds', seconds: 8 },
    ]);

    for (const id of BASE_MUTATION_IDS) {
      expect(MUTATION_DEFINITIONS[id].maxRank).toBe(2);
      expect(Object.isFrozen(MUTATION_DEFINITIONS[id])).toBe(true);
      expect(Object.isFrozen(MUTATION_DEFINITIONS[id].effectsPerRank)).toBe(
        true,
      );
      expect(
        MUTATION_DEFINITIONS[id].effectsPerRank.every(Object.isFrozen),
      ).toBe(true);
    }
    expect(LINEAGE_MUTATION_IDS).toEqual([
      'blade-gland',
      'spike-crown',
      'nerve-lattice',
      'mirror-organ',
    ]);
    expect(APEX_MUTATION_ID).toBe('fourfold-hunt');
    expect(MUTATION_IDS).toHaveLength(11);
    expect(MUTATION_DEFINITIONS['fourfold-hunt'].maxRank).toBe(1);
  });
});

describe('MutationDraft', () => {
  it('copies supplied ranks and exposes a deeply frozen snapshot', () => {
    const suppliedRanks: Partial<Record<MutationId, number>> = { strider: 1 };
    const draft = createDraft(suppliedRanks);
    const snapshot = draft.snapshot;
    suppliedRanks.strider = 2;

    expect(snapshot.ranks).toEqual({
      strider: 1,
      marrow: 0,
      carrion: 0,
      hunger: 0,
      synapse: 0,
      memory: 0,
      'blade-gland': 0,
      'spike-crown': 0,
      'nerve-lattice': 0,
      'mirror-organ': 0,
      'fourfold-hunt': 0,
    });
    expect(draft.snapshot.ranks.strider).toBe(1);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.ranks)).toBe(true);
    expect(Object.isFrozen(snapshot.candidates)).toBe(true);
  });

  it('offers at most three unique choices without changing ranks', () => {
    const draft = createDraft(
      { strider: 2, marrow: 2 },
      sequenceRandom([0.99, 0, 0.5]),
    );
    const ranksBefore = draft.snapshot.ranks;
    const result = draft.draft();

    expect(result.kind).toBe('offered');
    expect(result.candidates).toHaveLength(3);
    expect(new Set(result.candidates.map((candidate) => candidate.id)).size).toBe(
      3,
    );
    expect(result.candidates.map((candidate) => candidate.id)).not.toContain(
      'strider',
    );
    expect(result.candidates.map((candidate) => candidate.id)).not.toContain(
      'marrow',
    );
    expect(draft.snapshot.ranks).toEqual(ranksBefore);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.candidates)).toBe(true);
    expect(result.candidates.every(Object.isFrozen)).toBe(true);
  });

  it('uses only the injected random sequence deterministically', () => {
    const first = createDraft({}, sequenceRandom([0.99, 0, 0.5]));
    const second = createDraft({}, sequenceRandom([0.99, 0, 0.5]));

    expect(first.draft()).toEqual(second.draft());
    expect(first.snapshot).toEqual(second.snapshot);
    expect(first.snapshot.candidates.map((candidate) => candidate.id)).toEqual([
      'memory',
      'strider',
      'hunger',
    ]);
  });

  it('does not reroll an unresolved draft or consume more randomness', () => {
    let calls = 0;
    const draft = createDraft({}, () => {
      calls += 1;
      return 0;
    });
    const offered = draft.draft();

    expect(calls).toBe(3);
    expect(draft.draft()).toEqual({
      kind: 'pending',
      candidates: offered.candidates,
    });
    expect(calls).toBe(3);
  });

  it('increments only the selected mutation and clears the offer', () => {
    const draft = createDraft({ strider: 1 });
    const offered = draft.draft();
    const choice = offered.candidates.find(
      (candidate) => candidate.id === 'strider',
    )!;

    expect(choice).toMatchObject({
      currentRank: 1,
      nextRank: 2,
      maxRank: 2,
      effects: [{ kind: 'movement-speed-percent', percent: 10 }],
    });
    expect(draft.snapshot.ranks.strider).toBe(1);

    const result = draft.select('strider');

    expect(result.kind).toBe('selected');
    if (result.kind === 'selected') {
      expect(result.candidate).toBe(choice);
      expect(result.snapshot.ranks.strider).toBe(2);
      expect(result.snapshot.candidates).toEqual([]);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.snapshot)).toBe(true);
    }
    expect(draft.snapshot.ranks).toMatchObject({
      strider: 2,
      marrow: 0,
      carrion: 0,
      hunger: 0,
      synapse: 0,
      memory: 0,
    });
  });

  it('rejects an unoffered selection without changing the pending draft', () => {
    const draft = createDraft({}, sequenceRandom([0, 0, 0]));
    const offered = draft.draft();

    expect(offered.candidates.map((candidate) => candidate.id)).toEqual([
      'strider',
      'marrow',
      'carrion',
    ]);
    expect(draft.select('memory')).toEqual({
      kind: 'ignored',
      reason: 'not-offered',
    });
    expect(draft.snapshot.candidates).toEqual(offered.candidates);
    expect(draft.snapshot.ranks.memory).toBe(0);
  });

  it('returns only the candidates that remain below max rank', () => {
    const draft = createDraft({
      strider: 2,
      marrow: 2,
      carrion: 2,
      hunger: 2,
    });

    const result = draft.draft();

    expect(result.kind).toBe('offered');
    expect(result.candidates.map((candidate) => candidate.id)).toEqual([
      'synapse',
      'memory',
    ]);
  });

  it('returns an empty frozen result when every mutation is maxed', () => {
    const draft = createDraft({
      strider: 2,
      marrow: 2,
      carrion: 2,
      hunger: 2,
      synapse: 2,
      memory: 2,
    });

    const result = draft.draft();

    expect(result).toEqual({ kind: 'empty', candidates: [] });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.candidates)).toBe(true);
    expect(draft.select('strider')).toEqual({
      kind: 'ignored',
      reason: 'no-draft',
    });
  });

  it('keeps lineage mutations locked until explicitly unlocked', () => {
    const draft = createDraft({
      strider: 2,
      marrow: 2,
      carrion: 2,
      hunger: 2,
      synapse: 2,
      memory: 2,
    });

    expect(draft.draft()).toEqual({ kind: 'empty', candidates: [] });
    draft.unlock(LINEAGE_MUTATION_IDS);
    const result = draft.draft();

    expect(result.kind).toBe('offered');
    expect(
      result.candidates.every((candidate) =>
        LINEAGE_MUTATION_IDS.includes(candidate.id),
      ),
    ).toBe(true);
  });

  it('guarantees an eligible apex card in the next draft', () => {
    const draft = new MutationDraft({
      currentRanks: {},
      availableIds: [...BASE_MUTATION_IDS, APEX_MUTATION_ID],
      random: sequenceRandom([0, 0, 0]),
    });

    expect(draft.prioritizeNext(APEX_MUTATION_ID)).toBe(true);
    const result = draft.draft();
    expect(result.candidates[0]).toMatchObject({
      id: 'fourfold-hunt',
      currentRank: 0,
      nextRank: 1,
      maxRank: 1,
      effects: [{ kind: 'fourfold-projection-unlock' }],
    });
  });

  it('uses rank-specific lineage effects', () => {
    const draft = new MutationDraft({
      currentRanks: { 'blade-gland': 1 },
      availableIds: ['blade-gland'],
      random: sequenceRandom([0]),
    });

    const result = draft.draft();
    expect(result.candidates[0]?.effects).toEqual([
      { kind: 'blade-band-flat', amount: 18 },
      { kind: 'blade-stability-damage-flat', amount: 1 },
    ]);
  });

  it('can hide a transition-time offer without granting a rank', () => {
    const draft = createDraft();
    draft.draft();

    expect(draft.dismiss()).toBe(true);
    expect(draft.snapshot.candidates).toEqual([]);
    expect(draft.snapshot.ranks.strider).toBe(0);
    expect(draft.dismiss()).toBe(false);
  });

  it.each([-1, 0.5, 3, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid current rank %s',
    (rank) => {
      expect(() => createDraft({ strider: rank })).toThrow('strider rank');
    },
  );

  it.each([-0.1, 1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid injected RNG value %s without publishing a draft',
    (roll) => {
      const draft = createDraft({}, () => roll);
      const before = draft.snapshot;

      expect(() => draft.draft()).toThrow('random');
      expect(draft.snapshot).toEqual(before);
    },
  );
});
