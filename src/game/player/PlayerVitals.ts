export interface PlayerVitalsConfig {
  readonly maxHp: number;
  readonly contactInvulnerabilitySeconds: number;
}

export interface PlayerVitalsSnapshot {
  readonly hp: number;
  readonly maxHp: number;
  readonly invulnerabilityRemaining: number;
  readonly dead: boolean;
}

export type PlayerDamageIgnoredReason =
  | 'dead'
  | 'invalid-amount'
  | 'invulnerable';

export type PlayerDamageResult =
  | {
      readonly kind: 'applied';
      readonly sourceId: string;
      readonly amount: number;
      readonly hp: number;
    }
  | {
      readonly kind: 'ignored';
      readonly sourceId: string;
      readonly amount: 0;
      readonly hp: number;
      readonly reason: PlayerDamageIgnoredReason;
    }
  | {
      readonly kind: 'death';
      readonly sourceId: string;
      readonly amount: number;
      readonly hp: 0;
    };

const isFinitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const isFiniteNonNegative = (value: number): boolean =>
  Number.isFinite(value) && value >= 0;

export class PlayerVitals {
  private readonly baseMaxHp: number;
  private maxHp: number;
  private readonly contactInvulnerabilitySeconds: number;
  private hp: number;
  private invulnerabilityRemaining = 0;
  private dead = false;

  public constructor(config: PlayerVitalsConfig) {
    if (!isFinitePositive(config.maxHp)) {
      throw new RangeError('maxHp must be a finite number greater than zero');
    }

    if (!isFiniteNonNegative(config.contactInvulnerabilitySeconds)) {
      throw new RangeError(
        'contactInvulnerabilitySeconds must be a finite non-negative number',
      );
    }

    this.baseMaxHp = config.maxHp;
    this.maxHp = config.maxHp;
    this.contactInvulnerabilitySeconds =
      config.contactInvulnerabilitySeconds;
    this.hp = config.maxHp;
  }

  public get snapshot(): PlayerVitalsSnapshot {
    return Object.freeze({
      hp: this.hp,
      maxHp: this.maxHp,
      invulnerabilityRemaining: this.invulnerabilityRemaining,
      dead: this.dead,
    });
  }

  public update(deltaSeconds: number): void {
    if (!isFinitePositive(deltaSeconds)) {
      return;
    }

    this.invulnerabilityRemaining = Math.max(
      0,
      this.invulnerabilityRemaining - deltaSeconds,
    );
  }

  public damage(amount: number, sourceId: string): PlayerDamageResult {
    if (!isFinitePositive(amount)) {
      return this.ignoredDamage(sourceId, 'invalid-amount');
    }

    if (this.dead) {
      return this.ignoredDamage(sourceId, 'dead');
    }

    if (this.invulnerabilityRemaining > 0) {
      return this.ignoredDamage(sourceId, 'invulnerable');
    }

    const appliedAmount = Math.min(amount, this.hp);
    this.hp = Math.max(0, this.hp - appliedAmount);
    this.invulnerabilityRemaining = this.contactInvulnerabilitySeconds;

    if (this.hp === 0) {
      this.dead = true;
      return {
        kind: 'death',
        sourceId,
        amount: appliedAmount,
        hp: 0,
      };
    }

    return {
      kind: 'applied',
      sourceId,
      amount: appliedAmount,
      hp: this.hp,
    };
  }

  public heal(amount: number): number {
    if (!isFinitePositive(amount) || this.dead) {
      return 0;
    }

    const recoveredAmount = Math.min(amount, this.maxHp - this.hp);
    this.hp += recoveredAmount;
    return recoveredAmount;
  }

  public increaseMaximum(amount: number, currentHpIncrease = amount): boolean {
    if (
      !isFinitePositive(amount) ||
      !isFiniteNonNegative(currentHpIncrease) ||
      this.dead
    ) {
      return false;
    }

    this.maxHp += amount;
    this.hp = Math.min(this.maxHp, this.hp + currentHpIncrease);
    return true;
  }

  public reset(): void {
    this.maxHp = this.baseMaxHp;
    this.hp = this.maxHp;
    this.invulnerabilityRemaining = 0;
    this.dead = false;
  }

  private ignoredDamage(
    sourceId: string,
    reason: PlayerDamageIgnoredReason,
  ): PlayerDamageResult {
    return {
      kind: 'ignored',
      sourceId,
      amount: 0,
      hp: this.hp,
      reason,
    };
  }
}
