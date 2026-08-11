import {
  normalizeMove,
  type ChoiceIndex,
  type InputIntent,
} from './InputIntent';

const HANDLED_CODES = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'Space',
  'Enter',
  'NumpadEnter',
  'Escape',
  'KeyR',
  'Digit1',
  'Digit2',
  'Digit3',
  'Numpad1',
  'Numpad2',
  'Numpad3',
]);

const choiceForCode = (code: string): ChoiceIndex | null => {
  if (code === 'Digit1' || code === 'Numpad1') {
    return 0;
  }
  if (code === 'Digit2' || code === 'Numpad2') {
    return 1;
  }
  if (code === 'Digit3' || code === 'Numpad3') {
    return 2;
  }
  return null;
};

export class KeyboardInputAdapter {
  private readonly heldCodes = new Set<string>();
  private confirmPressed = false;
  private cancelPressed = false;
  private restartPressed = false;
  private choiceIndex: ChoiceIndex | null = null;

  public keyDown(code: string): boolean {
    if (!HANDLED_CODES.has(code)) {
      return false;
    }

    const newlyPressed = !this.heldCodes.has(code);
    this.heldCodes.add(code);

    if (!newlyPressed) {
      return true;
    }

    if (code === 'Enter' || code === 'NumpadEnter') {
      this.confirmPressed = true;
    } else if (code === 'Escape') {
      this.cancelPressed = true;
    } else if (code === 'KeyR') {
      this.restartPressed = true;
    } else {
      this.choiceIndex ??= choiceForCode(code);
    }

    return true;
  }

  public keyUp(code: string): boolean {
    if (!HANDLED_CODES.has(code)) {
      return false;
    }

    this.heldCodes.delete(code);
    return true;
  }

  public consumeIntent(): InputIntent {
    const horizontal =
      Number(this.isHeld('ArrowRight', 'KeyD')) -
      Number(this.isHeld('ArrowLeft', 'KeyA'));
    const vertical =
      Number(this.isHeld('ArrowDown', 'KeyS')) -
      Number(this.isHeld('ArrowUp', 'KeyW'));
    const movement = normalizeMove(horizontal, vertical);
    const intent: InputIntent = {
      ...movement,
      loopHeld: this.heldCodes.has('Space'),
      confirmPressed: this.confirmPressed,
      cancelPressed: this.cancelPressed,
      restartPressed: this.restartPressed,
      choiceIndex: this.choiceIndex,
    };

    this.clearEdges();
    return intent;
  }

  public reset(): void {
    this.heldCodes.clear();
    this.clearEdges();
  }

  private isHeld(first: string, second: string): boolean {
    return this.heldCodes.has(first) || this.heldCodes.has(second);
  }

  private clearEdges(): void {
    this.confirmPressed = false;
    this.cancelPressed = false;
    this.restartPressed = false;
    this.choiceIndex = null;
  }
}

