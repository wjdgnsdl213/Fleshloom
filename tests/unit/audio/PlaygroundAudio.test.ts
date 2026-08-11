import { describe, expect, it } from 'vitest';
import {
  nextAudioVolumeStep,
  PlaygroundAudio,
} from '../../../src/audio/PlaygroundAudio';

describe('PlaygroundAudio settings', () => {
  it('cycles from the nearest supported volume and wraps after full volume', () => {
    expect(nextAudioVolumeStep(0)).toBe(0.25);
    expect(nextAudioVolumeStep(0.26)).toBe(0.5);
    expect(nextAudioVolumeStep(0.74)).toBe(1);
    expect(nextAudioVolumeStep(1)).toBe(0);
    expect(nextAudioVolumeStep(Number.NaN)).toBe(0.25);
  });

  it('clamps and freezes the session mix without creating an audio context', () => {
    const audio = new PlaygroundAudio();

    expect(audio.mix).toEqual({ master: 1, music: 0.5, sfx: 1 });
    audio.setMix({ master: -1, music: 1.5, sfx: Number.NaN });

    expect(audio.mix).toEqual({ master: 0, music: 1, sfx: 0 });
    expect(Object.isFrozen(audio.mix)).toBe(true);
  });
});
