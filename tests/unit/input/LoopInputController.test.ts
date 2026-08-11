import { describe, expect, it } from 'vitest';
import { LoopInputController } from '../../../src/input/LoopInputController';

describe('LoopInputController', () => {
  it('starts in toggle mode by default', () => {
    const input = new LoopInputController();

    expect(input.inputMode).toBe('toggle');
  });

  it('maps press and release directly in hold mode', () => {
    const input = new LoopInputController('hold');

    expect(input.update(true)).toEqual({
      active: true,
      started: true,
      completed: false,
    });
    expect(input.update(true)).toEqual({
      active: true,
      started: false,
      completed: false,
    });
    expect(input.update(false)).toEqual({
      active: false,
      started: false,
      completed: true,
    });
  });

  it('keeps the loop active between presses in toggle mode', () => {
    const input = new LoopInputController('toggle');

    expect(input.update(true).started).toBe(true);
    expect(input.update(false).active).toBe(true);
    expect(input.update(true)).toEqual({
      active: false,
      started: false,
      completed: true,
    });
  });

  it('safely cancels active state when changing modes', () => {
    const input = new LoopInputController('toggle');
    input.update(true);

    input.setMode('hold');

    expect(input.inputMode).toBe('hold');
    expect(input.update(false).active).toBe(false);
  });

  it.each(['toggle', 'hold'] as const)(
    'requires release after a severed %s loop',
    (mode) => {
      const input = new LoopInputController(mode);
      input.update(true);
      input.interrupt(true);

      expect(input.update(true)).toEqual({
        active: false,
        started: false,
        completed: false,
      });
      expect(input.update(false)).toEqual({
        active: false,
        started: false,
        completed: false,
      });
      expect(input.update(true).started).toBe(true);
    },
  );
});
