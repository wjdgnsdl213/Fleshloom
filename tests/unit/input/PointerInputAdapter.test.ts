import { describe, expect, it } from 'vitest';
import { LoopInputController } from '../../../src/input/LoopInputController';
import {
  DEFAULT_POINTER_INPUT_CONFIG,
  PointerInputAdapter,
} from '../../../src/input/PointerInputAdapter';

describe('PointerInputAdapter', () => {
  it('uses a frozen 12 px dead zone and 72 px maximum radius by default', () => {
    const input = new PointerInputAdapter();

    expect(DEFAULT_POINTER_INPUT_CONFIG).toEqual({
      deadZone: 12,
      maxRadius: 72,
    });
    expect(input.config).toEqual(DEFAULT_POINTER_INPUT_CONFIG);
    expect(Object.isFrozen(DEFAULT_POINTER_INPUT_CONFIG)).toBe(true);
    expect(Object.isFrozen(input.config)).toBe(true);
  });

  it('maps distance outside the dead zone to proportional movement strength', () => {
    const input = new PointerInputAdapter();
    input.movementPointerDown(1, 100, 100);

    input.pointerMove(1, 112, 100);
    expect(input.consumeIntent()).toMatchObject({ moveX: 0, moveY: 0 });

    input.pointerMove(1, 142, 100);
    expect(input.consumeIntent()).toMatchObject({ moveX: 0.5, moveY: 0 });

    input.pointerMove(1, 200, 100);
    expect(input.consumeIntent()).toMatchObject({ moveX: 1, moveY: 0 });
  });

  it('normalizes diagonal movement at the maximum radius', () => {
    const input = new PointerInputAdapter();
    input.movementPointerDown(1, 0, 0);
    input.pointerMove(1, 72, 72);

    const intent = input.consumeIntent();

    expect(intent.moveX).toBeCloseTo(Math.SQRT1_2);
    expect(intent.moveY).toBeCloseTo(Math.SQRT1_2);
    expect(Math.hypot(intent.moveX, intent.moveY)).toBeCloseTo(1);
  });

  it('keeps held movement across intent consumption', () => {
    const input = new PointerInputAdapter();
    input.movementPointerDown(4, 10, 20);
    input.pointerMove(4, 82, 20);

    expect(input.consumeIntent().moveX).toBe(1);
    expect(input.consumeIntent().moveX).toBe(1);
  });

  it('clears movement on matching up, cancel, blur, or reset', () => {
    const input = new PointerInputAdapter();

    input.movementPointerDown(1, 0, 0);
    input.pointerMove(1, 72, 0);
    expect(input.pointerUp(1)).toBe(true);
    expect(input.consumeIntent().moveX).toBe(0);

    input.movementPointerDown(2, 0, 0);
    input.pointerMove(2, 72, 0);
    expect(input.pointerCancel(2)).toBe(true);
    expect(input.consumeIntent().moveX).toBe(0);

    input.movementPointerDown(3, 0, 0);
    input.pointerMove(3, 72, 0);
    input.blur();
    expect(input.consumeIntent().moveX).toBe(0);

    input.movementPointerDown(4, 0, 0);
    input.pointerMove(4, 72, 0);
    input.reset();
    expect(input.consumeIntent().moveX).toBe(0);
  });

  it('gives movement ownership to one pointer and ignores other pointers', () => {
    const input = new PointerInputAdapter();

    expect(input.movementPointerDown(1, 10, 10)).toBe(true);
    expect(input.movementPointerDown(2, 100, 100)).toBe(false);
    expect(input.pointerMove(2, 200, 100)).toBe(false);
    expect(input.pointerUp(2)).toBe(false);
    expect(input.consumeIntent().moveX).toBe(0);

    expect(input.pointerMove(1, 82, 10)).toBe(true);
    expect(input.consumeIntent().moveX).toBe(1);
  });

  it('keeps a physical loop button held for toggle and hold controllers', () => {
    const pointer = new PointerInputAdapter();
    const toggle = new LoopInputController('toggle');
    const hold = new LoopInputController('hold');

    pointer.loopButtonDown(9);
    const firstPress = pointer.consumeIntent();
    expect(toggle.update(firstPress.loopHeld)).toMatchObject({
      active: true,
      started: true,
    });
    expect(hold.update(firstPress.loopHeld)).toMatchObject({
      active: true,
      started: true,
    });

    const stillHeld = pointer.consumeIntent();
    expect(toggle.update(stillHeld.loopHeld).started).toBe(false);
    expect(hold.update(stillHeld.loopHeld).active).toBe(true);

    pointer.loopButtonUp(9);
    const released = pointer.consumeIntent();
    expect(toggle.update(released.loopHeld)).toMatchObject({
      active: true,
      completed: false,
    });
    expect(hold.update(released.loopHeld)).toMatchObject({
      active: false,
      completed: true,
    });

    pointer.loopButtonDown(9);
    expect(toggle.update(pointer.consumeIntent().loopHeld)).toMatchObject({
      active: false,
      completed: true,
    });
  });

  it('ignores unrelated loop pointers and releases the owner on cancel', () => {
    const input = new PointerInputAdapter();

    expect(input.loopButtonDown(7)).toBe(true);
    expect(input.loopButtonDown(8)).toBe(false);
    expect(input.loopButtonUp(8)).toBe(false);
    expect(input.consumeIntent().loopHeld).toBe(true);
    expect(input.pointerCancel(7)).toBe(true);
    expect(input.consumeIntent().loopHeld).toBe(false);
  });

  it('returns the full InputIntent and consumes only button edges', () => {
    const input = new PointerInputAdapter();
    input.movementPointerDown(1, 0, 0);
    input.pointerMove(1, 72, 0);
    input.loopButtonDown(2);
    input.confirmButtonPress();
    input.cancelButtonPress();
    input.restartButtonPress();
    input.choiceButtonPress(2);
    input.choiceButtonPress(0);

    expect(input.consumeIntent()).toEqual({
      moveX: 1,
      moveY: 0,
      loopHeld: true,
      confirmPressed: true,
      cancelPressed: true,
      restartPressed: true,
      choiceIndex: 2,
    });
    expect(input.consumeIntent()).toEqual({
      moveX: 1,
      moveY: 0,
      loopHeld: true,
      confirmPressed: false,
      cancelPressed: false,
      restartPressed: false,
      choiceIndex: null,
    });
  });

  it('treats invalid coordinates, ids, and choice indices as no-ops', () => {
    const input = new PointerInputAdapter();

    expect(input.movementPointerDown(-1, 0, 0)).toBe(false);
    expect(input.movementPointerDown(1.5, 0, 0)).toBe(false);
    expect(input.movementPointerDown(1, Number.NaN, 0)).toBe(false);
    expect(input.movementPointerDown(1, 0, 0)).toBe(true);
    expect(input.pointerMove(1, Number.POSITIVE_INFINITY, 0)).toBe(false);
    expect(input.pointerMove(Number.NaN, 72, 0)).toBe(false);
    expect(input.loopButtonDown(-1)).toBe(false);
    expect(input.loopButtonUp(Number.NaN)).toBe(false);
    expect(input.choiceButtonPress(-1)).toBe(false);
    expect(input.choiceButtonPress(3)).toBe(false);

    expect(input.consumeIntent()).toEqual({
      moveX: 0,
      moveY: 0,
      loopHeld: false,
      confirmPressed: false,
      cancelPressed: false,
      restartPressed: false,
      choiceIndex: null,
    });
  });

  it.each([
    [{ deadZone: -1 }],
    [{ deadZone: Number.NaN }],
    [{ maxRadius: 0 }],
    [{ deadZone: 20, maxRadius: 20 }],
    [{ maxRadius: Number.POSITIVE_INFINITY }],
  ])('rejects invalid joystick config %o', (config) => {
    expect(() => new PointerInputAdapter(config)).toThrow(RangeError);
  });
});
