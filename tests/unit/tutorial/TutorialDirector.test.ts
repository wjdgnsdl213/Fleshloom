import { describe, expect, it } from 'vitest';
import {
  TUTORIAL_ASSIST_SECONDS,
  TUTORIAL_MOVE_DISTANCE,
  TUTORIAL_PROMPTS,
  TutorialDirector,
} from '../../../src/game/tutorial/TutorialDirector';

describe('TutorialDirector', () => {
  it('starts with a frozen movement prompt', () => {
    const tutorial = new TutorialDirector();
    const snapshot = tutorial.snapshot;

    expect(TUTORIAL_MOVE_DISTANCE).toBe(56);
    expect(TUTORIAL_ASSIST_SECONDS).toBe(12);
    expect(snapshot).toEqual({
      step: 'move',
      elapsedSeconds: 0,
      stepElapsedSeconds: 0,
      completed: false,
      prompt: '이동 · 56px 전진',
      assistRequested: false,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(TUTORIAL_PROMPTS)).toBe(true);
  });

  it('accumulates 56 pixels of movement before advancing once', () => {
    const tutorial = new TutorialDirector();

    expect(tutorial.recordMovement(20)).toBe(true);
    expect(tutorial.snapshot.step).toBe('move');
    expect(tutorial.recordMovement(35.9)).toBe(true);
    expect(tutorial.snapshot.step).toBe('move');
    expect(tutorial.recordMovement(0.1)).toBe(true);
    expect(tutorial.snapshot.step).toBe('anchor');
    expect(tutorial.snapshot.stepElapsedSeconds).toBe(0);

    expect(tutorial.recordMovement(1_000)).toBe(false);
    expect(tutorial.snapshot.step).toBe('anchor');
  });

  it('completes only through move, anchor, close, and capture order', () => {
    const tutorial = new TutorialDirector();

    tutorial.recordMovement(56);
    expect(tutorial.recordLoopStarted()).toBe(true);
    expect(tutorial.snapshot.step).toBe('close');
    expect(tutorial.recordLoopClosed(true)).toBe(true);
    expect(tutorial.snapshot.step).toBe('capture');
    expect(tutorial.recordCapture(2)).toBe(true);

    expect(tutorial.snapshot).toMatchObject({
      step: 'complete',
      completed: true,
      prompt: '사냥 · 생존하고 진화하기',
      assistRequested: false,
    });
  });

  it('ignores out-of-order events instead of skipping steps', () => {
    const tutorial = new TutorialDirector();

    expect(tutorial.recordLoopStarted()).toBe(false);
    expect(tutorial.recordLoopClosed(true)).toBe(false);
    expect(tutorial.recordCapture(1)).toBe(false);
    expect(tutorial.snapshot.step).toBe('move');

    tutorial.recordMovement(56);
    expect(tutorial.recordLoopClosed(true)).toBe(false);
    expect(tutorial.recordCapture(1)).toBe(false);
    expect(tutorial.snapshot.step).toBe('anchor');

    tutorial.recordLoopStarted();
    expect(tutorial.recordCapture(1)).toBe(false);
    expect(tutorial.snapshot.step).toBe('close');
  });

  it('treats invalid deltas, movement, close, and capture values as no-ops', () => {
    const tutorial = new TutorialDirector();
    const initial = tutorial.snapshot;

    for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      tutorial.update(delta);
    }
    for (const distance of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(tutorial.recordMovement(distance)).toBe(false);
    }
    expect(tutorial.snapshot).toEqual(initial);

    tutorial.recordMovement(56);
    tutorial.recordLoopStarted();
    expect(tutorial.recordLoopClosed(false)).toBe(false);
    expect(tutorial.snapshot.step).toBe('close');
    tutorial.recordLoopClosed(true);

    for (const count of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(tutorial.recordCapture(count)).toBe(false);
    }
    expect(tutorial.snapshot.step).toBe('capture');
  });

  it('requests assistance after 12 seconds in one step', () => {
    const tutorial = new TutorialDirector();

    tutorial.update(11.9);
    expect(tutorial.snapshot.assistRequested).toBe(false);
    tutorial.update(0.1);

    expect(tutorial.snapshot).toMatchObject({
      step: 'move',
      elapsedSeconds: 12,
      stepElapsedSeconds: 12,
      assistRequested: true,
    });
  });

  it('clears assistance on progress and can request it again after another stall', () => {
    const tutorial = new TutorialDirector();
    tutorial.update(12);

    expect(tutorial.recordMovement(10)).toBe(true);
    expect(tutorial.snapshot.stepElapsedSeconds).toBe(12);
    expect(tutorial.snapshot.assistRequested).toBe(false);

    tutorial.update(11.9);
    expect(tutorial.snapshot.assistRequested).toBe(false);
    tutorial.update(0.1);
    expect(tutorial.snapshot.assistRequested).toBe(true);

    tutorial.recordMovement(46);
    expect(tutorial.snapshot).toMatchObject({
      step: 'anchor',
      stepElapsedSeconds: 0,
      assistRequested: false,
    });
  });

  it('clears the step assist when the expected event advances', () => {
    const tutorial = new TutorialDirector();
    tutorial.recordMovement(56);
    tutorial.update(12);
    expect(tutorial.snapshot.assistRequested).toBe(true);

    tutorial.recordLoopStarted();

    expect(tutorial.snapshot).toMatchObject({
      step: 'close',
      stepElapsedSeconds: 0,
      assistRequested: false,
    });
  });

  it('keeps guiding beyond 30 seconds instead of failing', () => {
    const tutorial = new TutorialDirector();

    tutorial.update(45);

    expect(tutorial.snapshot).toMatchObject({
      step: 'move',
      elapsedSeconds: 45,
      stepElapsedSeconds: 45,
      completed: false,
      assistRequested: true,
    });
    expect(tutorial.recordMovement(56)).toBe(true);
    expect(tutorial.snapshot.step).toBe('anchor');
  });

  it('freezes elapsed time and ignores events after completion', () => {
    const tutorial = new TutorialDirector();
    tutorial.update(3);
    tutorial.recordMovement(56);
    tutorial.recordLoopStarted();
    tutorial.recordLoopClosed(true);
    tutorial.recordCapture(1);
    const completed = tutorial.snapshot;

    tutorial.update(100);

    expect(tutorial.recordMovement(100)).toBe(false);
    expect(tutorial.recordLoopStarted()).toBe(false);
    expect(tutorial.recordLoopClosed(true)).toBe(false);
    expect(tutorial.recordCapture(1)).toBe(false);
    expect(tutorial.snapshot).toEqual(completed);
  });

  it('reset fully restores the initial tutorial', () => {
    const tutorial = new TutorialDirector();
    tutorial.update(20);
    tutorial.recordMovement(56);
    tutorial.update(5);

    tutorial.reset();

    expect(tutorial.snapshot).toEqual({
      step: 'move',
      elapsedSeconds: 0,
      stepElapsedSeconds: 0,
      completed: false,
      prompt: '이동 · 56px 전진',
      assistRequested: false,
    });
  });
});
