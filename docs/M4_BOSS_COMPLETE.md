# M4 Boss and Complete-Run Contract

Status: implementation contract — 2026-08-12

## Purpose

Turn the 9:00 systems handoff into a complete contest game with a readable
Warden Prototype fight, a short ending, results, and a fast restart. The boss
must test the living-loop verb rather than become a conventional HP target.

## Transition at 9:00

- Stop all ordinary spawning and dismiss pending decision cards without
  silently granting a mutation.
- A choice created on the exact transition frame is recorded as an unspent
  evolution in results, then removed from the live queue so it cannot reopen
  over the boss encounter.
- Existing ordinary enemies and projectiles dissolve without rewards during a
  1.2-second Warden arrival beat. Input remains safe and no stale held loop can
  close across the transition.
- Recenter only the encounter objectives, never teleport Carrier-09.
- Run mutations, current HP, active imprint, and activation history persist.
- The encounter clock is separate from the 9-minute hunt clock.

## Warden Prototype

The Warden has no generic HP bar. It exposes explicit capture objectives. A
single closure can resolve each boss objective at most once; projected loops
remain useful, but one large projection cannot skip a phase.

### Stage 1 — Sever the cutter arms

- Two arm targets orbit the central body at readable, bounded offsets.
- Each valid closure can sever at most one arm, even if both are enclosed.
- An arm locks a line for 0.7 seconds, then lashes once. The telegraph records
  its target and does not track the player after locking.
- A swept lash near Carrier-09 deals 20 damage and then enters recovery.
- Two separate arm-sever echoes advance the boss to the shell stage.

### Stage 2 — Peel the containment shell

- The body becomes the only capture target.
- Two separate enclosing closures peel two visible shell plates. Lineage
  stability bonuses cannot skip the authored two-beat sequence.
- A 0.8-second amber ring telegraph precedes a radial discharge. The safe read
  is either close to the body or outside the announced ring.
- Each successful peel interrupts the current discharge and advances the
  visible shell state.

### Stage 3 — Close the control core

- The exposed core and two control nodes form a triangular final objective.
- One individual projected polygon must contain all three points. Different
  projections cannot contribute one point each.
- The final closure ends attacks immediately and runs a 1.4-second authored
  collapse/intake beat before the ending panel.
- Fourfold helps cover the arena, but the base one-loop build can always form a
  valid final enclosure on the smallest supported playfield.

## Boss capture and reward rules

- Boss objectives use interior polygon capture only. Blade's exterior band is
  still visible and useful against ordinary prey but cannot capture an
  objective that was not enclosed.
- Enemy IDs and boss objective IDs are deduplicated independently.
- Boss captures do not open temporary imprint or mutation choices.
- Arm and shell captures restore 8 HP each, capped by current maximum HP. The
  final core closure restores no HP because combat has ended.

## Complete flow

```text
title -> hunt (0:00-9:00) -> warden arrival -> arms -> shell -> core
      -> 1.4s collapse -> ending/results -> restart or title
           \-> death/results from every combat stage
```

- Title offers Start, loop input mode, and a concise control reminder.
- Death results include survival time, captures, level, and selected build.
- Victory results add Warden clear time and final form/Fourfold state.
- Restart takes one action and uses a fresh deterministic run seed sequence;
  return-to-title takes at most one additional action.
- Results and title are DOM UI driven by the same keyboard/pointer intent
  boundary as gameplay; no pointer-only action is required.

## M4 exit gate

- Unit tests prove that arms require two closures, shell requires two more,
  and the core requires all three points in one projection.
- Boss attacks cannot hit before their telegraph or continue after a stage
  transition/death/victory.
- A clean browser session can reach death results or victory results and can
  restart without developer controls.
- The 0:00-9:00 M2/M3 regression suites remain green.
