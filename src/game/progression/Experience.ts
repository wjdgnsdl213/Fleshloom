export interface ExperienceConfig {
  readonly firstThreshold: number;
  readonly thresholdGrowth: number;
}

export interface ExperienceSnapshot {
  readonly level: number;
  readonly xp: number;
  readonly xpForNextLevel: number;
  readonly pendingChoices: number;
}

export interface ExperienceGainResult {
  readonly gained: number;
  readonly levelsGained: number;
  readonly pendingChoices: number;
}

const isFinitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

export class Experience {
  private readonly firstThreshold: number;
  private readonly thresholdGrowth: number;
  private level = 1;
  private xp = 0;
  private pendingChoices = 0;

  public constructor(config: ExperienceConfig) {
    if (!isFinitePositive(config.firstThreshold)) {
      throw new RangeError(
        'firstThreshold must be a finite number greater than zero',
      );
    }

    if (!Number.isFinite(config.thresholdGrowth) || config.thresholdGrowth < 1) {
      throw new RangeError('thresholdGrowth must be a finite number at least one');
    }

    this.firstThreshold = config.firstThreshold;
    this.thresholdGrowth = config.thresholdGrowth;
  }

  public get snapshot(): ExperienceSnapshot {
    return Object.freeze({
      level: this.level,
      xp: this.xp,
      xpForNextLevel: this.thresholdForLevel(this.level),
      pendingChoices: this.pendingChoices,
    });
  }

  public gain(amount: number): ExperienceGainResult {
    if (!isFinitePositive(amount)) {
      return {
        gained: 0,
        levelsGained: 0,
        pendingChoices: this.pendingChoices,
      };
    }

    this.xp += amount;
    let levelsGained = 0;

    while (this.xp >= this.thresholdForLevel(this.level)) {
      this.xp -= this.thresholdForLevel(this.level);
      this.level += 1;
      this.pendingChoices += 1;
      levelsGained += 1;
    }

    return {
      gained: amount,
      levelsGained,
      pendingChoices: this.pendingChoices,
    };
  }

  public resolvePendingChoice(): boolean {
    if (this.pendingChoices === 0) {
      return false;
    }

    this.pendingChoices -= 1;
    return true;
  }

  /** Converts transition-time unresolved choices into external score metadata. */
  public discardPendingChoices(): number {
    const discarded = this.pendingChoices;
    this.pendingChoices = 0;
    return discarded;
  }

  public reset(): void {
    this.level = 1;
    this.xp = 0;
    this.pendingChoices = 0;
  }

  private thresholdForLevel(level: number): number {
    return Math.max(
      1,
      Math.round(
        this.firstThreshold * this.thresholdGrowth ** Math.max(0, level - 1),
      ),
    );
  }
}
