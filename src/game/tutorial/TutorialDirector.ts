export const TUTORIAL_MOVE_DISTANCE = 56;
export const TUTORIAL_ASSIST_SECONDS = 12;

export type TutorialStep =
  | 'move'
  | 'anchor'
  | 'close'
  | 'capture'
  | 'complete';

export interface TutorialSnapshot {
  readonly step: TutorialStep;
  readonly elapsedSeconds: number;
  readonly stepElapsedSeconds: number;
  readonly completed: boolean;
  readonly prompt: string;
  readonly assistRequested: boolean;
}

export const TUTORIAL_PROMPTS: Readonly<Record<TutorialStep, string>> =
  Object.freeze({
    move: '이동 · 56px 전진',
    anchor: '생체 닻 · 살아 있는 고리 시작',
    close: '고리 닫기 · 유효한 폐곡선 완성',
    capture: '포획 · 적을 하나 이상 감싸기',
    complete: '사냥 · 생존하고 진화하기',
  });

const isFinitePositive = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

export class TutorialDirector {
  private step: TutorialStep = 'move';
  private elapsedSeconds = 0;
  private stepElapsedSeconds = 0;
  private movementDistance = 0;
  private assistRequested = false;
  private nextAssistAtSeconds = TUTORIAL_ASSIST_SECONDS;

  public get snapshot(): TutorialSnapshot {
    return Object.freeze({
      step: this.step,
      elapsedSeconds: this.elapsedSeconds,
      stepElapsedSeconds: this.stepElapsedSeconds,
      completed: this.step === 'complete',
      prompt: TUTORIAL_PROMPTS[this.step],
      assistRequested: this.assistRequested,
    });
  }

  public update(simulationDelta: number): void {
    if (!isFinitePositive(simulationDelta) || this.step === 'complete') {
      return;
    }

    this.elapsedSeconds += simulationDelta;
    this.stepElapsedSeconds += simulationDelta;

    if (this.stepElapsedSeconds >= this.nextAssistAtSeconds) {
      this.assistRequested = true;
    }
  }

  public recordMovement(distance: number): boolean {
    if (this.step !== 'move' || !isFinitePositive(distance)) {
      return false;
    }

    this.movementDistance += distance;
    this.acknowledgeProgress();

    if (this.movementDistance >= TUTORIAL_MOVE_DISTANCE) {
      this.advanceTo('anchor');
    }

    return true;
  }

  public recordLoopStarted(): boolean {
    if (this.step !== 'anchor') {
      return false;
    }

    this.advanceTo('close');
    return true;
  }

  public recordLoopClosed(valid: boolean): boolean {
    if (this.step !== 'close' || valid !== true) {
      return false;
    }

    this.advanceTo('capture');
    return true;
  }

  public recordCapture(count: number): boolean {
    if (
      this.step !== 'capture' ||
      !Number.isInteger(count) ||
      count <= 0
    ) {
      return false;
    }

    this.advanceTo('complete');
    return true;
  }

  public reset(): void {
    this.step = 'move';
    this.elapsedSeconds = 0;
    this.stepElapsedSeconds = 0;
    this.movementDistance = 0;
    this.assistRequested = false;
    this.nextAssistAtSeconds = TUTORIAL_ASSIST_SECONDS;
  }

  private acknowledgeProgress(): void {
    this.assistRequested = false;
    this.nextAssistAtSeconds =
      this.stepElapsedSeconds + TUTORIAL_ASSIST_SECONDS;
  }

  private advanceTo(step: TutorialStep): void {
    this.step = step;
    this.stepElapsedSeconds = 0;
    this.assistRequested = false;
    this.nextAssistAtSeconds = TUTORIAL_ASSIST_SECONDS;
  }
}
