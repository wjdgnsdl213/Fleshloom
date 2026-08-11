import { describe, expect, it } from 'vitest';
import { classifyLoopAttackPoint } from '../../../src/game/loop/LoopAttackGeometry';
import type { LoopClosure } from '../../../src/game/loop/LoopPath';
import {
  MAX_WARDEN_STEP_SECONDS,
  WARDEN_BALANCE,
  WardenModel,
  type WardenAction,
  type WardenArenaBounds,
} from '../../../src/game/boss/WardenModel';
import type { Vec2 } from '../../../src/core/geometry/vector';

const bounds: WardenArenaBounds = {
  minX: 0,
  minY: 0,
  maxX: 1_000,
  maxY: 800,
};
const playerPosition = { x: 720, y: 420 };

const createWarden = (phase = 0): WardenModel =>
  new WardenModel({ id: 'warden-1', phase });

const context = (
  player: Vec2 = playerPosition,
  arena: WardenArenaBounds = bounds,
) => ({ playerPosition: player, bounds: arena });

const stepCount = (
  warden: WardenModel,
  count: number,
  player: Vec2 = playerPosition,
  arena: WardenArenaBounds = bounds,
): WardenAction[] => {
  const actions: WardenAction[] = [];
  for (let index = 0; index < count; index += 1) {
    actions.push(
      ...warden.step(MAX_WARDEN_STEP_SECONDS, context(player, arena)),
    );
  }
  return actions;
};

const advanceArrival = (
  warden: WardenModel,
  arena: WardenArenaBounds = bounds,
): void => {
  expect(stepCount(warden, 12, playerPosition, arena)).toEqual([]);
  expect(warden.snapshot.stage).toBe('arms');
};

const closureAround = (
  points: readonly Vec2[],
  margin = 12,
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

const captureBothArms = (warden: WardenModel): void => {
  const armClosure = closureAround(
    warden.snapshot.armTargets.map((target) => target.position),
    30,
  );
  warden.capture([armClosure]);
  warden.capture([armClosure]);
  expect(warden.snapshot.stage).toBe('shell');
};

const reachCore = (warden: WardenModel): void => {
  advanceArrival(warden);
  captureBothArms(warden);
  const bodyClosure = closureAround([warden.snapshot.center], 20);
  warden.capture([bodyClosure]);
  warden.capture([bodyClosure]);
  expect(warden.snapshot.stage).toBe('core');
};

const expectTargetFits = (
  target: { readonly position: Vec2; readonly radius: number },
  arena: WardenArenaBounds,
): void => {
  expect(target.position.x - target.radius).toBeGreaterThanOrEqual(arena.minX);
  expect(target.position.x + target.radius).toBeLessThanOrEqual(arena.maxX);
  expect(target.position.y - target.radius).toBeGreaterThanOrEqual(arena.minY);
  expect(target.position.y + target.radius).toBeLessThanOrEqual(arena.maxY);
};

describe('WardenModel', () => {
  it('starts in a deeply frozen arrival snapshot with exposed balance data', () => {
    const warden = createWarden(0.25);
    warden.step(0.1, context());
    const snapshot = warden.snapshot;

    expect(WARDEN_BALANCE).toMatchObject({
      arrivalSeconds: 1.2,
      armTelegraphSeconds: 0.7,
      armLashDamage: 20,
      shellTelegraphSeconds: 0.8,
      captureRecovery: 8,
      collapseSeconds: 1.4,
    });
    expect(snapshot).toMatchObject({
      id: 'warden-1',
      phase: 0.25,
      stage: 'arrival',
      center: { x: 500, y: 400 },
      attack: null,
      encounterElapsed: 0.1,
      collapseRemaining: 0,
      endingReady: false,
    });
    expect(snapshot.armTargets).toHaveLength(2);
    expect(snapshot.shellPlates).toHaveLength(2);
    expect(snapshot.controlNodes).toHaveLength(2);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.stageProgress)).toBe(true);
    expect(Object.isFrozen(snapshot.center)).toBe(true);
    expect(Object.isFrozen(snapshot.armTargets)).toBe(true);
    expect(snapshot.armTargets.every(Object.isFrozen)).toBe(true);
    expect(snapshot.armTargets.every((target) => Object.isFrozen(target.position))).toBe(
      true,
    );
    expect(Object.isFrozen(snapshot.shellPlates)).toBe(true);
    expect(Object.isFrozen(snapshot.core)).toBe(true);
    expect(Object.isFrozen(snapshot.controlNodes)).toBe(true);
  });

  it('caps dt, remains deterministic, and cannot attack during arrival', () => {
    const largeStep = createWarden(0.4);
    const cappedStep = createWarden(0.4);

    expect(largeStep.step(10, context())).toEqual([]);
    expect(cappedStep.step(0.1, context())).toEqual([]);
    expect(largeStep.snapshot).toEqual(cappedStep.snapshot);
    expect(stepCount(largeStep, 10)).toEqual([]);
    expect(largeStep.snapshot.stage).toBe('arrival');

    expect(largeStep.step(0.1, context())).toEqual([]);
    expect(largeStep.snapshot.stage).toBe('arms');
    expect(largeStep.snapshot.attack).toBeNull();
  });

  it('locks an arm lash for 0.7 seconds and emits one damage corridor', () => {
    const warden = createWarden();
    advanceArrival(warden);
    const lockedTarget = { x: 700, y: 300 };
    const movedTarget = { x: 250, y: 650 };

    expect(warden.step(0.1, context(lockedTarget))).toEqual([]);
    const telegraph = warden.snapshot.attack;
    expect(telegraph).toMatchObject({
      kind: 'arm-lash',
      state: 'telegraph',
      remainingSeconds: 0.6,
      lockedGeometry: {
        kind: 'corridor',
        end: lockedTarget,
      },
    });
    expect(Object.isFrozen(telegraph)).toBe(true);
    expect(Object.isFrozen(telegraph?.lockedGeometry)).toBe(true);

    expect(stepCount(warden, 5, movedTarget)).toEqual([]);
    expect(warden.snapshot.attack?.lockedGeometry).toMatchObject({
      kind: 'corridor',
      end: lockedTarget,
    });

    const actions = warden.step(0.1, context(movedTarget));
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: 'warden-lash',
      sourceId: 'warden-1',
      armId: 'warden-1:arm-0',
      damage: 20,
      geometry: {
        kind: 'corridor',
        end: lockedTarget,
      },
    });
    expect(warden.snapshot.attack).toMatchObject({
      kind: 'arm-lash',
      state: 'recovery',
      remainingSeconds: 0.9,
      lockedGeometry: null,
    });
    expect(warden.step(0.1, context(movedTarget))).toEqual([]);
    expect(Object.isFrozen(actions)).toBe(true);
    expect(Object.isFrozen(actions[0])).toBe(true);
    expect(
      actions[0]?.type === 'warden-lash' &&
        Object.isFrozen(actions[0].geometry),
    ).toBe(true);
  });

  it('requires two arm closures and resolves at most one arm per closure', () => {
    const warden = createWarden();
    advanceArrival(warden);
    warden.step(0.1, context());
    const bothArms = closureAround(
      warden.snapshot.armTargets.map((target) => target.position),
      30,
    );

    expect(warden.capture([bothArms])).toMatchObject({
      kind: 'arm-severed',
      objectiveId: 'warden-1:arm-0',
      armIndex: 0,
      projectionIndex: 0,
      recovery: 8,
      nextStage: 'arms',
    });
    expect(warden.snapshot.stageProgress).toEqual({
      completed: 1,
      required: 2,
    });
    expect(
      warden.snapshot.armTargets.filter((target) => target.severed),
    ).toHaveLength(1);
    expect(warden.snapshot.attack).toBeNull();

    expect(warden.capture([bothArms])).toMatchObject({
      kind: 'arm-severed',
      objectiveId: 'warden-1:arm-1',
      armIndex: 1,
      recovery: 8,
      nextStage: 'shell',
    });
    expect(warden.snapshot.stage).toBe('shell');
    expect(warden.snapshot.attack).toBeNull();
    expect(warden.step(0.1, context())).toEqual([]);
    expect(warden.snapshot.attack?.kind).toBe('radial-discharge');
  });

  it('uses interior capture only and ignores a nearby Blade band objective', () => {
    const warden = createWarden();
    advanceArrival(warden);
    const arm = warden.snapshot.armTargets[0]!;
    const bandOnlyClosure: LoopClosure = {
      points: [
        { x: arm.position.x - 30, y: arm.position.y - 12 },
        { x: arm.position.x - 1, y: arm.position.y - 12 },
        { x: arm.position.x - 1, y: arm.position.y + 12 },
        { x: arm.position.x - 30, y: arm.position.y + 12 },
      ],
      area: 29 * 24,
      kind: 'direct',
      snapPoint: {
        x: arm.position.x - 30,
        y: arm.position.y - 12,
      },
    };

    expect(
      classifyLoopAttackPoint([bandOnlyClosure], arm.position, 2),
    ).toEqual({ projectionIndex: 0, source: 'blade-band' });
    expect(warden.capture([bandOnlyClosure])).toEqual({
      kind: 'ignored',
      reason: 'no-objective-enclosed',
    });
    expect(warden.snapshot.stageProgress.completed).toBe(0);
  });

  it('peels one shell plate per closure and capture interrupts discharge', () => {
    const warden = createWarden();
    advanceArrival(warden);
    captureBothArms(warden);
    const bodyClosure = closureAround([warden.snapshot.center], 20);

    warden.step(0.1, context());
    expect(warden.snapshot.attack).toMatchObject({
      kind: 'radial-discharge',
      state: 'telegraph',
    });
    expect(warden.capture([bodyClosure])).toMatchObject({
      kind: 'shell-peeled',
      plateIndex: 0,
      projectionIndex: 0,
      recovery: 8,
      nextStage: 'shell',
    });
    expect(warden.snapshot.shellPlates.map((plate) => plate.intact)).toEqual([
      false,
      true,
    ]);
    expect(warden.snapshot.attack).toBeNull();
    expect(stepCount(warden, 4)).toEqual([]);

    let discharge: WardenAction | undefined;
    for (let index = 0; index < 8 && discharge === undefined; index += 1) {
      discharge = warden
        .step(0.1, context())
        .find((action) => action.type === 'warden-discharge');
    }
    expect(discharge).toMatchObject({
      type: 'warden-discharge',
      sourceId: 'warden-1',
      damage: 18,
      geometry: {
        kind: 'ring',
        center: warden.snapshot.center,
      },
    });

    expect(warden.capture([bodyClosure])).toMatchObject({
      kind: 'shell-peeled',
      plateIndex: 1,
      recovery: 8,
      nextStage: 'core',
    });
    expect(warden.snapshot.stage).toBe('core');
    expect(warden.snapshot.attack).toBeNull();
    expect(stepCount(warden, 20)).toEqual([]);
  });

  it('requires core and both nodes inside the same projection', () => {
    const warden = createWarden();
    reachCore(warden);
    const snapshot = warden.snapshot;
    const objectives = [
      snapshot.core.position,
      ...snapshot.controlNodes.map((node) => node.position),
    ];
    const splitProjections = objectives.map((point) =>
      closureAround([point], 5),
    );

    expect(warden.capture(splitProjections)).toEqual({
      kind: 'ignored',
      reason: 'no-objective-enclosed',
    });
    expect(warden.snapshot.stage).toBe('core');

    const result = warden.capture([closureAround(objectives, 10)]);
    expect(result).toEqual({
      kind: 'core-closed',
      objectiveIds: [
        'warden-1:core',
        'warden-1:node-0',
        'warden-1:node-1',
      ],
      projectionIndex: 0,
      recovery: 0,
      collapseSeconds: 1.4,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(
      result.kind === 'core-closed' && Object.isFrozen(result.objectiveIds),
    ).toBe(true);
    expect(warden.snapshot).toMatchObject({
      stage: 'defeated',
      attack: null,
      collapseRemaining: 1.4,
      endingReady: false,
    });
  });

  it('emits collapse completion once after the 1.4-second final beat', () => {
    const warden = createWarden();
    reachCore(warden);
    const snapshot = warden.snapshot;
    const objectives = [
      snapshot.core.position,
      ...snapshot.controlNodes.map((node) => node.position),
    ];
    warden.capture([closureAround(objectives, 10)]);

    const actions = stepCount(warden, 14);
    expect(actions).toEqual([
      { type: 'warden-collapse-complete', sourceId: 'warden-1' },
    ]);
    expect(warden.snapshot).toMatchObject({
      stage: 'defeated',
      collapseRemaining: 0,
      endingReady: true,
    });
    const completed = warden.snapshot;
    expect(warden.step(1, context())).toEqual([]);
    expect(warden.snapshot).toEqual(completed);
  });

  it('scales every objective and radial telegraph into small bounds', () => {
    const smallBounds = { minX: 10, minY: 20, maxX: 90, maxY: 80 };
    const warden = createWarden(0.7);
    advanceArrival(warden, smallBounds);
    let snapshot = warden.snapshot;

    for (const target of snapshot.armTargets) {
      expectTargetFits(target, smallBounds);
    }
    for (const plate of snapshot.shellPlates) {
      expectTargetFits(plate, smallBounds);
    }
    expectTargetFits(snapshot.core, smallBounds);
    for (const node of snapshot.controlNodes) {
      expectTargetFits(node, smallBounds);
    }

    const armClosure = closureAround(
      snapshot.armTargets.map((target) => target.position),
      2,
    );
    warden.capture([armClosure]);
    warden.capture([armClosure]);
    warden.step(0.1, context({ x: 50, y: 50 }, smallBounds));
    snapshot = warden.snapshot;
    const geometry = snapshot.attack?.lockedGeometry;
    expect(geometry?.kind).toBe('ring');
    if (geometry?.kind === 'ring') {
      const extent = geometry.radius + geometry.halfWidth;
      expect(geometry.center.x - extent).toBeGreaterThanOrEqual(
        smallBounds.minX,
      );
      expect(geometry.center.x + extent).toBeLessThanOrEqual(
        smallBounds.maxX,
      );
      expect(geometry.center.y - extent).toBeGreaterThanOrEqual(
        smallBounds.minY,
      );
      expect(geometry.center.y + extent).toBeLessThanOrEqual(
        smallBounds.maxY,
      );
    }
  });

  it('treats invalid steps and capture geometry as no-ops', () => {
    const warden = createWarden();
    const initial = warden.snapshot;

    for (const delta of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(warden.step(delta, context())).toEqual([]);
    }
    expect(
      warden.step(0.1, context({ x: Number.NaN, y: 0 })),
    ).toEqual([]);
    expect(
      warden.step(
        0.1,
        context(playerPosition, { ...bounds, maxY: Number.NaN }),
      ),
    ).toEqual([]);
    expect(warden.snapshot).toEqual(initial);

    const invalidClosure: LoopClosure = {
      points: [
        { x: 0, y: 0 },
        { x: Number.NaN, y: 10 },
        { x: 10, y: 0 },
      ],
      area: 50,
      kind: 'direct',
      snapPoint: { x: 0, y: 0 },
    };
    expect(warden.capture([invalidClosure])).toEqual({
      kind: 'ignored',
      reason: 'invalid',
    });
    expect(warden.snapshot).toEqual(initial);
  });

  it('reset restores the entire encounter state', () => {
    const warden = createWarden(0.3);
    advanceArrival(warden);
    warden.step(0.1, context());
    warden.capture([
      closureAround(
        warden.snapshot.armTargets.map((target) => target.position),
        30,
      ),
    ]);

    warden.reset();

    expect(warden.snapshot).toEqual({
      id: 'warden-1',
      phase: 0.3,
      stage: 'arrival',
      stageProgress: { completed: 0, required: 1.2 },
      center: { x: 0, y: 0 },
      armTargets: [
        {
          id: 'warden-1:arm-0',
          index: 0,
          position: { x: 0, y: 0 },
          radius: 0,
          severed: false,
        },
        {
          id: 'warden-1:arm-1',
          index: 1,
          position: { x: 0, y: 0 },
          radius: 0,
          severed: false,
        },
      ],
      shellPlates: [
        {
          id: 'warden-1:shell-0',
          index: 0,
          side: 'left',
          position: { x: 0, y: 0 },
          radius: 0,
          intact: true,
        },
        {
          id: 'warden-1:shell-1',
          index: 1,
          side: 'right',
          position: { x: 0, y: 0 },
          radius: 0,
          intact: true,
        },
      ],
      core: {
        id: 'warden-1:core',
        position: { x: 0, y: 0 },
        radius: 0,
        active: false,
      },
      controlNodes: [
        {
          id: 'warden-1:node-0',
          index: 0,
          position: { x: 0, y: 0 },
          radius: 0,
          active: false,
        },
        {
          id: 'warden-1:node-1',
          index: 1,
          position: { x: 0, y: 0 },
          radius: 0,
          active: false,
        },
      ],
      attack: null,
      encounterElapsed: 0,
      collapseRemaining: 0,
      endingReady: false,
    });
  });

  it.each([
    [{ id: '' }],
    [{ id: 'warden', phase: Number.NaN }],
    [{ id: 'warden', phase: Number.POSITIVE_INFINITY }],
  ])('rejects invalid spawn data %#', (spawn) => {
    expect(() => new WardenModel(spawn)).toThrow(RangeError);
  });
});
