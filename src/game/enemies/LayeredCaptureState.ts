export interface CaptureReward {
  readonly xp: number;
  readonly recovery: number;
}

export interface LayeredCaptureConfig {
  readonly exposureSeconds: number;
  readonly peelReward: CaptureReward;
  readonly finalReward: CaptureReward;
}

export interface LayeredCaptureSnapshot {
  readonly alive: boolean;
  readonly exposed: boolean;
  readonly exposureRemaining: number;
  readonly peelRewardClaimed: boolean;
}

export type LayeredCaptureResult =
  | {
      readonly kind: 'peeled';
      readonly reward: CaptureReward;
      readonly exposureSeconds: number;
    }
  | {
      readonly kind: 'killed';
      readonly reward: CaptureReward;
    }
  | {
      readonly kind: 'ignored';
      readonly reason: 'dead';
    };

const isFinitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const validateReward = (name: string, reward: CaptureReward): void => {
  if (
    !Number.isFinite(reward.xp) ||
    reward.xp < 0 ||
    !Number.isFinite(reward.recovery) ||
    reward.recovery < 0
  ) {
    throw new RangeError(`${name} must contain finite non-negative values`);
  }
};

const freezeReward = (reward: CaptureReward): CaptureReward =>
  Object.freeze({ xp: reward.xp, recovery: reward.recovery });

const EMPTY_REWARD: CaptureReward = Object.freeze({ xp: 0, recovery: 0 });

/** Two-beat capture state used by Elite Husk and later boss layers. */
export class LayeredCaptureState {
  private readonly exposureSeconds: number;
  private readonly peelReward: CaptureReward;
  private readonly finalReward: CaptureReward;
  private alive = true;
  private exposed = false;
  private exposureRemaining = 0;
  private peelRewardClaimed = false;

  public constructor(config: LayeredCaptureConfig) {
    if (!isFinitePositive(config.exposureSeconds)) {
      throw new RangeError('exposureSeconds must be finite and positive');
    }
    validateReward('peelReward', config.peelReward);
    validateReward('finalReward', config.finalReward);

    this.exposureSeconds = config.exposureSeconds;
    this.peelReward = freezeReward(config.peelReward);
    this.finalReward = freezeReward(config.finalReward);
  }

  public get snapshot(): LayeredCaptureSnapshot {
    return Object.freeze({
      alive: this.alive,
      exposed: this.exposed,
      exposureRemaining: this.exposureRemaining,
      peelRewardClaimed: this.peelRewardClaimed,
    });
  }

  public update(deltaSeconds: number): void {
    if (!this.alive || !this.exposed || !isFinitePositive(deltaSeconds)) {
      return;
    }

    this.exposureRemaining = Math.max(
      0,
      this.exposureRemaining - deltaSeconds,
    );
    if (this.exposureRemaining === 0) {
      this.exposed = false;
    }
  }

  public capture(): LayeredCaptureResult {
    if (!this.alive) {
      return Object.freeze({ kind: 'ignored', reason: 'dead' });
    }

    if (!this.exposed) {
      this.exposed = true;
      this.exposureRemaining = this.exposureSeconds;
      const reward = this.peelRewardClaimed ? EMPTY_REWARD : this.peelReward;
      this.peelRewardClaimed = true;
      return Object.freeze({
        kind: 'peeled',
        reward,
        exposureSeconds: this.exposureSeconds,
      });
    }

    this.alive = false;
    this.exposed = false;
    this.exposureRemaining = 0;
    return Object.freeze({ kind: 'killed', reward: this.finalReward });
  }

  public reset(): void {
    this.alive = true;
    this.exposed = false;
    this.exposureRemaining = 0;
    this.peelRewardClaimed = false;
  }
}
