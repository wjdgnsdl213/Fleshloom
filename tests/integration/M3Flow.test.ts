import { describe, expect, it } from 'vitest';
import {
  APEX_MUTATION_ID,
  BASE_MUTATION_IDS,
  LINEAGE_MUTATION_IDS,
} from '../../src/content/mutations';
import type { FullRunEnemyArchetype } from '../../src/content/fullRunEnemies';
import { CutterModel } from '../../src/game/enemies/CutterModel';
import { EliteHuskModel } from '../../src/game/enemies/EliteHuskModel';
import { classifyLoopAttackPoint } from '../../src/game/loop/LoopAttackGeometry';
import {
  LoopPath,
  type LoopClosure,
} from '../../src/game/loop/LoopPath';
import {
  projectLoopClosure,
  type LoopProjectionCount,
} from '../../src/game/loop/LoopProjection';
import { ImprintState } from '../../src/game/progression/ImprintState';
import { MutationDraft } from '../../src/game/progression/MutationDraft';
import {
  FullRunWaveDirector,
  type FullRunAliveCounts,
} from '../../src/game/waves/FullRunWaveDirector';
import { LoopInputController } from '../../src/input/LoopInputController';

const arenaBounds = {
  minX: -1_000,
  minY: -1_000,
  maxX: 1_000,
  maxY: 1_000,
};

const playerPosition = { x: 500, y: 400 };

const emptyAliveCounts = (): Record<FullRunEnemyArchetype, number> => ({
  drifter: 0,
  rusher: 0,
  watcher: 0,
  cutter: 0,
  mimic: 0,
  'elite-husk': 0,
});

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
  bounds: arenaBounds,
  aliveCounts,
});

const createHusk = (id: string): EliteHuskModel =>
  new EliteHuskModel({
    id,
    position: { x: 100, y: 100 },
    phase: 0,
  });

const stepHusk = (husk: EliteHuskModel, steps: number): void => {
  for (let index = 0; index < steps; index += 1) {
    husk.step(0.1, { x: 400, y: 100 }, arenaBounds);
  }
};

describe('M3 production flow contracts', () => {
  it('cancels a cut tether and suppresses loop restart until release then press', () => {
    const input = new LoopInputController('toggle');
    const path = new LoopPath({
      minSampleDistance: 1,
      minimumArea: 1,
      maxSamples: 64,
      anchorSnapRadius: 24,
      trailSnapRadius: 18,
    });
    const cutter = new CutterModel({
      id: 'flow-cutter',
      position: { x: 0, y: -20 },
      phase: 0,
    });

    const startFrame = input.update(true);
    expect(startFrame.started).toBe(true);
    path.begin({ x: -100, y: 0 });
    path.sample({ x: 100, y: 0 });

    let cutObserved = false;
    let closureOnCutFrame: LoopClosure | null = null;
    let projectionsOnCutFrame: readonly LoopClosure[] = [];

    for (let frameIndex = 0; frameIndex < 10; frameIndex += 1) {
      const actions = cutter.step(0.1, {
        playerPosition: { x: 500, y: -20 },
        bounds: arenaBounds,
        tetherSamples: path.samples,
      });

      if (actions.some((action) => action.type === 'loop-cut')) {
        cutObserved = true;
        input.interrupt(true);
        path.cancel();
        continue;
      }

      const frame = input.update(true);
      if (frame.completed) {
        closureOnCutFrame = path.complete({ x: 100, y: 0 });
        projectionsOnCutFrame =
          closureOnCutFrame === null
            ? []
            : projectLoopClosure(
                closureOnCutFrame,
                { x: -100, y: 0 },
                1,
              );
      }
    }

    expect(cutObserved).toBe(true);
    expect(path.active).toBe(false);
    expect(path.samples).toEqual([]);
    expect(closureOnCutFrame).toBeNull();
    expect(projectionsOnCutFrame).toEqual([]);
    expect(
      classifyLoopAttackPoint(projectionsOnCutFrame, { x: 0, y: 0 }, 0),
    ).toBeNull();

    expect(input.update(true)).toEqual({
      active: false,
      started: false,
      completed: false,
    });
    expect(path.active).toBe(false);
    expect(input.update(false)).toEqual({
      active: false,
      started: false,
      completed: false,
    });

    const restartFrame = input.update(true);
    expect(restartFrame).toEqual({
      active: true,
      started: true,
      completed: false,
    });
    path.begin({ x: 20, y: 20 });
    expect(path.active).toBe(true);
  });

  it.each([
    ['Symmetry', 2],
    ['Fourfold', 4],
  ] as const)(
    '%s overlap resolves one hit for one enemy ID',
    (_label, projectionCount) => {
      const closure: LoopClosure = {
        points: [
          { x: -10, y: -10 },
          { x: 10, y: -10 },
          { x: 10, y: 10 },
          { x: -10, y: 10 },
        ],
        area: 400,
        kind: 'direct',
        snapPoint: { x: 0, y: 0 },
      };
      const projections = projectLoopClosure(
        closure,
        { x: 0, y: 0 },
        projectionCount as LoopProjectionCount,
      );
      const enemy = { id: 'shared-prey', position: { x: 0, y: 0 } };

      const individualProjectionHits = projections.filter(
        (projection) =>
          classifyLoopAttackPoint([projection], enemy.position, 0) !== null,
      );
      expect(individualProjectionHits).toHaveLength(projectionCount);

      const hit = classifyLoopAttackPoint(projections, enemy.position, 0);
      expect(hit).toEqual({ projectionIndex: 0, source: 'interior' });

      const rewardedIds = new Set<string>();
      if (hit !== null) {
        rewardedIds.add(enemy.id);
      }
      expect([...rewardedIds]).toEqual(['shared-prey']);
    },
  );

  it('finishes an Elite peel inside four seconds and does not repay an expired peel', () => {
    const finished = createHusk('elite-finished');
    expect(finished.capture()).toMatchObject({
      kind: 'peeled',
      reward: { xp: 25, recovery: 4 },
      exposureSeconds: 4,
    });
    stepHusk(finished, 39);
    expect(finished.snapshot.exposed).toBe(true);
    expect(finished.capture()).toEqual({
      kind: 'killed',
      reward: { xp: 60, recovery: 10 },
    });

    const reformed = createHusk('elite-reformed');
    reformed.capture();
    stepHusk(reformed, 40);
    expect(reformed.snapshot).toMatchObject({
      alive: true,
      exposed: false,
      peelRewardClaimed: true,
    });
    expect(reformed.capture()).toEqual({
      kind: 'peeled',
      reward: { xp: 0, recovery: 0 },
      exposureSeconds: 4,
    });
  });

  it('opens Cutter, Mimic, Elite, then the preboss handoff at exact boundaries', () => {
    const cutterDirector = new FullRunWaveDirector({ random: () => 0 });
    expect(
      cutterDirector.step(180, waveContext(suppressedAliveCounts())),
    ).toEqual([]);
    expect(cutterDirector.snapshot).toMatchObject({
      elapsedSeconds: 180,
      phaseId: 'cutter-introduction',
      completed: false,
    });
    expect(
      cutterDirector.step(
        0.01,
        waveContext({
          drifter: 9,
          rusher: 4,
          watcher: 3,
          cutter: 0,
          mimic: 0,
          'elite-husk': 0,
        }),
      )[0],
    ).toMatchObject({ archetype: 'cutter', scheduledAtSeconds: 180 });

    const mimicDirector = new FullRunWaveDirector({ random: () => 0 });
    mimicDirector.step(240, waveContext(suppressedAliveCounts()));
    expect(mimicDirector.snapshot.phaseId).toBe('mimic-introduction');
    expect(
      mimicDirector.step(
        0.01,
        waveContext({
          drifter: 9,
          rusher: 4,
          watcher: 3,
          cutter: 1,
          mimic: 0,
          'elite-husk': 0,
        }),
      )[0],
    ).toMatchObject({ archetype: 'mimic', scheduledAtSeconds: 240 });

    const eliteDirector = new FullRunWaveDirector({ random: () => 0 });
    eliteDirector.step(420, waveContext(suppressedAliveCounts()));
    expect(eliteDirector.snapshot.phaseId).toBe('elite-introduction');
    expect(
      eliteDirector.step(
        0.01,
        waveContext({
          drifter: 7,
          rusher: 3,
          watcher: 2,
          cutter: 1,
          mimic: 2,
          'elite-husk': 0,
        }),
      )[0],
    ).toMatchObject({
      archetype: 'elite-husk',
      scheduledAtSeconds: 420,
    });

    const completeDirector = new FullRunWaveDirector({ random: () => 0 });
    completeDirector.step(540, waveContext(suppressedAliveCounts()));
    expect(completeDirector.snapshot).toMatchObject({
      elapsedSeconds: 540,
      phaseId: 'complete',
      completed: true,
    });
    expect(
      completeDirector.step(1, waveContext(emptyAliveCounts())),
    ).toEqual([]);
  });

  it('unlocks lineage at the M3 checkpoint and prioritizes eligible Fourfold', () => {
    const director = new FullRunWaveDirector({ random: () => 0 });
    const lineageDraft = new MutationDraft({
      currentRanks: {
        strider: 2,
        marrow: 2,
        carrion: 2,
        hunger: 2,
        synapse: 2,
        memory: 2,
      },
      random: () => 0,
    });

    expect(lineageDraft.draft()).toEqual({ kind: 'empty', candidates: [] });
    director.step(180, waveContext(suppressedAliveCounts()));
    expect(director.snapshot.elapsedSeconds).toBe(180);
    lineageDraft.unlock(LINEAGE_MUTATION_IDS);
    const lineageOffer = lineageDraft.draft();
    expect(lineageOffer.kind).toBe('offered');
    expect(
      lineageOffer.candidates.every((candidate) =>
        LINEAGE_MUTATION_IDS.includes(candidate.id),
      ),
    ).toBe(true);

    const imprints = new ImprintState(25);
    for (const kind of ['blade', 'nerve', 'spike', 'symmetry'] as const) {
      imprints.offer([kind]);
      imprints.replace(kind);
    }
    const apexDraft = new MutationDraft({
      currentRanks: {
        'blade-gland': 1,
        'spike-crown': 1,
        'nerve-lattice': 1,
        'mirror-organ': 1,
      },
      availableIds: [...BASE_MUTATION_IDS, ...LINEAGE_MUTATION_IDS],
      random: () => 0,
    });
    const hasEveryImprint = (
      ['blade', 'nerve', 'spike', 'symmetry'] as const
    ).every((kind) => imprints.activatedKinds.includes(kind));
    const hasEveryLineage = LINEAGE_MUTATION_IDS.every(
      (id) => apexDraft.snapshot.ranks[id] >= 1,
    );

    expect(hasEveryImprint).toBe(true);
    expect(hasEveryLineage).toBe(true);
    apexDraft.unlock([APEX_MUTATION_ID]);
    expect(apexDraft.prioritizeNext(APEX_MUTATION_ID)).toBe(true);

    const apexOffer = apexDraft.draft();
    expect(apexOffer.candidates[0]).toMatchObject({
      id: 'fourfold-hunt',
      currentRank: 0,
      nextRank: 1,
      effects: [{ kind: 'fourfold-projection-unlock' }],
    });
  });
});
