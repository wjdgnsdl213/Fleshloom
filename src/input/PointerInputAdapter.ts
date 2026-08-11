import {
  type ChoiceIndex,
  type InputIntent,
  normalizeMove,
} from './InputIntent';

export interface PointerInputConfig {
  readonly deadZone: number;
  readonly maxRadius: number;
}

export const DEFAULT_POINTER_INPUT_CONFIG: PointerInputConfig = Object.freeze({
  deadZone: 12,
  maxRadius: 72,
});

interface PointerPosition {
  readonly x: number;
  readonly y: number;
}

const isValidPointerId = (pointerId: number): boolean =>
  Number.isInteger(pointerId) && pointerId >= 0;

const isFinitePosition = (x: number, y: number): boolean =>
  Number.isFinite(x) && Number.isFinite(y);

const isChoiceIndex = (index: number): index is ChoiceIndex =>
  index === 0 || index === 1 || index === 2;

export class PointerInputAdapter {
  public readonly config: PointerInputConfig;
  private movementPointerId: number | null = null;
  private movementOrigin: PointerPosition | null = null;
  private movementCurrent: PointerPosition | null = null;
  private loopPointerId: number | null = null;
  private loopHeld = false;
  private confirmPressed = false;
  private cancelPressed = false;
  private restartPressed = false;
  private choiceIndex: ChoiceIndex | null = null;

  public constructor(config: Partial<PointerInputConfig> = {}) {
    const deadZone = config.deadZone ?? DEFAULT_POINTER_INPUT_CONFIG.deadZone;
    const maxRadius =
      config.maxRadius ?? DEFAULT_POINTER_INPUT_CONFIG.maxRadius;

    if (!Number.isFinite(deadZone) || deadZone < 0) {
      throw new RangeError('deadZone must be a finite non-negative number');
    }

    if (!Number.isFinite(maxRadius) || maxRadius <= deadZone) {
      throw new RangeError(
        'maxRadius must be finite and greater than deadZone',
      );
    }

    this.config = Object.freeze({ deadZone, maxRadius });
  }

  /** Called only after the host hit-tests the pointer inside its left move area. */
  public movementPointerDown(
    pointerId: number,
    x: number,
    y: number,
  ): boolean {
    if (
      this.movementPointerId !== null ||
      !isValidPointerId(pointerId) ||
      !isFinitePosition(x, y)
    ) {
      return false;
    }

    this.movementPointerId = pointerId;
    this.movementOrigin = { x, y };
    this.movementCurrent = { x, y };
    return true;
  }

  public pointerMove(pointerId: number, x: number, y: number): boolean {
    if (
      pointerId !== this.movementPointerId ||
      !isValidPointerId(pointerId) ||
      !isFinitePosition(x, y)
    ) {
      return false;
    }

    this.movementCurrent = { x, y };
    return true;
  }

  public pointerUp(pointerId: number): boolean {
    if (!isValidPointerId(pointerId)) {
      return false;
    }

    let handled = false;

    if (pointerId === this.movementPointerId) {
      this.clearMovement();
      handled = true;
    }

    if (pointerId === this.loopPointerId) {
      this.clearLoop();
      handled = true;
    }

    return handled;
  }

  public pointerCancel(pointerId: number): boolean {
    return this.pointerUp(pointerId);
  }

  public loopButtonDown(pointerId: number): boolean {
    if (!isValidPointerId(pointerId)) {
      return false;
    }

    if (this.loopPointerId !== null) {
      return this.loopPointerId === pointerId;
    }

    this.loopPointerId = pointerId;
    this.loopHeld = true;
    return true;
  }

  public loopButtonUp(pointerId: number): boolean {
    if (!isValidPointerId(pointerId) || pointerId !== this.loopPointerId) {
      return false;
    }

    this.clearLoop();
    return true;
  }

  public confirmButtonPress(): void {
    this.confirmPressed = true;
  }

  public cancelButtonPress(): void {
    this.cancelPressed = true;
  }

  public restartButtonPress(): void {
    this.restartPressed = true;
  }

  public choiceButtonPress(index: number): boolean {
    if (!isChoiceIndex(index)) {
      return false;
    }

    this.choiceIndex ??= index;
    return true;
  }

  public consumeIntent(): InputIntent {
    const movement = this.normalizedMovement();
    const intent: InputIntent = {
      ...movement,
      loopHeld: this.loopHeld,
      confirmPressed: this.confirmPressed,
      cancelPressed: this.cancelPressed,
      restartPressed: this.restartPressed,
      choiceIndex: this.choiceIndex,
    };

    this.clearEdges();
    return intent;
  }

  public blur(): void {
    this.reset();
  }

  public reset(): void {
    this.clearMovement();
    this.clearLoop();
    this.clearEdges();
  }

  private normalizedMovement(): Pick<InputIntent, 'moveX' | 'moveY'> {
    if (this.movementOrigin === null || this.movementCurrent === null) {
      return { moveX: 0, moveY: 0 };
    }

    const deltaX = this.movementCurrent.x - this.movementOrigin.x;
    const deltaY = this.movementCurrent.y - this.movementOrigin.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance <= this.config.deadZone) {
      return { moveX: 0, moveY: 0 };
    }

    const strength = Math.min(
      1,
      (distance - this.config.deadZone) /
        (this.config.maxRadius - this.config.deadZone),
    );
    return normalizeMove(
      (deltaX / distance) * strength,
      (deltaY / distance) * strength,
    );
  }

  private clearMovement(): void {
    this.movementPointerId = null;
    this.movementOrigin = null;
    this.movementCurrent = null;
  }

  private clearLoop(): void {
    this.loopPointerId = null;
    this.loopHeld = false;
  }

  private clearEdges(): void {
    this.confirmPressed = false;
    this.cancelPressed = false;
    this.restartPressed = false;
    this.choiceIndex = null;
  }
}
