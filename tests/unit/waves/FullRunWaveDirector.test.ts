import { describe, expect, it } from 'vitest';
import { ENEMY_DEFINITIONS } from '../../../src/content/enemies';
import {
  M3_ENEMY_DEFINITIONS,
  type FullRunEnemyArchetype,
} from '../../../src/content/fullRunEnemies';
import {
  FULL_RUN_PREBOSS_SECONDS,
  getM3WavePhase,
} from '../../../src/content/fullRunWaves';
import {
  FullRunWaveDirector,
  type FullRunAliveCounts,
  type FullRunEnemySpawnRequest,
  type FullRunWaveStepContext,
} from '../../../src/game/waves/FullRunWaveDirector';
import {
  WaveDirector,
  type EnemySpawnRequest,
  type WaveAliveCounts,
  type WaveArenaBounds,
  type WaveRandom,
} from '../../../src/game/waves/WaveDirector';

const bounds: WaveArenaBounds = {
  minX: 0,
  minY: 0,
  maxX: 1_000,
  maxY: 800,
};
const playerPosition = { x: 500, y: 400 };

const emptyFullCounts = (): Record<FullRunEnemyArchetype, number> => ({
  drifter: 0,
  rusher: 0,
  watcher: 0,
  cutter: 0,
  mimic: 0,
  'elite-husk': 0,
});

const fullContext = (
  aliveCounts: FullRunAliveCounts,
  arenaBounds: WaveArenaBounds = bounds,
): FullRunWaveStepContext => ({
  playerPosition,
  bounds: arenaBounds,
  aliveCounts,
});

const baseContext = (aliveCounts: WaveAliveCounts) => ({
  playerPosition,
  bounds,
  aliveCounts,
});

const applyFullRequests = (
  counts: Record<FullRunEnemyArchetype, number>,
  requests: readonly FullRunEnemySpawnRequest[],
): void => {
  for (const request of requests) {
    counts[request.archetype] += 1;
  }
};

const applyBaseRequests = (
  counts: Record<'drifter' | 'rusher' | 'watcher', number>,
  requests: readonly EnemySpawnRequest[],
): void => {
  for (const request of requests) {
    counts[request.archetype] += 1;
  }
};

const trackedSeed = (seed: number): { random: WaveRandom; calls: () => number } => {
  let state = seed >>> 0;
  let callCount = 0;
  return {
    random: () => {
      callCount += 1;
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state / 4_294_967_296;
    },
    calls: () => callCount,
  };
};

const radiusFor = (archetype: FullRunEnemyArchetype): number => {
  if (
    archetype === 'drifter' ||
    archetype === 'rusher' ||
    archetype === 'watcher'
  ) {
    return ENEMY_DEFINITIONS[archetype].radius;
  }
  return M3_ENEMY_DEFINITIONS[archetype].radius;
};

const suppressCounts = (): Record<FullRunEnemyArchetype, number> => ({
  drifter: 100,
  rusher: 100,
  watcher: 100,
  cutter: 100,
  mimic: 100,
  'elite-husk': 100,
});

describe('FullRunWaveDirector', () => {
  it('matches M2 output, timing, ids, and RNG consumption through 180 seconds', () => {
    const baseRng = trackedSeed(123);
    const fullRng = trackedSeed(123);
    const base = new WaveDirector({ random: baseRng.random, idPrefix: 'same' });
    const full = new FullRunWaveDirector({
      random: fullRng.random,
      idPrefix: 'same',
    });
    const baseCounts = { drifter: 0, rusher: 0, watcher: 0 };
    const fullCounts = emptyFullCounts();

    for (const delta of [0.016, 5, 14.984, 20, 35, 45, 60]) {
      const baseRequests = base.step(delta, baseContext(baseCounts));
      const fullRequests = full.step(delta, fullContext(fullCounts));

      expect(fullRequests).toEqual(baseRequests);
      expect(full.snapshot.elapsedSeconds).toBe(base.snapshot.elapsedSeconds);
      expect(full.snapshot.spawnCooldownRemaining).toBe(
        base.snapshot.spawnCooldownRemaining,
      );
      expect(full.snapshot.totalSpawnRequests).toBe(
        base.snapshot.totalSpawnRequests,
      );
      expect(fullRng.calls()).toBe(baseRng.calls());
      applyBaseRequests(baseCounts, baseRequests);
      applyFullRequests(fullCounts, fullRequests);
    }

    const finalDelta = 180 - base.snapshot.elapsedSeconds;
    const baseRequests = base.step(finalDelta, baseContext(baseCounts));
    const fullRequests = full.step(finalDelta, fullContext(fullCounts));
    expect(fullRequests).toEqual(baseRequests);
    expect(fullRng.calls()).toBe(baseRng.calls());
    expect(full.snapshot.elapsedSeconds).toBe(180);
    expect(full.snapshot.phaseId).toBe('cutter-introduction');
    expect(full.snapshot.completed).toBe(false);
  });

  it('opens immediate Cutter, Mimic, and Elite intro opportunities at boundaries', () => {
    const cutterDirector = new FullRunWaveDirector({ random: () => 0 });
    cutterDirector.step(180, fullContext(suppressCounts()));
    const cutter = cutterDirector.step(
      0.01,
      fullContext({
        drifter: 9,
        rusher: 4,
        watcher: 3,
        cutter: 0,
        mimic: 0,
        'elite-husk': 0,
      }),
    );
    expect(cutter[0]).toMatchObject({
      archetype: 'cutter',
      scheduledAtSeconds: 180,
    });

    const mimicDirector = new FullRunWaveDirector({ random: () => 0 });
    mimicDirector.step(240, fullContext(suppressCounts()));
    const mimic = mimicDirector.step(
      0.01,
      fullContext({
        drifter: 9,
        rusher: 4,
        watcher: 3,
        cutter: 1,
        mimic: 0,
        'elite-husk': 0,
      }),
    );
    expect(mimic[0]).toMatchObject({
      archetype: 'mimic',
      scheduledAtSeconds: 240,
    });

    const eliteDirector = new FullRunWaveDirector({ random: () => 0 });
    eliteDirector.step(420, fullContext(suppressCounts()));
    const elite = eliteDirector.step(
      0.01,
      fullContext({
        drifter: 7,
        rusher: 3,
        watcher: 2,
        cutter: 1,
        mimic: 2,
        'elite-husk': 0,
      }),
    );
    expect(elite[0]).toMatchObject({
      archetype: 'elite-husk',
      scheduledAtSeconds: 420,
    });
  });

  it('reserves room for each introduction when the prior phase is full', () => {
    const cutterDirector = new FullRunWaveDirector({ random: () => 0 });
    cutterDirector.step(180, fullContext(suppressCounts()));
    expect(
      cutterDirector.step(
        0.01,
        fullContext({
          drifter: 12,
          rusher: 5,
          watcher: 4,
          cutter: 0,
          mimic: 0,
          'elite-husk': 0,
        }),
      )[0]?.archetype,
    ).toBe('cutter');

    const mimicDirector = new FullRunWaveDirector({ random: () => 0 });
    mimicDirector.step(240, fullContext(suppressCounts()));
    expect(
      mimicDirector.step(
        0.01,
        fullContext({
          drifter: 12,
          rusher: 5,
          watcher: 4,
          cutter: 2,
          mimic: 0,
          'elite-husk': 0,
        }),
      )[0]?.archetype,
    ).toBe('mimic');

    const eliteDirector = new FullRunWaveDirector({ random: () => 0 });
    eliteDirector.step(420, fullContext(suppressCounts()));
    expect(
      eliteDirector.step(
        0.01,
        fullContext({
          drifter: 12,
          rusher: 5,
          watcher: 4,
          cutter: 2,
          mimic: 4,
          'elite-husk': 0,
        }),
      )[0]?.archetype,
    ).toBe('elite-husk');
  });

  it('keeps only one Cutter alive during its first twenty seconds', () => {
    const director = new FullRunWaveDirector({ random: () => 0 });
    director.step(180, fullContext(suppressCounts()));
    const counts = {
      drifter: 9,
      rusher: 4,
      watcher: 3,
      cutter: 0,
      mimic: 0,
      'elite-husk': 0,
    };
    const introduction = director.step(0.01, fullContext(counts));
    applyFullRequests(counts, introduction);

    const beforeBoundary = director.step(19.98, fullContext(counts));
    expect(
      beforeBoundary.filter((request) => request.archetype === 'cutter'),
    ).toEqual([]);

    const pressure = director.step(0.02, fullContext(counts));
    expect(pressure.filter((request) => request.archetype === 'cutter')).toHaveLength(
      1,
    );
    expect(pressure.find((request) => request.archetype === 'cutter')!.scheduledAtSeconds).toBeGreaterThanOrEqual(
      200,
    );
  });

  it('enforces projected archetype targets and global cap in a full finite step', () => {
    const director = new FullRunWaveDirector({ random: trackedSeed(77).random });
    director.step(330, fullContext(suppressCounts()));
    const requests = director.step(89.999, fullContext(emptyFullCounts()));
    const totals = emptyFullCounts();
    applyFullRequests(totals, requests);

    expect(totals).toEqual({
      drifter: 11,
      rusher: 5,
      watcher: 4,
      cutter: 2,
      mimic: 4,
      'elite-husk': 0,
    });
    expect(requests).toHaveLength(26);
  });

  it('places every M3 request outside safety clearance and within radius bounds', () => {
    const director = new FullRunWaveDirector({ random: trackedSeed(88).random });
    director.step(330, fullContext(suppressCounts()));
    const requests = director.step(89.999, fullContext(emptyFullCounts()));

    for (const request of requests) {
      const phase = getM3WavePhase(request.scheduledAtSeconds)!;
      const radius = radiusFor(request.archetype);
      const dx = request.position.x - playerPosition.x;
      const dy = request.position.y - playerPosition.y;

      expect(request.position.x).toBeGreaterThanOrEqual(bounds.minX + radius);
      expect(request.position.x).toBeLessThanOrEqual(bounds.maxX - radius);
      expect(request.position.y).toBeGreaterThanOrEqual(bounds.minY + radius);
      expect(request.position.y).toBeLessThanOrEqual(bounds.maxY - radius);
      expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(
        phase.playerSafeRadius + radius,
      );
      expect(Object.isFrozen(request)).toBe(true);
      expect(Object.isFrozen(request.position)).toBe(true);
    }
    expect(Object.isFrozen(requests)).toBe(true);
  });

  it('is deterministic for equal RNG and frame inputs', () => {
    const first = new FullRunWaveDirector({ random: trackedSeed(999).random });
    const second = new FullRunWaveDirector({ random: trackedSeed(999).random });
    const firstCounts = emptyFullCounts();
    const secondCounts = emptyFullCounts();

    for (const delta of [30, 90, 60, 20, 40, 90, 120, 90]) {
      const firstRequests = first.step(delta, fullContext(firstCounts));
      const secondRequests = second.step(delta, fullContext(secondCounts));
      expect(firstRequests).toEqual(secondRequests);
      applyFullRequests(firstCounts, firstRequests);
      applyFullRequests(secondCounts, secondRequests);
      expect(first.snapshot).toEqual(second.snapshot);
    }
  });

  it('processes a full finite delta to the 540-second preboss handoff', () => {
    const director = new FullRunWaveDirector({ random: () => 0 });

    expect(director.step(10_000, fullContext(suppressCounts()))).toEqual([]);
    expect(director.snapshot).toEqual({
      elapsedSeconds: FULL_RUN_PREBOSS_SECONDS,
      phaseId: 'complete',
      spawnCooldownRemaining: 0,
      totalSpawnRequests: 0,
      completed: true,
    });
    expect(director.step(1, fullContext(emptyFullCounts()))).toEqual([]);
  });

  it('treats invalid dt, bounds, or any archetype count as a no-op', () => {
    const rng = trackedSeed(1);
    const director = new FullRunWaveDirector({ random: rng.random });
    const initial = director.snapshot;

    for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(director.step(delta, fullContext(emptyFullCounts()))).toEqual([]);
    }

    expect(
      director.step(
        1,
        fullContext(emptyFullCounts(), { ...bounds, maxY: Number.NaN }),
      ),
    ).toEqual([]);
    expect(
      director.step(
        1,
        fullContext({ ...emptyFullCounts(), cutter: -1 }),
      ),
    ).toEqual([]);
    expect(director.snapshot).toEqual(initial);
    expect(rng.calls()).toBe(0);
  });

  it('reset restores the M2 start and deterministic id sequence', () => {
    const director = new FullRunWaveDirector({
      random: () => 0,
      idPrefix: 'full',
    });
    const first = director.step(0.01, fullContext(emptyFullCounts()));

    expect(first[0]?.id).toBe('full-1');
    expect(Object.isFrozen(director.snapshot)).toBe(true);

    director.reset();

    expect(director.snapshot).toEqual({
      elapsedSeconds: 0,
      phaseId: 'safe-drifters',
      spawnCooldownRemaining: 0,
      totalSpawnRequests: 0,
      completed: false,
    });
    expect(director.step(0.01, fullContext(emptyFullCounts()))[0]?.id).toBe(
      'full-1',
    );
  });
});
