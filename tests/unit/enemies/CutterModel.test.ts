import { describe, expect, it } from 'vitest';
import {
  CUTTER_BALANCE,
  CutterModel,
  MAX_CUTTER_STEP_SECONDS,
  type CutterAction,
  type CutterArenaBounds,
} from '../../../src/game/enemies/CutterModel';
import type { Vec2 } from '../../../src/core/geometry/vector';

const bounds: CutterArenaBounds = {
  minX: -1_000,
  minY: -1_000,
  maxX: 1_000,
  maxY: 1_000,
};

const createCutter = (position: Vec2 = { x: 0, y: 0 }): CutterModel =>
  new CutterModel({
    id: 'cutter-1',
    position,
    phase: 0.25,
  });

const stepFor = (
  cutter: CutterModel,
  totalSeconds: number,
  tetherSamples: readonly Vec2[],
  playerPosition: Vec2 = { x: 500, y: 0 },
): CutterAction[] => {
  const actions: CutterAction[] = [];
  let remaining = totalSeconds;

  while (remaining > 1e-9) {
    const delta = Math.min(MAX_CUTTER_STEP_SECONDS, remaining);
    actions.push(
      ...cutter.step(delta, { playerPosition, bounds, tetherSamples }),
    );
    remaining -= delta;
  }

  return actions;
};

describe('CutterModel', () => {
  it('exposes the locked Cutter balance in a frozen snapshot', () => {
    const cutter = createCutter({ x: 10, y: 20 });
    const snapshot = cutter.snapshot;

    expect(CUTTER_BALANCE).toEqual({
      radius: 20,
      stalkSpeed: 55,
      contactDamage: 16,
      xp: 24,
      captureRecovery: 5,
      tetherDetectionRange: 260,
      telegraphSeconds: 0.65,
      dashSpeed: 320,
      dashSeconds: 0.35,
      recoverSeconds: 1.4,
      tetherHitRadius: 12,
    });
    expect(snapshot).toMatchObject({
      id: 'cutter-1',
      position: { x: 10, y: 20 },
      velocity: { x: 0, y: 0 },
      facing: { x: 0, y: 1 },
      phase: 0.25,
      radius: 20,
      contactDamage: 16,
      xp: 24,
      captureRecovery: 5,
      alive: true,
      state: 'stalk',
      stateTimer: 0,
      lockedSegmentIndex: null,
    });
    expect(Object.isFrozen(CUTTER_BALANCE)).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.position)).toBe(true);
  });

  it('stalks the player at 55 px/s when no active tether exists', () => {
    const cutter = createCutter();

    expect(
      cutter.step(0.1, {
        playerPosition: { x: 100, y: 0 },
        bounds,
        tetherSamples: [],
      }),
    ).toEqual([]);

    expect(cutter.snapshot.position).toEqual({ x: 5.5, y: 0 });
    expect(cutter.snapshot.velocity).toEqual({ x: 55, y: 0 });
    expect(cutter.snapshot.facing).toEqual({ x: 1, y: 0 });
    expect(cutter.snapshot.state).toBe('stalk');
  });

  it('locks the closest segment with a stable lower-index tie break', () => {
    const cutter = createCutter();
    const tether = [
      { x: -100, y: 50 },
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ];

    cutter.step(0.1, {
      playerPosition: { x: 500, y: 0 },
      bounds,
      tetherSamples: tether,
    });

    expect(cutter.snapshot).toMatchObject({
      state: 'telegraph',
      stateTimer: 0.55,
      lockedSegmentIndex: 0,
      lockedMidpoint: { x: -50, y: 50 },
      lockedNormal: { x: 0, y: 1 },
    });
    expect(cutter.snapshot.lockedDirection?.x).toBeCloseTo(-Math.SQRT1_2);
    expect(cutter.snapshot.lockedDirection?.y).toBeCloseTo(Math.SQRT1_2);
    expect(Object.isFrozen(cutter.snapshot.lockedMidpoint)).toBe(true);
  });

  it('does not telegraph a tether farther than 260 px', () => {
    const cutter = createCutter();

    cutter.step(0.1, {
      playerPosition: { x: 100, y: 0 },
      bounds,
      tetherSamples: [
        { x: -100, y: 261 },
        { x: 100, y: 261 },
      ],
    });

    expect(cutter.snapshot.state).toBe('stalk');
    expect(cutter.snapshot.lockedSegmentIndex).toBeNull();
  });

  it('transitions telegraph to dash to recover to stalk', () => {
    const cutter = createCutter();
    const tether = [
      { x: -100, y: 200 },
      { x: 100, y: 200 },
    ];
    cutter.step(0.05, {
      playerPosition: { x: 500, y: 0 },
      bounds,
      tetherSamples: tether,
    });

    stepFor(cutter, 0.6, [], { x: 500, y: 0 });
    expect(cutter.snapshot.state).toBe('dash');
    expect(cutter.snapshot.stateTimer).toBeCloseTo(0.35);

    expect(stepFor(cutter, 0.35, [], { x: 500, y: 0 })).toEqual([]);
    expect(cutter.snapshot.state).toBe('recover');
    expect(cutter.snapshot.stateTimer).toBeCloseTo(1.4);

    stepFor(cutter, 1.4, [], { x: 500, y: 0 });
    expect(cutter.snapshot.state).toBe('stalk');
    expect(cutter.snapshot.stateTimer).toBe(0);
  });

  it('sweeps the dash and emits one loop-cut without tunneling', () => {
    const cutter = createCutter({ x: 0, y: -20 });
    const tether = [
      { x: -100, y: 0 },
      { x: 100, y: 0 },
    ];
    cutter.step(0.05, {
      playerPosition: { x: 500, y: -20 },
      bounds,
      tetherSamples: tether,
    });
    stepFor(cutter, 0.6, tether, { x: 500, y: -20 });

    const actions = cutter.step(0.1, {
      playerPosition: { x: 500, y: -20 },
      bounds,
      tetherSamples: tether,
    });

    expect(actions).toEqual([
      {
        type: 'loop-cut',
        sourceId: 'cutter-1',
        segmentIndex: 0,
        position: { x: 0, y: -12 },
      },
    ]);
    expect(cutter.snapshot.state).toBe('recover');
    expect(cutter.snapshot.alive).toBe(true);
    expect(Object.isFrozen(actions)).toBe(true);
    expect(Object.isFrozen(actions[0])).toBe(true);
    expect(Object.isFrozen(actions[0]!.position)).toBe(true);

    expect(
      cutter.step(0.1, {
        playerPosition: { x: 500, y: -20 },
        bounds,
        tetherSamples: tether,
      }),
    ).toEqual([]);
  });

  it('does not cut when a dash ends before reaching the tether', () => {
    const cutter = createCutter();
    const tether = [
      { x: -100, y: 200 },
      { x: 100, y: 200 },
    ];
    cutter.step(0.05, {
      playerPosition: { x: 500, y: 0 },
      bounds,
      tetherSamples: tether,
    });
    stepFor(cutter, 0.6, tether);

    expect(stepFor(cutter, 0.35, tether)).toEqual([]);
    expect(cutter.snapshot.position.y).toBeCloseTo(112);
    expect(cutter.snapshot.state).toBe('recover');
  });

  it.each([
    [[] as readonly Vec2[]],
    [[{ x: 0, y: 0 }] as readonly Vec2[]],
  ])(
    'never emits against an empty or canceled tether %o',
    (canceledTether) => {
      const cutter = createCutter({ x: 0, y: -20 });
      const activeTether = [
        { x: -100, y: 0 },
        { x: 100, y: 0 },
      ];
      cutter.step(0.05, {
        playerPosition: { x: 500, y: -20 },
        bounds,
        tetherSamples: activeTether,
      });
      stepFor(cutter, 0.6, canceledTether, { x: 500, y: -20 });

      expect(
        stepFor(cutter, 0.35, canceledTether, { x: 500, y: -20 }),
      ).toEqual([]);
    },
  );

  it('keeps its radius inside arena bounds', () => {
    const cutter = createCutter({ x: 95, y: -10 });
    const smallBounds: CutterArenaBounds = {
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100,
    };

    cutter.step(0.1, {
      playerPosition: { x: 200, y: -10 },
      bounds: smallBounds,
      tetherSamples: [],
    });

    expect(cutter.snapshot.position).toEqual({ x: 80, y: 20 });
    expect(cutter.snapshot.velocity).toEqual({ x: 0, y: 0 });
  });

  it('caps a large finite delta to the public maximum step', () => {
    const largeStepCutter = createCutter();
    const cappedStepCutter = createCutter();
    const context = {
      playerPosition: { x: 100, y: 0 },
      bounds,
      tetherSamples: [] as readonly Vec2[],
    };

    expect(largeStepCutter.step(100, context)).toEqual(
      cappedStepCutter.step(MAX_CUTTER_STEP_SECONDS, context),
    );
    expect(largeStepCutter.snapshot).toEqual(cappedStepCutter.snapshot);
  });

  it('treats invalid dt, context, bounds, or tether samples as no-ops', () => {
    const cutter = createCutter();
    const initial = cutter.snapshot;

    for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        cutter.step(delta, {
          playerPosition: { x: 100, y: 0 },
          bounds,
          tetherSamples: [],
        }),
      ).toEqual([]);
    }

    expect(
      cutter.step(0.1, {
        playerPosition: { x: Number.NaN, y: 0 },
        bounds,
        tetherSamples: [],
      }),
    ).toEqual([]);
    expect(
      cutter.step(0.1, {
        playerPosition: { x: 100, y: 0 },
        bounds: { ...bounds, maxX: Number.NaN },
        tetherSamples: [],
      }),
    ).toEqual([]);
    expect(
      cutter.step(0.1, {
        playerPosition: { x: 100, y: 0 },
        bounds,
        tetherSamples: [
          { x: 0, y: 0 },
          { x: Number.POSITIVE_INFINITY, y: 0 },
        ],
      }),
    ).toEqual([]);
    expect(cutter.snapshot).toEqual(initial);
  });

  it('kill clears locks and permanently stops simulation', () => {
    const cutter = createCutter();
    const tether = [
      { x: -100, y: 50 },
      { x: 100, y: 50 },
    ];
    cutter.step(0.1, {
      playerPosition: { x: 500, y: 0 },
      bounds,
      tetherSamples: tether,
    });

    cutter.kill();
    const dead = cutter.snapshot;

    expect(dead).toMatchObject({
      alive: false,
      state: 'dead',
      stateTimer: 0,
      lockedSegmentIndex: null,
      lockedMidpoint: null,
      lockedNormal: null,
      lockedDirection: null,
    });
    expect(
      cutter.step(1, {
        playerPosition: { x: 500, y: 0 },
        bounds,
        tetherSamples: tether,
      }),
    ).toEqual([]);
    expect(cutter.snapshot).toEqual(dead);
  });

  it.each([
    [{ id: '', position: { x: 0, y: 0 }, phase: 0 }],
    [
      {
        id: 'cutter-1',
        position: { x: Number.NaN, y: 0 },
        phase: 0,
      },
    ],
    [
      {
        id: 'cutter-1',
        position: { x: 0, y: 0 },
        phase: Number.POSITIVE_INFINITY,
      },
    ],
  ])('rejects invalid spawn data', (spawn) => {
    expect(() => new CutterModel(spawn)).toThrow(RangeError);
  });
});
