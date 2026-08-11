import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../../../src/core/random/SeededRandom';

describe('SeededRandom', () => {
  it('repeats a sequence for the same seed and after reset', () => {
    const first = new SeededRandom(90210);
    const second = new SeededRandom(90210);
    const sequence = Array.from({ length: 8 }, () => first.next());

    expect(Array.from({ length: 8 }, () => second.next())).toEqual(sequence);
    first.reset();
    expect(Array.from({ length: 8 }, () => first.next())).toEqual(sequence);
  });

  it('always returns values in [0, 1) and freezes snapshots', () => {
    const random = new SeededRandom(1);
    const values = Array.from({ length: 100 }, () => random.next());

    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(Object.isFrozen(random.snapshot)).toBe(true);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects a non-finite seed %s',
    (seed) => {
      expect(() => new SeededRandom(seed)).toThrow('seed');
    },
  );
});
