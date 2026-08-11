import { describe, expect, it } from 'vitest';
import { ENEMY_DEFINITIONS } from '../../../src/content/enemies';
import {
  getWavePhase,
  M2_RUN_DURATION_SECONDS,
  M2_WAVE_SCHEDULE,
} from '../../../src/content/waves';
import {
  WaveDirector,
  type EnemySpawnRequest,
  type WaveAliveCounts,
  type WaveArenaBounds,
  type WaveRandom,
  type WaveStepContext,
} from '../../../src/game/waves/WaveDirector';

const arena: WaveArenaBounds = {
  minX: 0,
  minY: 0,
  maxX: 1_000,
  maxY: 800,
};

const playerPosition = { x: 500, y: 400 };

const emptyCounts = (): Record<keyof WaveAliveCounts, number> => ({
  drifter: 0,
  rusher: 0,
  watcher: 0,
});

const contextFor = (
  aliveCounts: WaveAliveCounts,
  bounds: WaveArenaBounds = arena,
  player = playerPosition,
): WaveStepContext => ({
  aliveCounts,
  bounds,
  playerPosition: player,
});

const applyRequests = (
  counts: Record<keyof WaveAliveCounts, number>,
  requests: readonly EnemySpawnRequest[],
): void => {
  for (const request of requests) {
    counts[request.archetype] += 1;
  }
};

const constantRandom = (value = 0): WaveRandom => () => value;

const seededRandom = (seed: number): WaveRandom => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
};

describe('M2 wave schedule', () => {
  it('defines five contiguous phases covering exactly three minutes', () => {
    expect(
      M2_WAVE_SCHEDULE.map((phase) => [
        phase.id,
        phase.startSeconds,
        phase.endSeconds,
      ]),
    ).toEqual([
      ['safe-drifters', 0, 15],
      ['drifter-retry', 15, 40],
      ['rusher-introduction', 40, 75],
      ['watcher-introduction', 75, 120],
      ['mixed-pressure', 120, 180],
    ]);
    expect(M2_RUN_DURATION_SECONDS).toBe(180);
    expect(Object.isFrozen(M2_WAVE_SCHEDULE)).toBe(true);

    for (const phase of M2_WAVE_SCHEDULE) {
      expect(Object.isFrozen(phase)).toBe(true);
      expect(Object.isFrozen(phase.targets)).toBe(true);
      expect(Object.isFrozen(phase.spawnOrder)).toBe(true);
      expect(phase.targets).not.toHaveProperty('cutter');
    }
  });
});

describe('WaveDirector', () => {
  it('spawns only Drifters during the first safe 15 seconds', () => {
    const director = new WaveDirector({ random: seededRandom(1) });

    const requests = director.step(14.999, contextFor(emptyCounts()));

    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((request) => request.archetype === 'drifter')).toBe(
      true,
    );
    expect(requests.every((request) => request.scheduledAtSeconds < 15)).toBe(
      true,
    );
  });

  it('introduces Rusher after 40 seconds but never Watcher before 75', () => {
    const director = new WaveDirector({ random: seededRandom(2) });
    const requests = director.step(74.999, contextFor(emptyCounts()));

    expect(requests.some((request) => request.archetype === 'rusher')).toBe(
      true,
    );
    expect(requests.some((request) => request.archetype === 'watcher')).toBe(
      false,
    );
    expect(
      requests
        .filter((request) => request.archetype === 'rusher')
        .every((request) => request.scheduledAtSeconds >= 40),
    ).toBe(true);

    const counts = emptyCounts();
    applyRequests(counts, requests);
    const introduction = director.step(0.01, contextFor(counts));

    expect(introduction[0]?.archetype).toBe('watcher');
    expect(introduction[0]?.scheduledAtSeconds).toBeGreaterThanOrEqual(75);
  });

  it('uses only the three M2 archetypes throughout all 180 seconds', () => {
    const director = new WaveDirector({ random: seededRandom(3) });

    const requests = director.step(180, contextFor(emptyCounts()));
    const archetypes = requests.map((request) => request.archetype as string);

    expect(requests.some((request) => request.archetype === 'watcher')).toBe(
      true,
    );
    expect(new Set(archetypes)).toEqual(
      new Set(['drifter', 'rusher', 'watcher']),
    );
    expect(archetypes).not.toContain('cutter');
    expect(director.snapshot).toMatchObject({
      elapsedSeconds: 180,
      phaseId: 'complete',
      completed: true,
    });
  });

  it('places every request outside the phase safe radius and inside bounds', () => {
    const director = new WaveDirector({ random: seededRandom(4) });
    const requests = director.step(180, contextFor(emptyCounts()));

    for (const request of requests) {
      const definition = ENEMY_DEFINITIONS[request.archetype];
      const phase = getWavePhase(request.scheduledAtSeconds)!;
      const dx = request.position.x - playerPosition.x;
      const dy = request.position.y - playerPosition.y;

      expect(request.position.x).toBeGreaterThanOrEqual(
        arena.minX + definition.radius,
      );
      expect(request.position.x).toBeLessThanOrEqual(
        arena.maxX - definition.radius,
      );
      expect(request.position.y).toBeGreaterThanOrEqual(
        arena.minY + definition.radius,
      );
      expect(request.position.y).toBeLessThanOrEqual(
        arena.maxY - definition.radius,
      );
      expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(
        phase.playerSafeRadius + definition.radius,
      );
      expect(Object.isFrozen(request)).toBe(true);
      expect(Object.isFrozen(request.position)).toBe(true);
    }
    expect(Object.isFrozen(requests)).toBe(true);
  });

  it('respects the mixed phase archetype targets and global spawn cap', () => {
    const director = new WaveDirector({ random: seededRandom(5) });
    const requests = director.step(180, contextFor(emptyCounts()));
    const totals = emptyCounts();
    applyRequests(totals, requests);
    const mixedPhase = M2_WAVE_SCHEDULE.at(-1)!;

    expect(totals).toEqual({ drifter: 12, rusher: 5, watcher: 4 });
    expect(requests).toHaveLength(mixedPhase.maxAlive);
    expect(totals.drifter).toBeLessThanOrEqual(mixedPhase.targets.drifter);
    expect(totals.rusher).toBeLessThanOrEqual(mixedPhase.targets.rusher);
    expect(totals.watcher).toBeLessThanOrEqual(mixedPhase.targets.watcher);
  });

  it('enforces spawn cooldown between requests', () => {
    const director = new WaveDirector({ random: constantRandom() });
    const counts = emptyCounts();
    const first = director.step(0.01, contextFor(counts));
    applyRequests(counts, first);

    expect(first).toHaveLength(1);
    expect(director.step(2, contextFor(counts))).toEqual([]);

    const next = director.step(1.1, contextFor(counts));
    expect(next).toHaveLength(1);
    expect(next[0]!.scheduledAtSeconds).toBeGreaterThanOrEqual(3);
  });

  it('is deterministic for matching RNG and simulation inputs', () => {
    const first = new WaveDirector({ random: seededRandom(99) });
    const second = new WaveDirector({ random: seededRandom(99) });
    const firstCounts = emptyCounts();
    const secondCounts = emptyCounts();

    for (const delta of [0.016, 4, 11, 25, 35, 45, 60]) {
      const firstRequests = first.step(delta, contextFor(firstCounts));
      const secondRequests = second.step(delta, contextFor(secondCounts));
      expect(firstRequests).toEqual(secondRequests);
      applyRequests(firstCounts, firstRequests);
      applyRequests(secondCounts, secondRequests);
      expect(first.snapshot).toEqual(second.snapshot);
    }
  });

  it('uses the current resized arena for new world-pixel positions', () => {
    const director = new WaveDirector({ random: constantRandom() });
    const counts = emptyCounts();
    const first = director.step(0.01, contextFor(counts));
    applyRequests(counts, first);
    const resizedBounds: WaveArenaBounds = {
      minX: 100,
      minY: 50,
      maxX: 900,
      maxY: 650,
    };
    const resizedPlayer = { x: 500, y: 350 };

    const second = director.step(
      3.1,
      contextFor(counts, resizedBounds, resizedPlayer),
    );

    expect(second).toHaveLength(1);
    const request = second[0]!;
    const radius = ENEMY_DEFINITIONS[request.archetype].radius;
    expect(request.position.x).toBeGreaterThanOrEqual(
      resizedBounds.minX + radius,
    );
    expect(request.position.x).toBeLessThanOrEqual(
      resizedBounds.maxX - radius,
    );
    expect(request.position.y).toBeGreaterThanOrEqual(
      resizedBounds.minY + radius,
    );
    expect(request.position.y).toBeLessThanOrEqual(
      resizedBounds.maxY - radius,
    );
  });

  it('treats invalid dt or bounds as a complete no-op', () => {
    let randomCalls = 0;
    const director = new WaveDirector({
      random: () => {
        randomCalls += 1;
        return 0;
      },
    });
    const initial = director.snapshot;

    for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(director.step(delta, contextFor(emptyCounts()))).toEqual([]);
    }

    const invalidBounds: WaveArenaBounds = {
      minX: 100,
      minY: 0,
      maxX: 0,
      maxY: 100,
    };
    expect(
      director.step(1, contextFor(emptyCounts(), invalidBounds)),
    ).toEqual([]);
    expect(director.snapshot).toEqual(initial);
    expect(randomCalls).toBe(0);
  });

  it('freezes its snapshot and reset restores the simulation clock and ids', () => {
    const director = new WaveDirector({
      random: constantRandom(),
      idPrefix: 'test-enemy',
    });
    const first = director.step(5, contextFor(emptyCounts()));

    expect(first[0]?.id).toBe('test-enemy-1');
    expect(Object.isFrozen(director.snapshot)).toBe(true);
    expect(director.snapshot.elapsedSeconds).toBe(5);

    director.reset();

    expect(director.snapshot).toEqual({
      elapsedSeconds: 0,
      phaseId: 'safe-drifters',
      spawnCooldownRemaining: 0,
      totalSpawnRequests: 0,
      completed: false,
    });
    expect(director.step(0.01, contextFor(emptyCounts()))[0]?.id).toBe(
      'test-enemy-1',
    );
  });
});
