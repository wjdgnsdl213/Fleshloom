import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../../src/core/random/SeededRandom';
import { PlayerVitals } from '../../src/game/player/PlayerVitals';
import { Experience } from '../../src/game/progression/Experience';
import { ImprintState } from '../../src/game/progression/ImprintState';
import { MutationDraft } from '../../src/game/progression/MutationDraft';
import {
  ChoiceClock,
  IMPRINT_SLOW_SCALE,
} from '../../src/game/run/ChoiceClock';
import { KeyboardInputAdapter } from '../../src/input/KeyboardInputAdapter';
import { LoopInputController } from '../../src/input/LoopInputController';
import { PointerInputAdapter } from '../../src/input/PointerInputAdapter';

describe('M2 integrated flow contracts', () => {
  it('applies capture recovery before same-frame damage and opens draft last', () => {
    const vitals = new PlayerVitals({
      maxHp: 100,
      contactInvulnerabilitySeconds: 0.65,
    });
    const experience = new Experience({
      firstThreshold: 30,
      thresholdGrowth: 1.4,
    });
    const random = new SeededRandom(7);
    const draft = new MutationDraft({
      currentRanks: {},
      random: () => random.next(),
    });

    vitals.damage(40, 'setup');
    vitals.update(1);
    experience.gain(20);

    // Capture phase: recovery and XP are atomic, but no choice exists yet.
    vitals.heal(12);
    experience.gain(10);
    expect(vitals.snapshot.hp).toBe(72);
    expect(experience.snapshot.pendingChoices).toBe(1);
    expect(draft.snapshot.candidates).toHaveLength(0);

    // Damage phase still belongs to the frame that produced the level.
    vitals.damage(18, 'rusher-1');
    expect(vitals.snapshot.hp).toBe(54);

    // Transition phase is last; nothing simulation-like follows this call.
    expect(draft.draft().kind).toBe('offered');
    expect(draft.snapshot.candidates).toHaveLength(3);
  });

  it('uses 15% imprint time before the exact 2.5 second pause boundary', () => {
    const clock = new ChoiceClock();
    clock.openImprint();

    clock.updatePresentation(2.49, false, true);
    expect(clock.snapshot(false, true)).toMatchObject({
      mode: 'slow',
      simulationScale: IMPRINT_SLOW_SCALE,
    });

    clock.updatePresentation(0.01, false, true);
    expect(clock.snapshot(false, true)).toMatchObject({
      mode: 'paused',
      simulationScale: 0,
      imprintOfferAge: 2.5,
    });
    expect(clock.snapshot(true, true).mode).toBe('paused');
  });

  it('emits death once and completely resets vitality, choices, and clocks', () => {
    const vitals = new PlayerVitals({
      maxHp: 100,
      contactInvulnerabilitySeconds: 0.65,
    });
    const experience = new Experience({
      firstThreshold: 30,
      thresholdGrowth: 1.4,
    });
    const imprint = new ImprintState(25);
    const clock = new ChoiceClock();

    expect(vitals.damage(100, 'rusher').kind).toBe('death');
    expect(vitals.damage(10, 'watcher').kind).toBe('ignored');
    experience.gain(30);
    imprint.offer(['spike']);
    imprint.replace('spike');
    clock.openImprint();
    clock.updatePresentation(1, false, true);

    vitals.reset();
    experience.reset();
    imprint.reset();
    clock.reset();

    expect(vitals.snapshot).toMatchObject({ hp: 100, dead: false });
    expect(experience.snapshot).toMatchObject({ level: 1, pendingChoices: 0 });
    expect(imprint.snapshot).toEqual({ active: null, candidates: [] });
    expect(clock.snapshot(false, false)).toEqual({
      mode: 'none',
      simulationScale: 1,
      imprintOfferAge: 0,
    });
  });

  it('produces the same toggle loop sequence from keyboard and pointer intent', () => {
    const keyboard = new KeyboardInputAdapter();
    const pointer = new PointerInputAdapter();
    const keyboardLoop = new LoopInputController('toggle');
    const pointerLoop = new LoopInputController('toggle');

    keyboard.keyDown('Space');
    pointer.loopButtonDown(11);
    expect(keyboardLoop.update(keyboard.consumeIntent().loopHeld)).toEqual(
      pointerLoop.update(pointer.consumeIntent().loopHeld),
    );

    keyboard.keyUp('Space');
    pointer.loopButtonUp(11);
    expect(keyboardLoop.update(keyboard.consumeIntent().loopHeld)).toEqual(
      pointerLoop.update(pointer.consumeIntent().loopHeld),
    );

    keyboard.keyDown('Space');
    pointer.loopButtonDown(12);
    expect(keyboardLoop.update(keyboard.consumeIntent().loopHeld)).toEqual(
      pointerLoop.update(pointer.consumeIntent().loopHeld),
    );
  });
});
