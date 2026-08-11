import type { EnemyImprintKind } from '../../content/enemies';
import type { MutationId } from '../../content/mutations';

export const ENDING_COLLAPSE_SECONDS = 1.4;

export type RunScene = 'title' | 'hunt' | 'warden' | 'ending' | 'results';
export type RunOutcome = 'death' | 'victory';

export interface RunMutationSummary {
  readonly id: MutationId;
  readonly rank: number;
}

export interface RunResultInput {
  readonly outcome: RunOutcome;
  readonly huntSeconds: number;
  readonly wardenSeconds: number;
  readonly captured: number;
  readonly level: number;
  readonly activeImprint: EnemyImprintKind | null;
  readonly mutations: readonly RunMutationSummary[];
  readonly fourfold: boolean;
  readonly unspentChoices: number;
}

export interface RunResult extends RunResultInput {
  readonly totalSeconds: number;
}

export interface RunFlowSnapshot {
  readonly scene: RunScene;
  readonly runIndex: number;
  readonly runSeed: number;
  readonly endingRemaining: number;
  readonly result: RunResult | null;
}

const isFiniteNonNegative = (value: number): boolean =>
  Number.isFinite(value) && value >= 0;

const validateResult = (result: RunResultInput): void => {
  if (
    !isFiniteNonNegative(result.huntSeconds) ||
    !isFiniteNonNegative(result.wardenSeconds) ||
    !Number.isInteger(result.captured) ||
    result.captured < 0 ||
    !Number.isInteger(result.level) ||
    result.level < 1 ||
    !Number.isInteger(result.unspentChoices) ||
    result.unspentChoices < 0 ||
    result.mutations.some(
      (mutation) =>
        !Number.isInteger(mutation.rank) || mutation.rank <= 0,
    )
  ) {
    throw new RangeError('run result values must be finite and valid');
  }
};

const freezeResult = (result: RunResultInput): RunResult =>
  Object.freeze({
    ...result,
    mutations: Object.freeze(
      result.mutations.map((mutation) => Object.freeze({ ...mutation })),
    ),
    totalSeconds: result.huntSeconds + result.wardenSeconds,
  });

const normalizeSeed = (seed: number): number => {
  if (!Number.isFinite(seed)) {
    throw new RangeError('baseSeed must be finite');
  }
  return Math.trunc(seed) >>> 0;
};

export class RunFlow {
  private readonly baseSeed: number;
  private scene: RunScene = 'title';
  private runIndex = 0;
  private runSeed: number;
  private endingRemaining = 0;
  private result: RunResult | null = null;

  public constructor(baseSeed: number) {
    this.baseSeed = normalizeSeed(baseSeed);
    this.runSeed = this.baseSeed;
  }

  public get snapshot(): RunFlowSnapshot {
    return Object.freeze({
      scene: this.scene,
      runIndex: this.runIndex,
      runSeed: this.runSeed,
      endingRemaining: this.endingRemaining,
      result: this.result,
    });
  }

  public startNewRun(): boolean {
    if (this.scene !== 'title' && this.scene !== 'results') {
      return false;
    }
    this.beginFreshRun();
    return true;
  }

  public restartRun(): void {
    this.beginFreshRun();
  }

  public beginWarden(): boolean {
    if (this.scene !== 'hunt') {
      return false;
    }
    this.scene = 'warden';
    return true;
  }

  public finishDeath(result: RunResultInput): boolean {
    if (this.scene !== 'hunt' && this.scene !== 'warden') {
      return false;
    }
    validateResult(result);
    if (result.outcome !== 'death') {
      throw new RangeError('death result must use outcome death');
    }
    this.result = freezeResult(result);
    this.scene = 'results';
    this.endingRemaining = 0;
    return true;
  }

  public finishVictory(result: RunResultInput): boolean {
    if (this.scene !== 'warden') {
      return false;
    }
    validateResult(result);
    if (result.outcome !== 'victory') {
      throw new RangeError('victory result must use outcome victory');
    }
    this.result = freezeResult(result);
    this.scene = 'ending';
    this.endingRemaining = ENDING_COLLAPSE_SECONDS;
    return true;
  }

  public updatePresentation(deltaSeconds: number): boolean {
    if (
      this.scene !== 'ending' ||
      !Number.isFinite(deltaSeconds) ||
      deltaSeconds <= 0
    ) {
      return false;
    }
    this.endingRemaining = Math.max(0, this.endingRemaining - deltaSeconds);
    if (this.endingRemaining === 0) {
      this.scene = 'results';
      return true;
    }
    return false;
  }

  public returnToTitle(): boolean {
    if (this.scene !== 'results') {
      return false;
    }
    this.scene = 'title';
    this.endingRemaining = 0;
    return true;
  }

  private beginFreshRun(): void {
    this.runIndex += 1;
    this.runSeed =
      (this.baseSeed + Math.imul(this.runIndex, 0x9e37_79b9)) >>> 0;
    this.scene = 'hunt';
    this.endingRemaining = 0;
    this.result = null;
  }
}
