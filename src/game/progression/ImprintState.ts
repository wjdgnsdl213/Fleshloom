import type { EnemyImprintKind } from '../../content/enemies';

export interface ActiveImprintSnapshot {
  readonly kind: EnemyImprintKind;
  readonly remainingSeconds: number;
}

export interface ImprintSnapshot {
  readonly active: ActiveImprintSnapshot | null;
  readonly candidates: readonly EnemyImprintKind[];
}

export type ImprintOfferResult =
  | { readonly kind: 'offered'; readonly candidates: readonly EnemyImprintKind[] }
  | { readonly kind: 'ignored'; readonly reason: 'empty' | 'pending-choice' };

export type ImprintChoiceResult =
  | { readonly kind: 'kept'; readonly active: ActiveImprintSnapshot | null }
  | { readonly kind: 'replaced'; readonly active: ActiveImprintSnapshot }
  | { readonly kind: 'ignored'; readonly reason: 'no-offer' | 'not-candidate' };

const isFinitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

export class ImprintState {
  private readonly baseDurationSeconds: number;
  private durationSeconds: number;
  private activeKind: EnemyImprintKind | null = null;
  private remainingSeconds = 0;
  private candidates: EnemyImprintKind[] = [];
  private readonly activated = new Set<EnemyImprintKind>();

  public constructor(durationSeconds: number) {
    if (!isFinitePositive(durationSeconds)) {
      throw new RangeError(
        'durationSeconds must be a finite number greater than zero',
      );
    }
    this.baseDurationSeconds = durationSeconds;
    this.durationSeconds = durationSeconds;
  }

  public get snapshot(): ImprintSnapshot {
    const active = this.activeSnapshot();
    return Object.freeze({
      active,
      candidates: Object.freeze([...this.candidates]),
    });
  }

  public get activatedKinds(): readonly EnemyImprintKind[] {
    return Object.freeze([...this.activated]);
  }

  public update(deltaSeconds: number): void {
    if (!isFinitePositive(deltaSeconds) || this.activeKind === null) {
      return;
    }

    this.remainingSeconds = Math.max(0, this.remainingSeconds - deltaSeconds);
    if (this.remainingSeconds === 0) {
      this.activeKind = null;
    }
  }

  public offer(kinds: readonly EnemyImprintKind[]): ImprintOfferResult {
    if (this.candidates.length > 0) {
      return { kind: 'ignored', reason: 'pending-choice' };
    }

    const unique = [...new Set(kinds)].slice(0, 2);
    if (unique.length === 0) {
      return { kind: 'ignored', reason: 'empty' };
    }

    this.candidates = unique;
    return {
      kind: 'offered',
      candidates: Object.freeze([...unique]),
    };
  }

  public keep(): ImprintChoiceResult {
    if (this.candidates.length === 0) {
      return { kind: 'ignored', reason: 'no-offer' };
    }

    this.candidates = [];
    return {
      kind: 'kept',
      active: this.activeSnapshot(),
    };
  }

  public replace(kind: EnemyImprintKind): ImprintChoiceResult {
    if (this.candidates.length === 0) {
      return { kind: 'ignored', reason: 'no-offer' };
    }

    if (!this.candidates.includes(kind)) {
      return { kind: 'ignored', reason: 'not-candidate' };
    }

    this.activeKind = kind;
    this.activated.add(kind);
    this.remainingSeconds = this.durationSeconds;
    this.candidates = [];
    return {
      kind: 'replaced',
      active: this.activeSnapshot()!,
    };
  }

  public increaseDuration(seconds: number): boolean {
    if (!isFinitePositive(seconds)) {
      return false;
    }

    this.durationSeconds += seconds;
    if (this.activeKind !== null) {
      this.remainingSeconds += seconds;
    }
    return true;
  }

  public reset(): void {
    this.durationSeconds = this.baseDurationSeconds;
    this.activeKind = null;
    this.remainingSeconds = 0;
    this.candidates = [];
    this.activated.clear();
  }

  private activeSnapshot(): ActiveImprintSnapshot | null {
    if (this.activeKind === null) {
      return null;
    }
    return Object.freeze({
      kind: this.activeKind,
      remainingSeconds: this.remainingSeconds,
    });
  }
}
