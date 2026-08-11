export interface SeededRandomSnapshot {
  readonly initialSeed: number;
  readonly state: number;
}

const normalizeSeed = (seed: number): number => {
  if (!Number.isFinite(seed)) {
    throw new RangeError('seed must be finite');
  }
  return Math.trunc(seed) >>> 0;
};

/** Small deterministic PRNG for reproducible runs and tests. */
export class SeededRandom {
  private readonly initialSeed: number;
  private state: number;

  public constructor(seed: number) {
    this.initialSeed = normalizeSeed(seed);
    this.state = this.initialSeed;
  }

  public get snapshot(): SeededRandomSnapshot {
    return Object.freeze({
      initialSeed: this.initialSeed,
      state: this.state,
    });
  }

  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  public reset(): void {
    this.state = this.initialSeed;
  }
}
