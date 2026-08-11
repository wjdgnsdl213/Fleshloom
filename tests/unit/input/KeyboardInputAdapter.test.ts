import { describe, expect, it } from 'vitest';
import { KeyboardInputAdapter } from '../../../src/input/KeyboardInputAdapter';

describe('KeyboardInputAdapter', () => {
  it('normalizes diagonal keyboard movement', () => {
    const input = new KeyboardInputAdapter();
    input.keyDown('KeyW');
    input.keyDown('KeyD');

    const intent = input.consumeIntent();

    expect(intent.moveX).toBeCloseTo(Math.SQRT1_2);
    expect(intent.moveY).toBeCloseTo(-Math.SQRT1_2);
    expect(Math.hypot(intent.moveX, intent.moveY)).toBeCloseTo(1);
  });

  it('combines arrow and WASD bindings without double-counting a direction', () => {
    const input = new KeyboardInputAdapter();
    input.keyDown('ArrowRight');
    input.keyDown('KeyD');

    expect(input.consumeIntent().moveX).toBe(1);

    input.keyUp('ArrowRight');
    expect(input.consumeIntent().moveX).toBe(1);
  });

  it('keeps physical loop state held across frames', () => {
    const input = new KeyboardInputAdapter();
    input.keyDown('Space');

    expect(input.consumeIntent().loopHeld).toBe(true);
    expect(input.consumeIntent().loopHeld).toBe(true);

    input.keyUp('Space');
    expect(input.consumeIntent().loopHeld).toBe(false);
  });

  it('emits action edges once even when keydown repeats', () => {
    const input = new KeyboardInputAdapter();
    input.keyDown('Enter');
    input.keyDown('Enter');
    input.keyDown('KeyR');
    input.keyDown('Digit2');

    expect(input.consumeIntent()).toMatchObject({
      confirmPressed: true,
      restartPressed: true,
      choiceIndex: 1,
    });
    expect(input.consumeIntent()).toMatchObject({
      confirmPressed: false,
      restartPressed: false,
      choiceIndex: null,
    });
  });

  it('uses the first choice edge received in a frame', () => {
    const input = new KeyboardInputAdapter();
    input.keyDown('Digit3');
    input.keyDown('Digit1');

    expect(input.consumeIntent().choiceIndex).toBe(2);
  });

  it('reset clears held keys and pending edges', () => {
    const input = new KeyboardInputAdapter();
    input.keyDown('KeyA');
    input.keyDown('Escape');
    input.keyDown('KeyR');

    input.reset();

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

  it('reports whether a key belongs to the gameplay adapter', () => {
    const input = new KeyboardInputAdapter();

    expect(input.keyDown('KeyW')).toBe(true);
    expect(input.keyUp('KeyW')).toBe(true);
    expect(input.keyDown('KeyQ')).toBe(false);
    expect(input.keyUp('KeyQ')).toBe(false);
  });
});

