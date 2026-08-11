# M3 Full Run Systems Contract

Status: implementation contract · 2026-08-12

## Purpose

Extend the proven three-minute slice to a nine-minute pre-boss hunt without
changing the movement-created loop verb. Minute three becomes a checkpoint,
not an ending. The Warden encounter begins at 9:00 in M4.

## Frame-order additions

The M2 order remains authoritative. M3 adds two inputs to enemy stepping:
player velocity and the active tether samples. Cutter interruption is resolved
after enemy movement but before closure. If a swept Cutter dash intersects a
tether segment, the active path is canceled, no polygon is produced, and no
capture reward can be granted on that frame.

Capture resolution supports stability:

- ordinary enemies have one stability and are removed by one enclosing loop;
- Elite Husk has two capture layers;
- every successful layer snapshots an echo before state changes;
- only the final layer removes the enemy;
- partial-layer XP/recovery is explicit content data, never inferred by art.

## Added enemies

### Cutter — Blade source

- Radius 20, stalk speed 55, contact damage 16, 24 final XP, 5 recovery.
- It behaves like a cautious chaser until an active tether has at least two
  samples within 260 px.
- It locks one target segment for a 0.65 s arterial telegraph, then performs a
  320 px/s cutting dash for 0.35 s and recovers for 1.4 s.
- A swept dash/tether intersection emits one `loop-cut` event and immediately
  cancels that path. It cannot award a capture from the canceled loop.
- Cutter is forbidden before 3:00.

### Mimic — Symmetry source

- Radius 18, speed 70, contact damage 15, 22 XP, 4 recovery.
- It maintains pressure by reflecting the player's movement vector while
  correcting toward a 110–190 px band. No input inversion is applied to the
  player.
- Its cyan/ivory bilateral silhouette and mirrored afterimage must distinguish
  it from Watcher at gameplay scale.

### Elite Husk

- Radius 34, speed 34, contact damage 24, two stability layers.
- First capture peels the shell, grants 25 XP and 4 recovery, and exposes the
  core for 4 s; it does not remove the Husk.
- A second capture while exposed removes it, grants 60 XP and 10 recovery, and
  may offer two imprint species gathered by the current run.
- If exposure expires, the shell reforms. Later peels can expose it again but
  the first-layer reward is paid only once per Husk, preventing reward farming.

## Four imprint families

- **Blade:** closing a loop emits one outward ring. It deals one stability
  layer to ordinary enemies in a narrow 56 px band immediately outside the
  selected polygon. This is loop-derived damage, not a separate attack.
- **Spike:** Rusher-class biomass grants +2 recovery and the contraction draws
  the existing inward bone-spike pulse.
- **Nerve:** an active anchor slows enemy simulation to 55% inside 160 px.
- **Symmetry:** capture resolution includes the base polygon plus one copy
  rotated 180 degrees around its anchor. Rewards are deduplicated by enemy ID.

All keep/replace and choice-clock rules from M2 remain unchanged.

## Permanent build expansion

Keep the six M2 mutations and add four lineage mutations, each with two ranks:

- Blade Gland: Blade band +18 px and +1 stability damage at rank 2.
- Spike Crown: Spike recovery bonus +2 per rank and stronger elite stability
  damage at rank 2.
- Nerve Lattice: field radius +28 px and slow factor -10 percentage points per
  rank, clamped at 25% speed.
- Mirror Organ: Symmetry copy reward +10% XP per rank and unlocks its rotated
  preview at rank 2.

After the run has activated all four imprint families at least once and every
lineage mutation has rank 1, the next eligible draft also contains the Apex
card **Fourfold Hunt**. Apex has one rank and projects the selected closure at
0°, 90°, 180°, and 270° around the anchor. Enemy rewards remain deduplicated.

## Nine-minute direction

- 0:00–3:00: the existing M2 schedule and onboarding remain byte-for-byte in
  timing and species restrictions.
- 3:00–4:00: Cutter introduction, maximum one Cutter alive for the first 20 s.
- 4:00–5:30: Mimic introduction and Blade/Symmetry choice contrast.
- 5:30–7:00: mixed five-species pressure with bounded Cutter count.
- 7:00–8:00: first Elite Husk and a protected retry window.
- 8:00–9:00: escalation that can expose Apex without requiring it.
- 9:00: stop ordinary spawning, clear unresolved choice UI safely, and hand
  control to the M4 Warden encounter.

## M3 exit gate

- A Cutter can visibly cancel an unfinished tether but never a completed
  capture or reward.
- Blade and Symmetry are recognizably loop-derived, and all four imprints
  remain explicit choices.
- Elite Husk requires two readable capture beats without duplicate rewards.
- Three seeded runs can produce meaningfully different permanent builds and
  none can exhaust the draft pool into a soft lock.
- The first three minutes still pass the complete M2 regression suite.
