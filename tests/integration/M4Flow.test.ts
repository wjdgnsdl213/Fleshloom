import { describe, expect, it } from 'vitest';
import type { FullRunEnemyArchetype } from '../../src/content/fullRunEnemies';
import { SeededRandom } from '../../src/core/random/SeededRandom';
import type { Vec2 } from '../../src/core/geometry/vector';
import {
  ENDING_COLLAPSE_SECONDS,
  RunFlow,
  type RunResultInput,
} from '../../src/game/run/RunFlow';
import {
  MAX_WARDEN_STEP_SECONDS,
  WardenModel,
  type WardenAction,
  type WardenArenaBounds,
  type WardenCaptureResult,
} from '../../src/game/boss/WardenModel';
import type { LoopClosure } from '../../src/game/loop/LoopPath';
import { projectLoopClosure } from '../../src/game/loop/LoopProjection';
import { PlayerVitals } from '../../src/game/player/PlayerVitals';
import {
  FullRunWaveDirector,
  type FullRunAliveCounts,
} from '../../src/game/waves/FullRunWaveDirector';

const bounds: WardenArenaBounds = {
  minX: 0,
  minY: 0,
  maxX: 1_000,
  maxY: 800,
};
const playerPosition = { x: 500, y: 620 };

const suppressedAliveCounts = (): Record<
  FullRunEnemyArchetype,
  number
> => ({
  drifter: 100,
  rusher: 100,
  watcher: 100,
  cutter: 100,
  mimic: 100,
  'elite-husk': 100,
});

const waveContext = (aliveCounts: FullRunAliveCounts) => ({
  playerPosition,
  bounds,
  aliveCounts,
});

const wardenContext = () => ({ playerPosition, bounds });

const closureAround = (
  points: readonly Vec2[],
  margin = 16,
): LoopClosure => {
  const minX = Math.min(...points.map((point) => point.x)) - margin;
  const maxX = Math.max(...points.map((point) => point.x)) + margin;
  const minY = Math.min(...points.map((point) => point.y)) - margin;
  const maxY = Math.max(...points.map((point) => point.y)) + margin;

  return {
    points: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
    area: (maxX - minX) * (maxY - minY),
    kind: 'direct',
    snapPoint: { x: minX, y: minY },
  };
};

const stepWarden = (
  warden: WardenModel,
  count: number,
): WardenAction[] => {
  const actions: WardenAction[] = [];
  for (let index = 0; index < count; index += 1) {
    actions.push(
      ...warden.step(MAX_WARDEN_STEP_SECONDS, wardenContext()),
    );
  }
  return actions;
};

const beginCompletedHunt = (baseSeed: number) => {
  const flow = new RunFlow(baseSeed);
  expect(flow.startNewRun()).toBe(true);
  const random = new SeededRandom(flow.snapshot.runSeed);
  const director = new FullRunWaveDirector({
    random: () => random.next(),
    idPrefix: 'm4-flow',
  });
  const requests = director.step(
    540,
    waveContext(suppressedAliveCounts()),
  );

  return { flow, random, director, requests };
};

const victoryResult = (
  huntSeconds: number,
  wardenSeconds: number,
): RunResultInput => ({
  outcome: 'victory',
  huntSeconds,
  wardenSeconds,
  captured: 52,
  level: 10,
  activeImprint: 'symmetry',
  mutations: [
    { id: 'mirror-organ', rank: 2 },
    { id: 'fourfold-hunt', rank: 1 },
  ],
  fourfold: true,
  unspentChoices: 0,
});

describe('M4 production flow', () => {
  it('hands a completed 9:00 hunt to a fresh Warden arrival', () => {
    const { flow, director, requests } = beginCompletedHunt(71);

    expect(requests).toEqual([]);
    expect(director.snapshot).toMatchObject({
      elapsedSeconds: 540,
      phaseId: 'complete',
      completed: true,
    });
    expect(flow.snapshot.scene).toBe('hunt');
    expect(flow.beginWarden()).toBe(true);

    const warden = new WardenModel({
      id: `warden-run-${flow.snapshot.runIndex}`,
      phase: 0.25,
    });
    warden.begin();
    expect(warden.snapshot).toMatchObject({
      stage: 'arrival',
      encounterElapsed: 0,
      attack: null,
    });
    expect(warden.capture([])).toEqual({
      kind: 'ignored',
      reason: 'arrival',
    });

    expect(stepWarden(warden, 11)).toEqual([]);
    expect(warden.snapshot.stage).toBe('arrival');
    expect(stepWarden(warden, 1)).toEqual([]);
    expect(warden.snapshot).toMatchObject({
      stage: 'arms',
      stageProgress: { completed: 0, required: 2 },
      attack: null,
    });
  });

  it('resolves projected boss objectives, recovery, and victory ending in order', () => {
    const { flow, director } = beginCompletedHunt(90210);
    expect(flow.beginWarden()).toBe(true);
    const warden = new WardenModel({ id: 'warden-integration' });
    warden.begin();
    stepWarden(warden, 12);
    const vitals = new PlayerVitals({
      maxHp: 100,
      contactInvulnerabilitySeconds: 0.5,
    });
    expect(vitals.damage(40, 'preboss-pressure').kind).toBe('applied');
    expect(vitals.snapshot.hp).toBe(60);

    const captureResults: WardenCaptureResult[] = [];
    const armClosure = closureAround(
      warden.snapshot.armTargets.map((target) => target.position),
      30,
    );
    const armProjections = projectLoopClosure(
      armClosure,
      warden.snapshot.center,
      2,
    );

    for (let closureIndex = 0; closureIndex < 2; closureIndex += 1) {
      const result = warden.capture(armProjections);
      captureResults.push(result);
      expect(result.kind).toBe('arm-severed');
      if (result.kind === 'arm-severed') {
        expect(vitals.heal(result.recovery)).toBe(8);
      }
    }
    expect(warden.snapshot.stage).toBe('shell');
    expect(captureResults.map((result) => result.kind)).toEqual([
      'arm-severed',
      'arm-severed',
    ]);

    const shellClosure = closureAround([warden.snapshot.center], 24);
    const shellProjections = projectLoopClosure(
      shellClosure,
      warden.snapshot.center,
      4,
    );
    for (let closureIndex = 0; closureIndex < 2; closureIndex += 1) {
      const result = warden.capture(shellProjections);
      captureResults.push(result);
      expect(result.kind).toBe('shell-peeled');
      if (result.kind === 'shell-peeled') {
        expect(vitals.heal(result.recovery)).toBe(8);
      }
    }
    expect(warden.snapshot.stage).toBe('core');
    expect(vitals.snapshot.hp).toBe(92);
    expect(
      captureResults.map((result) =>
        result.kind === 'arm-severed' || result.kind === 'shell-peeled'
          ? result.recovery
          : 0,
      ),
    ).toEqual([8, 8, 8, 8]);

    const coreSnapshot = warden.snapshot;
    const nodeZero = coreSnapshot.controlNodes[0]!.position;
    const nodeOne = coreSnapshot.controlNodes[1]!.position;
    const projectionOrigin = {
      x: (nodeZero.x + nodeOne.x) / 2,
      y: (nodeZero.y + nodeOne.y) / 2,
    };
    const splitBase = closureAround([nodeZero], 20);
    const splitProjections = projectLoopClosure(
      splitBase,
      projectionOrigin,
      4,
    );

    expect(warden.capture(splitProjections)).toEqual({
      kind: 'ignored',
      reason: 'no-objective-enclosed',
    });
    expect(warden.snapshot.stage).toBe('core');

    const coreObjectives = [
      coreSnapshot.core.position,
      nodeZero,
      nodeOne,
    ];
    const coreClosure = closureAround(coreObjectives, 20);
    const coreProjections = projectLoopClosure(
      coreClosure,
      warden.snapshot.center,
      4,
    );
    const coreResult = warden.capture(coreProjections);
    captureResults.push(coreResult);
    expect(coreResult).toMatchObject({
      kind: 'core-closed',
      projectionIndex: 0,
      recovery: 0,
      collapseSeconds: 1.4,
    });
    expect(vitals.snapshot.hp).toBe(92);
    expect(warden.snapshot).toMatchObject({
      stage: 'defeated',
      attack: null,
      collapseRemaining: 1.4,
    });

    const clearSeconds = warden.snapshot.encounterElapsed;
    expect(
      flow.finishVictory(
        victoryResult(director.snapshot.elapsedSeconds, clearSeconds),
      ),
    ).toBe(true);
    expect(flow.snapshot).toMatchObject({
      scene: 'ending',
      endingRemaining: ENDING_COLLAPSE_SECONDS,
    });

    const collapseActions: WardenAction[] = [];
    for (let index = 0; index < 13; index += 1) {
      collapseActions.push(
        ...warden.step(0.1, wardenContext()),
      );
      expect(flow.updatePresentation(0.1)).toBe(false);
    }
    collapseActions.push(...warden.step(0.1, wardenContext()));
    expect(flow.updatePresentation(0.1)).toBe(true);

    expect(collapseActions).toEqual([
      {
        type: 'warden-collapse-complete',
        sourceId: 'warden-integration',
      },
    ]);
    expect(warden.snapshot.endingReady).toBe(true);
    expect(flow.snapshot).toMatchObject({
      scene: 'results',
      endingRemaining: 0,
      result: {
        outcome: 'victory',
        huntSeconds: 540,
        wardenSeconds: clearSeconds,
        totalSeconds: 540 + clearSeconds,
        fourfold: true,
      },
    });
  });

  it('routes model death to results and creates a deterministic fresh restart seed', () => {
    const first = new RunFlow(4_242);
    const twin = new RunFlow(4_242);
    expect(first.startNewRun()).toBe(true);
    expect(twin.startNewRun()).toBe(true);
    expect(first.beginWarden()).toBe(true);
    expect(twin.beginWarden()).toBe(true);
    const firstRunSeed = first.snapshot.runSeed;
    expect(twin.snapshot.runSeed).toBe(firstRunSeed);

    const vitals = new PlayerVitals({
      maxHp: 100,
      contactInvulnerabilitySeconds: 0.5,
    });
    expect(vitals.damage(100, 'warden-lash')).toMatchObject({
      kind: 'death',
      sourceId: 'warden-lash',
      amount: 100,
      hp: 0,
    });
    expect(vitals.snapshot).toMatchObject({ hp: 0, dead: true });
    const deathResult: RunResultInput = {
      outcome: 'death',
      huntSeconds: 540,
      wardenSeconds: 17.5,
      captured: 41,
      level: 8,
      activeImprint: 'blade',
      mutations: [
        { id: 'blade-gland', rank: 1 },
        { id: 'strider', rank: 2 },
      ],
      fourfold: false,
      unspentChoices: 1,
    };

    expect(first.finishDeath(deathResult)).toBe(true);
    expect(first.snapshot).toMatchObject({
      scene: 'results',
      result: {
        outcome: 'death',
        totalSeconds: 557.5,
        unspentChoices: 1,
      },
    });
    expect(Object.isFrozen(first.snapshot.result)).toBe(true);

    first.restartRun();
    twin.restartRun();
    const restartedSeed = first.snapshot.runSeed;
    expect(first.snapshot).toMatchObject({
      scene: 'hunt',
      runIndex: 2,
      result: null,
    });
    expect(restartedSeed).not.toBe(firstRunSeed);
    expect(twin.snapshot.runSeed).toBe(restartedSeed);

    const firstRandom = new SeededRandom(restartedSeed);
    const twinRandom = new SeededRandom(twin.snapshot.runSeed);
    const firstSequence = Array.from({ length: 6 }, () => firstRandom.next());
    const twinSequence = Array.from({ length: 6 }, () => twinRandom.next());
    const previousRandom = new SeededRandom(firstRunSeed);
    const previousSequence = Array.from({ length: 6 }, () =>
      previousRandom.next(),
    );
    expect(firstSequence).toEqual(twinSequence);
    expect(firstSequence).not.toEqual(previousSequence);
  });
});
