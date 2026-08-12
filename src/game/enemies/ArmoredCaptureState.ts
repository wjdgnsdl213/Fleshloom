import type { CaptureReward } from './LayeredCaptureState';

const EPSILON = 1e-9;

export interface ArmoredCaptureConfig {
  readonly staggerSeconds: number;
  readonly peelReward: CaptureReward;
  readonly finalReward: CaptureReward;
}

export interface ArmoredCaptureSnapshot {
  readonly alive: boolean;
  readonly armored: boolean;
  readonly staggerRemaining: number;
}

export type ArmoredCaptureResult =
  | {
      readonly kind: 'peeled';
      readonly reward: CaptureReward;
      readonly staggerSeconds: number;
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

/** A permanent two-capture shell: peel once, then kill on a later closure. */
export class ArmoredCaptureState {
  private readonly staggerSeconds: number;
  private readonly peelReward: CaptureReward;
  private readonly finalReward: CaptureReward;
  private alive = true;
  private armored = true;
  private staggerRemaining = 0;

  public constructor(config: ArmoredCaptureConfig) {
    if (!isFinitePositive(config.staggerSeconds)) {
      throw new RangeError('staggerSeconds must be finite and positive');
    }
    validateReward('peelReward', config.peelReward);
    validateReward('finalReward', config.finalReward);

    this.staggerSeconds = config.staggerSeconds;
    this.peelReward = freezeReward(config.peelReward);
    this.finalReward = freezeReward(config.finalReward);
  }

  public get snapshot(): ArmoredCaptureSnapshot {
    return Object.freeze({
      alive: this.alive,
      armored: this.armored,
      staggerRemaining: this.staggerRemaining,
    });
  }

  public update(deltaSeconds: number): void {
    if (
      !this.alive ||
      this.staggerRemaining <= 0 ||
      !isFinitePositive(deltaSeconds)
    ) {
      return;
    }

    this.staggerRemaining = Math.max(
      0,
      this.staggerRemaining - deltaSeconds,
    );
    if (this.staggerRemaining <= EPSILON) {
      this.staggerRemaining = 0;
    }
  }

  public capture(): ArmoredCaptureResult {
    if (!this.alive) {
      return Object.freeze({ kind: 'ignored', reason: 'dead' });
    }

    if (this.armored) {
      this.armored = false;
      this.staggerRemaining = this.staggerSeconds;
      return Object.freeze({
        kind: 'peeled',
        reward: this.peelReward,
        staggerSeconds: this.staggerSeconds,
      });
    }

    this.alive = false;
    this.staggerRemaining = 0;
    return Object.freeze({ kind: 'killed', reward: this.finalReward });
  }
}
