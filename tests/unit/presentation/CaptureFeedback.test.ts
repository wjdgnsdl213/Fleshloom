import { describe, expect, it } from 'vitest';
import { classifyCaptureFeedback } from '../../../src/presentation/CaptureFeedback';

describe('classifyCaptureFeedback', () => {
  it('distinguishes a miss from an ordinary capture', () => {
    expect(classifyCaptureFeedback(0, [])).toEqual({
      kind: 'miss',
      audioCue: 'ordinary',
    });
    expect(
      classifyCaptureFeedback(1, [
        { captureProfile: 'ordinary', captureLayer: 'ordinary' },
      ]),
    ).toEqual({ kind: 'captured', audioCue: 'ordinary' });
  });

  it('prioritizes shell-peel feedback in a mixed multi-capture closure', () => {
    const feedback = classifyCaptureFeedback(3, [
      { captureProfile: 'ordinary', captureLayer: 'ordinary' },
      { captureProfile: 'armored', captureLayer: 'peeled' },
      { captureProfile: 'armored', captureLayer: 'killed' },
    ]);

    expect(feedback).toEqual({
      kind: 'armor-peeled',
      audioCue: 'shell-peeled',
    });
    expect(Object.isFrozen(feedback)).toBe(true);
  });

  it('uses the ordinary kill beat for the armored final capture', () => {
    expect(
      classifyCaptureFeedback(1, [
        { captureProfile: 'armored', captureLayer: 'killed' },
      ]),
    ).toEqual({ kind: 'captured', audioCue: 'ordinary' });
  });

  it('keeps model-only Warden captures on the successful ordinary beat', () => {
    expect(classifyCaptureFeedback(1, [])).toEqual({
      kind: 'captured',
      audioCue: 'ordinary',
    });
  });
});
