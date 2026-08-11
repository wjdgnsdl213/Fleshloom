export type LoopInputMode = 'hold' | 'toggle';

export interface LoopInputFrame {
  readonly active: boolean;
  readonly started: boolean;
  readonly completed: boolean;
}

export class LoopInputController {
  private previousPressed = false;
  private active = false;
  private suppressedUntilRelease = false;

  public constructor(private mode: LoopInputMode = 'toggle') {}

  public get inputMode(): LoopInputMode {
    return this.mode;
  }

  public update(pressed: boolean): LoopInputFrame {
    if (this.suppressedUntilRelease) {
      this.previousPressed = pressed;
      if (!pressed) {
        this.suppressedUntilRelease = false;
      }
      return { active: false, started: false, completed: false };
    }

    const previousActive = this.active;

    if (this.mode === 'hold') {
      this.active = pressed;
    } else if (pressed && !this.previousPressed) {
      this.active = !this.active;
    }

    this.previousPressed = pressed;

    return {
      active: this.active,
      started: !previousActive && this.active,
      completed: previousActive && !this.active,
    };
  }

  public setMode(mode: LoopInputMode): void {
    this.mode = mode;
    this.reset();
  }

  /** Cancels a severed loop and requires a fresh physical press. */
  public interrupt(pressed: boolean): void {
    this.active = false;
    this.previousPressed = pressed;
    this.suppressedUntilRelease = pressed;
  }

  public reset(): void {
    this.previousPressed = false;
    this.active = false;
    this.suppressedUntilRelease = false;
  }
}
