# M1.5 Visual Target Contract

Source of truth: `references/generated/loop-gameplay-styleframe-v1.png`  
Status: approved by owner · 2026-08-11

## Goal

Turn the current loop playground into one representative **playable** FLESHLOOM combat screen. Match the styleframe's material hierarchy and predatory mood without reproducing protected characters or treating the styleframe as a texture to paste into the game.

## Required visual hierarchy

1. Carrier-09 is the darkest, most asymmetrical mass, broken by an ivory cranial hook and a restrained arterial core.
2. The active tether reads as a living organ: dark outer mass, arterial inner strand, irregular tendon/bone highlights and sparse barbs.
3. Drifters read as hunched flesh-and-bone prey with a simpler silhouette and hostile cyan containment core. They must never resemble the player at gameplay scale.
4. The arena reads as a rain-wet quarantine street: cracked asphalt, curb/barricade fragments, lane or crossing marks, puddle reflections, restrained biomass at the edges, and red emergency practical light.
5. Red remains concentrated on player agency and capture. Bone marks closure/readiness; cyan remains hostile/research-signaling.

## Motion and feedback

- Idle forms breathe or twitch subtly; no smooth neon-cell pulsing.
- Rain and puddle highlights move independently from actors.
- Existing snap geometry and the 0.82-second closure → contraction → decomposition → intake beat remain unchanged as game rules.
- Empty-loop feedback stays deliberately weaker than a successful capture.

## Technical scope

- Presentation-only PixiJS work. Do not change capture geometry, input, enemy state, or rewards.
- Reuse the approved palette in `src/config/graphics.ts`.
- Prefer deterministic procedural silhouettes and reusable drawing helpers for this target pass; production sprites/animation sheets can replace them after the visual language is approved.
- Preserve 60 FPS intent and avoid uncapped particle growth.

## Acceptance check

- At 1280×720, hunter, prey, living tether, anchor/snap, and capture result are distinguishable in one glance.
- At narrow width, HUD does not obscure the active hunt area.
- A still frame resembles the approved styleframe in mood and material hierarchy, while motion clearly explains the loop mechanic.
- No new gameplay behavior is introduced.
