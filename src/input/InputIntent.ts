export type ChoiceIndex = 0 | 1 | 2;

export interface InputIntent {
  readonly moveX: number;
  readonly moveY: number;
  readonly loopHeld: boolean;
  readonly confirmPressed: boolean;
  readonly cancelPressed: boolean;
  readonly restartPressed: boolean;
  readonly choiceIndex: ChoiceIndex | null;
}

export const normalizeMove = (
  horizontal: number,
  vertical: number,
): Pick<InputIntent, 'moveX' | 'moveY'> => {
  if (!Number.isFinite(horizontal) || !Number.isFinite(vertical)) {
    return { moveX: 0, moveY: 0 };
  }

  const length = Math.hypot(horizontal, vertical);
  if (length === 0) {
    return { moveX: 0, moveY: 0 };
  }

  const scale = length > 1 ? 1 / length : 1;
  return {
    moveX: horizontal * scale,
    moveY: vertical * scale,
  };
};

export const NEUTRAL_INPUT_INTENT: InputIntent = Object.freeze({
  moveX: 0,
  moveY: 0,
  loopHeld: false,
  confirmPressed: false,
  cancelPressed: false,
  restartPressed: false,
  choiceIndex: null,
});

