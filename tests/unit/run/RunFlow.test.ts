import { describe, expect, it } from 'vitest';
import {
  ENDING_COLLAPSE_SECONDS,
  RunFlow,
  type RunResultInput,
} from '../../../src/game/run/RunFlow';

const result = (outcome: 'death' | 'victory'): RunResultInput => ({
  outcome,
  huntSeconds: 540,
  wardenSeconds: outcome === 'victory' ? 92 : 20,
  captured: 48,
  level: 9,
  activeImprint: 'symmetry',
  mutations: [
    { id: 'strider', rank: 2 },
    { id: 'mirror-organ', rank: 1 },
  ],
  fourfold: false,
  unspentChoices: 1,
});

describe('RunFlow', () => {
  it('starts at title and issues a fresh deterministic seed each run', () => {
    const first = new RunFlow(99);
    const second = new RunFlow(99);

    expect(first.snapshot.scene).toBe('title');
    expect(first.startNewRun()).toBe(true);
    expect(second.startNewRun()).toBe(true);
    expect(first.snapshot.runSeed).toBe(second.snapshot.runSeed);
    expect(first.startNewRun()).toBe(false);
  });

  it('moves hunt to warden but rejects out-of-order transitions', () => {
    const flow = new RunFlow(1);
    expect(flow.beginWarden()).toBe(false);
    flow.startNewRun();
    expect(flow.beginWarden()).toBe(true);
    expect(flow.beginWarden()).toBe(false);
  });

  it('routes hunt or boss death directly to frozen results', () => {
    const flow = new RunFlow(1);
    flow.startNewRun();

    expect(flow.finishDeath(result('death'))).toBe(true);
    expect(flow.snapshot.scene).toBe('results');
    expect(flow.snapshot.result).toMatchObject({
      outcome: 'death',
      totalSeconds: 560,
      unspentChoices: 1,
    });
    expect(Object.isFrozen(flow.snapshot.result)).toBe(true);
    expect(Object.isFrozen(flow.snapshot.result?.mutations)).toBe(true);
  });

  it('holds victory in the authored collapse before results', () => {
    const flow = new RunFlow(1);
    flow.startNewRun();
    flow.beginWarden();
    expect(flow.finishVictory(result('victory'))).toBe(true);
    expect(flow.snapshot).toMatchObject({
      scene: 'ending',
      endingRemaining: ENDING_COLLAPSE_SECONDS,
    });

    expect(flow.updatePresentation(1)).toBe(false);
    expect(flow.updatePresentation(0.4)).toBe(true);
    expect(flow.snapshot.scene).toBe('results');
  });

  it('restarts in one action and can return to title', () => {
    const flow = new RunFlow(1);
    flow.startNewRun();
    flow.finishDeath(result('death'));
    const firstSeed = flow.snapshot.runSeed;

    expect(flow.returnToTitle()).toBe(true);
    expect(flow.snapshot.scene).toBe('title');
    expect(flow.startNewRun()).toBe(true);
    expect(flow.snapshot.runSeed).not.toBe(firstSeed);

    const secondSeed = flow.snapshot.runSeed;
    flow.restartRun();
    expect(flow.snapshot.scene).toBe('hunt');
    expect(flow.snapshot.runSeed).not.toBe(secondSeed);
  });

  it('ignores invalid time and rejects malformed results', () => {
    const flow = new RunFlow(1);
    flow.startNewRun();
    flow.beginWarden();
    expect(() =>
      flow.finishVictory({ ...result('victory'), captured: -1 }),
    ).toThrow('run result');
    expect(flow.updatePresentation(Number.NaN)).toBe(false);
  });
});
