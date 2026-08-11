export const IMPRINT_SLOW_SECONDS = 2.5;
export const IMPRINT_SLOW_SCALE = 0.15;

export type ChoiceMode = 'none' | 'slow' | 'paused';

export interface ChoiceClockSnapshot {
  readonly mode: ChoiceMode;
  readonly simulationScale: number;
  readonly imprintOfferAge: number;
}

const isFinitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

export class ChoiceClock {
  private imprintOfferAge = 0;

  public updatePresentation(
    deltaSeconds: number,
    mutationPending: boolean,
    imprintPending: boolean,
  ): void {
    if (
      !isFinitePositive(deltaSeconds) ||
      mutationPending ||
      !imprintPending
    ) {
      return;
    }
    this.imprintOfferAge += deltaSeconds;
  }

  public snapshot(
    mutationPending: boolean,
    imprintPending: boolean,
  ): ChoiceClockSnapshot {
    const mode: ChoiceMode = mutationPending
      ? 'paused'
      : !imprintPending
        ? 'none'
        : this.imprintOfferAge >= IMPRINT_SLOW_SECONDS
          ? 'paused'
          : 'slow';
    return Object.freeze({
      mode,
      simulationScale:
        mode === 'none' ? 1 : mode === 'slow' ? IMPRINT_SLOW_SCALE : 0,
      imprintOfferAge: this.imprintOfferAge,
    });
  }

  public openImprint(): void {
    this.imprintOfferAge = 0;
  }

  public closeImprint(): void {
    this.imprintOfferAge = 0;
  }

  public reset(): void {
    this.imprintOfferAge = 0;
  }
}
