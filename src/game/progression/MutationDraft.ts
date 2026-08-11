import {
  BASE_MUTATION_IDS,
  MUTATION_DEFINITIONS,
  MUTATION_IDS,
  type MutationEffect,
  type MutationId,
} from '../../content/mutations';

export const MUTATION_DRAFT_SIZE = 3;

export type MutationRandom = () => number;
export type MutationRankInput = Readonly<
  Partial<Record<MutationId, number>>
>;
export type MutationRanks = Readonly<Record<MutationId, number>>;

export interface MutationDraftConfig {
  readonly currentRanks: MutationRankInput;
  readonly random: MutationRandom;
  readonly availableIds?: readonly MutationId[];
}

export interface MutationCandidate {
  readonly id: MutationId;
  readonly name: string;
  readonly description: string;
  readonly currentRank: number;
  readonly nextRank: number;
  readonly maxRank: number;
  readonly effects: readonly MutationEffect[];
}

export interface MutationDraftSnapshot {
  readonly ranks: MutationRanks;
  readonly candidates: readonly MutationCandidate[];
}

export type MutationDraftResult =
  | {
      readonly kind: 'offered';
      readonly candidates: readonly MutationCandidate[];
    }
  | {
      readonly kind: 'pending';
      readonly candidates: readonly MutationCandidate[];
    }
  | {
      readonly kind: 'empty';
      readonly candidates: readonly [];
    };

export type MutationSelectionResult =
  | {
      readonly kind: 'selected';
      readonly candidate: MutationCandidate;
      readonly snapshot: MutationDraftSnapshot;
    }
  | {
      readonly kind: 'ignored';
      readonly reason: 'no-draft' | 'not-offered';
    };

const EMPTY_CANDIDATES: readonly [] = Object.freeze([]);

const frozenCandidateList = (
  candidates: readonly MutationCandidate[],
): readonly MutationCandidate[] => Object.freeze([...candidates]);

export class MutationDraft {
  private readonly random: MutationRandom;
  private readonly ranks: Record<MutationId, number>;
  private readonly availableIds = new Set<MutationId>();
  private candidates: readonly MutationCandidate[] = EMPTY_CANDIDATES;
  private priorityId: MutationId | null = null;

  public constructor(config: MutationDraftConfig) {
    if (typeof config.random !== 'function') {
      throw new TypeError('random must be a function');
    }

    this.random = config.random;
    this.ranks = Object.fromEntries(
      MUTATION_IDS.map((id) => [
        id,
        this.validatedRank(id, config.currentRanks[id]),
      ]),
    ) as Record<MutationId, number>;
    this.unlock(config.availableIds ?? BASE_MUTATION_IDS);
  }

  public get snapshot(): MutationDraftSnapshot {
    return Object.freeze({
      ranks: this.frozenRanks(),
      candidates: frozenCandidateList(this.candidates),
    });
  }

  public draft(): MutationDraftResult {
    if (this.candidates.length > 0) {
      return Object.freeze({
        kind: 'pending',
        candidates: frozenCandidateList(this.candidates),
      });
    }

    const available = MUTATION_IDS.filter(
      (id) =>
        this.availableIds.has(id) &&
        this.ranks[id] < MUTATION_DEFINITIONS[id].maxRank,
    );

    if (available.length === 0) {
      return Object.freeze({
        kind: 'empty',
        candidates: EMPTY_CANDIDATES,
      });
    }

    const pool = [...available];
    const selected: MutationCandidate[] = [];
    const candidateCount = Math.min(MUTATION_DRAFT_SIZE, pool.length);

    if (this.priorityId !== null) {
      const priorityIndex = pool.indexOf(this.priorityId);
      if (priorityIndex >= 0) {
        const [priority] = pool.splice(priorityIndex, 1);
        selected.push(this.createCandidate(priority!));
        this.priorityId = null;
      }
    }

    while (selected.length < candidateCount) {
      const roll = this.random();

      if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
        throw new RangeError('random must return a finite value in [0, 1)');
      }

      const selectedIndex = Math.floor(roll * pool.length);
      const id = pool.splice(selectedIndex, 1)[0]!;
      selected.push(this.createCandidate(id));
    }

    this.candidates = frozenCandidateList(selected);
    return Object.freeze({
      kind: 'offered',
      candidates: frozenCandidateList(this.candidates),
    });
  }

  public select(id: MutationId): MutationSelectionResult {
    if (this.candidates.length === 0) {
      return Object.freeze({ kind: 'ignored', reason: 'no-draft' });
    }

    const candidate = this.candidates.find((entry) => entry.id === id);

    if (candidate === undefined) {
      return Object.freeze({ kind: 'ignored', reason: 'not-offered' });
    }

    this.ranks[id] = candidate.nextRank;
    this.candidates = EMPTY_CANDIDATES;

    return Object.freeze({
      kind: 'selected',
      candidate,
      snapshot: this.snapshot,
    });
  }

  public unlock(ids: readonly MutationId[]): void {
    for (const id of ids) {
      if (!MUTATION_IDS.includes(id)) {
        throw new RangeError(`unknown mutation id: ${String(id)}`);
      }
      this.availableIds.add(id);
    }
  }

  public prioritizeNext(id: MutationId): boolean {
    if (
      !this.availableIds.has(id) ||
      this.ranks[id] >= MUTATION_DEFINITIONS[id].maxRank
    ) {
      return false;
    }
    this.priorityId = id;
    return true;
  }

  /** Hides an unresolved offer during a scene transition without changing rank. */
  public dismiss(): boolean {
    if (this.candidates.length === 0) {
      return false;
    }
    this.candidates = EMPTY_CANDIDATES;
    return true;
  }

  private createCandidate(id: MutationId): MutationCandidate {
    const definition = MUTATION_DEFINITIONS[id];
    const currentRank = this.ranks[id];

    return Object.freeze({
      id,
      name: definition.name,
      description: definition.description,
      currentRank,
      nextRank: currentRank + 1,
      maxRank: definition.maxRank,
      effects:
        definition.effectsByRank?.[currentRank] ?? definition.effectsPerRank,
    });
  }

  private validatedRank(id: MutationId, rank: number | undefined): number {
    const resolvedRank = rank ?? 0;
    const maxRank = MUTATION_DEFINITIONS[id].maxRank;

    if (
      !Number.isInteger(resolvedRank) ||
      resolvedRank < 0 ||
      resolvedRank > maxRank
    ) {
      throw new RangeError(
        `${id} rank must be an integer between zero and ${maxRank}`,
      );
    }

    return resolvedRank;
  }

  private frozenRanks(): MutationRanks {
    return Object.freeze({ ...this.ranks });
  }
}
