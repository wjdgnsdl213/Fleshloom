# M2 Three-Minute Vertical Slice Contract

Status: implementation contract · 2026-08-12

## Purpose

Turn the M1.5B loop playground into a replayable three-minute combat slice
without changing the signature loop verb. This milestone proves survival,
enemy variety, permanent mutation choice, temporary imprint choice, onboarding,
and keyboard/pointer parity before the full 10–12 minute run is built.

## Frame and clock contract

The playing-frame order is fixed:

1. Advance presentation echoes with real frame time.
2. Read one `InputIntent` snapshot.
3. Move the player and tick vitality.
4. Step enemies and projectiles.
5. Resolve a completed loop atomically; remove captured enemies and aggregate
   rewards before contact damage.
6. Resolve remaining enemy/projectile damage in stable ID order.
7. Advance XP, imprint, tutorial, and wave simulation clocks.
8. Produce one snapshot and one event batch for rendering, HUD, and audio.

Mutation drafts pause simulation completely. The 0.82-second capture echo may
finish on the presentation clock while the draft is open. Imprint offers begin
in 15% slow motion; if the player has not chosen after 2.5 seconds they become
a full pause. Blur, death, and all choice transitions clear held/edge inputs and
cancel an unfinished loop.

## Initial balance

- Player: 100 HP, 0.65 seconds of contact invulnerability, existing 238 px/s
  movement, and no loss of steering after damage.
- Capture recovery: 3–4 HP per ordinary enemy, capped at 12 HP per loop.
- Drifter: 42 px/s chase, 12 contact damage, 10 XP, 3 recovery.
- Rusher: 58 px/s approach, 0.8 s telegraph, 280 px/s charge for 0.42 s,
  1.1 s recovery, 18 damage, 16 XP, 4 recovery, Spike imprint source.
- Watcher: 48 px/s movement, 170–250 px standoff band, 0.9 s target lock,
  2.1 s cooldown, 14 projectile damage, 18 XP, 4 recovery, Nerve imprint
  source.
- XP thresholds start at 30 and increase per level. Overflow is retained and a
  single capture may queue more than one draft, resolved one at a time.

Balance values are data, not renderer constants.

## Progression slice

M2 uses one active imprint slot and at least two candidate species so `Keep`
and `Replace` are both meaningful. A candidate never overwrites the active
imprint automatically.

- Spike: successful closure produces a short inward spike pulse. In M2 it
  increases recovery from captured Rusher-class biomass and establishes the
  hook for later stability damage.
- Nerve: planting an anchor creates a short slow field around it. In M2 it
  reduces enemy movement while they remain near the anchor.
- Base imprint lifetime: 25 seconds. Re-selecting the active type refreshes it
  only after explicit confirmation.

The first mutation pool is intentionally compact but data-driven: movement,
max HP, capture recovery, XP gain, imprint duration, and snap assistance. Each
draft contains three distinct eligible choices. Mutations last for the current
run; imprints expire.

## Three-minute direction

- 0:00–0:15: safe Drifters; movement and first anchor prompt.
- 0:15–0:40: first assisted capture and enough nearby prey to retry.
- 0:40–1:15: Rusher introduction and first level-up.
- 1:15–2:00: Watcher introduction and first imprint keep/replace decision.
- 2:00–3:00: mixed pressure proving HP, recovery, build choice, death, and
  immediate restart. Cutter remains forbidden before M3.

## M2 exit gate

- A fresh player can capture within 30 seconds and reach a mutation draft.
- Damage, invulnerability, death, and restart are readable without removing
  movement control.
- Permanent mutation and temporary imprint are visibly different decisions.
- Keyboard and pointer paths produce the same `InputIntent` and game rules.
- Pure rule tests, integration tests, lint, typecheck, and production build pass.

