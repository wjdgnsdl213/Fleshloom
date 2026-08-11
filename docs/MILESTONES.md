# Milestones

Contest deadline: **2026-08-26**. Internal submission target: **2026-08-25**.

## M0 — Foundation · Aug 11

- Repository, AGENTS.md, decision docs, design bibles.
- Vite + TypeScript + PixiJS + Vitest baseline.
- Keyboard movement and loop-input playground.
- Build/test/lint green.

Exit test: a new session can read the repository and explain the same locked core rules without relying on chat history.

## M1 — Kill moment gate · Aug 12–13

- Anchor, trail sampling, generous closure/snap, capture polygon.
- Drifter enemies and one-loop capture.
- Authored closure → contraction → decomposition → intake VFX/SFX.
- Toggle default with hold/release available for comparison.
- Five short first-time play tests.

Exit test: every tester completes a valid capture in 30 seconds; at least four describe the closure moment as clear and satisfying. If not, tune control/feedback before adding content.

Implementation status (Aug 11): anchor/trail snap, self-intersection extraction, toggle-default input with hold alternative, capture polygon, and the first authored 0.82-second kill-moment VFX/SFX pass are implemented. The approved styleframe is now being translated into the M1.5 representative runtime screen before five first-time tests.

## M1.5 — Visual target lock · Aug 12–13

- One representative playable screen matching the approved generated styleframe.
- Near-final visual language for Carrier-09, Drifter, living tether, wet quarantine street, and FLESHLOOM HUD.
- Preserve loop/snap readability and the authored kill-moment timing.
- Owner visual sign-off before recruiting five first-time M1 testers.

Exit test: without explanation, the owner can identify the hunter, prey, active tether, valid closure, and decomposition/intake beat; the screen feels like a quarantined-city body-horror hunt rather than a cellular or abstract prototype.

Implementation status (Aug 12): the first procedural runtime pass preserved readability but did not meet the owner's fidelity bar. M1.5B now uses generated production assets for the quarantine street, Carrier-09, Drifter, and living tether, with pooled Pixi sprites, a deformable rope mesh, and procedural fallbacks. Captured Drifter silhouettes still tear before decomposition, intake follows the moving hunter, and the HUD remains outside the hunt band. Automated checks pass; direct owner visual sign-off remains.

## M2 — Three-minute vertical slice · Aug 14–16

- HP, damage, death/restart.
- Drifter, Rusher, Watcher; XP and level-up 3-choice UI.
- One temporary imprint with explicit keep/replace choice.
- Tutorial beats and first three minutes of wave direction.
- Touch/pointer intent path wired, even if art is placeholder.

Exit test: a first-time player reaches a level-up, understands temporary vs permanent power, and can restart without explanation.

Implementation status (Aug 12): the complete M2 code path is integrated ahead of schedule. HP/i-frames/death/restart, three enemy state machines, swept Watcher projectiles, atomic capture recovery/XP, six two-rank mutation cards, Spike/Nerve keep-or-replace offers, a deterministic three-minute wave director, ordered onboarding, and keyboard plus split touch controls are playable. The code gate passed the repository check and a read-only audit with no blocker or major findings. Five first-time human runs remain the experience gate because automated browser control is unavailable in this environment.

## M3 — Full run systems · Aug 17–19

- Five ordinary enemies, Cutter loop interruption, one elite.
- Four imprints, about nine permanent mutations, multi-rank data.
- Apex Fourfold Hunt.
- 9-minute wave curve and all UI states before boss.

Exit test: three different builds feel meaningfully different and no upgrade choice can soft-lock the run.

Implementation status (Aug 12): the run now continues from the unchanged M2 schedule to 9:00. Cutter, Mimic, Elite Husk, Blade/Symmetry projection, four lineage mutations, conditional Fourfold Hunt, six-species wave caps, and corresponding HUD/telegraphs are integrated. The M3 read-only audit found no blocker or major issue and marked the code gate GO. Small-screen visual/input inspection and three human seeded-build runs remain the experience gate.

## M4 — Boss and complete game · Aug 20

- Three-stage Warden Prototype.
- Title, complete run, ending, results, restart.
- 10–12 minute target duration.

Exit test: clean browser session can reach either death results or ending results without developer controls.

Implementation status (Aug 12): the three-stage Warden, title → 9-minute hunt → arrival → arms → shell → core → ending/results flow, deterministic fresh-seed restart, death results, and keyboard/pointer UI paths are integrated. Boss unit and full-flow integration tests pass, and the repository check is green at 28 test files/290 tests plus a production build. The production preview and every runtime art URL return HTTP 200. A clean interactive browser completion remains the experience gate because no controllable browser backend is available in this environment.

## M5 — Art, audio, accessibility · Aug 21–22

- Final silhouettes, environment pass, HUD, key VFX.
- Reactive music layers and essential SFX.
- Touch layout, loop toggle, shake/flash/audio options.
- Performance pass and low-cost effect fallbacks.

Exit test: gameplay remains readable at laptop and phone widths and maintains the performance budget.

Implementation status (Aug 12): production bitmap silhouettes now cover all five ordinary enemies, Elite Husk, and Warden; the renderer retains procedural fallbacks. Reactive synthesized music and essential combat/boss cues are routed through master/music/SFX buses. Session options expose reduced motion, reduced flash, and stepped channel volumes; reduced motion suppresses camera shake and ambient animation, while reduced flash removes HUD bursts and lowers gameplay flash intensity without hiding telegraphs. Automated checks and static asset serving pass. Laptop/phone visual inspection, measured performance, and cross-browser audio/input checks remain.

## M6 — Submission lock · Aug 23–25

- Cross-browser/device QA and external play tests.
- Balance/fairness fixes; no new systems after Aug 23.
- Stable deploy plus backup host, 3-minute capture video, thumbnail, description, Codex process evidence.
- Submit Aug 25 and verify the public link in a signed-out session.

## Scope cuts, in order

If schedule slips, cut additional arenas, lore variants, mutation ranks, and secondary visual flourishes first. Never cut the loop kill moment, first-30-second onboarding, boss completion path, restart speed, or input portability.
