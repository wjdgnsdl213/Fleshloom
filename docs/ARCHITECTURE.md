# Architecture

## Stack

- TypeScript + Vite
- PixiJS 8 renderer
- Vitest for pure rule tests
- Native Web Audio initially
- Static web build deployable to more than one host

## Dependency direction

```text
Input adapters ──> InputIntent ──> Game simulation ──> Typed game events
                                        │                    │
                                        ├── loop geometry    ├── renderers / VFX
                                        ├── enemies          ├── UI
                                        └── progression      └── audio
```

Simulation code must not import PixiJS. Presentation consumes state snapshots and typed events; it does not decide captures, damage, XP, or upgrades.

## Planned source ownership

```text
src/
  app/             bootstrap, scene lifecycle, composition root
  config/          graphics, input, balance values
  core/            math, geometry, time, random, typed event primitives
  input/           keyboard, pointer, touch -> InputIntent
  game/
    world/         finite world and renderer-independent camera tracking
    player/        movement, HP, biomass
    loop/          anchor, samples, closure, snap, capture resolver
    enemies/       behaviors and hit/capture state
    progression/   XP, imprints, mutation draft, Apex
    run/           waves, difficulty, run state
  content/         data definitions for enemies, waves, mutations, story
  presentation/    Pixi renderers, particles, camera, environment
  audio/           music layers and SFX routing
  ui/              HUD, tutorial, draft, imprint choice, results
  dev/             debug overlays and balance tools
tests/
  unit/            pure geometry, loop, progression
  integration/     system contracts without rendering where possible
  e2e/             critical browser flows when the vertical slice exists
```

Folders are introduced when they own real code. Do not generate dozens of empty placeholder modules.

## Core contracts to introduce

```ts
interface InputIntent {
  moveX: number;
  moveY: number;
  loopHeld: boolean;
  confirmPressed: boolean;
}

type GameEvent =
  | { type: 'loop-started'; anchor: Vec2 }
  | { type: 'loop-closed'; polygon: readonly Vec2[] }
  | { type: 'capture-resolved'; enemyIds: readonly string[]; area: number }
  | { type: 'player-damaged'; amount: number; sourceId: string }
  | { type: 'level-up'; level: number };
```

Exact event fields can evolve, but input, simulation, and presentation remain separated.

## Loop pipeline

1. Sample player world positions only after minimum distance.
2. Simplify noisy samples without changing the enclosed shape materially.
3. Search anchor/trail snap candidates.
4. Resolve self-intersection into a candidate simple polygon.
5. Reject degenerate or tiny polygons.
6. Broad-phase query nearby enemies.
7. Run point/shape-in-polygon checks and enemy-specific capture rules.
8. Emit one closure result consumed by combat, VFX, UI, and audio.

Geometry functions remain deterministic and unit-tested. Rendering may interpolate but cannot alter the polygon used for capture.

`LoopPath.preview()` is the single source of truth for the currently selected polygon, closure kind, snap point, validity, and area. `complete()` returns that same candidate and clears the path. Presentation must render the preview result rather than reconstructing a different polygon.

## World and camera contract

- Simulation positions use the fixed quarantine-world coordinate system and never depend on canvas dimensions.
- `Camera2D` is a pure model that owns viewport size, a soft player dead zone, edge clamping, and resize continuity.
- `GameApp` supplies camera-local spawn bounds while enemy and projectile movement remain clamped to the full world.
- `LoopPlaygroundRenderer` translates one Pixi world container by the inverse camera origin. Weather, HUD, decisions, and touch controls stay in screen space.
- The Warden owns a local encounter rectangle derived at transition time; both player movement and camera origin are constrained to that rectangle until results.

## Performance budget

- Primary target: stable 60 FPS at 1920×1080 on an ordinary integrated GPU.
- Simulation target: 150 ordinary enemies before adding more.
- Cap loop sample count and simplify old samples.
- Pool particles and enemy display objects.
- Avoid per-frame allocations inside enemy and particle loops after the vertical slice.
- Measure before optimizing; keep a debug overlay for FPS, enemies, samples, and particles.
