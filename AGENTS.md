# FLESHLOOM repository instructions

## Mission

Build a complete, compact contest game—not a throwaway prototype. The first deliverable is a vertical slice, but every implementation decision must be reusable for the full title/tutorial/run/boss/ending/results flow.

The game fantasy is an original parasitic hunter in a quarantined, rain-soaked city. The player has no ordinary attack: movement creates opportunities and a living loop is the only lethal action. Do not drift back to the older neon-cell/boids concept in the parent workspace documents.

## Read before editing

1. `docs/GAME_DESIGN.md` for locked mechanics and scope.
2. `docs/VISUAL_BIBLE.md` for art direction and reference boundaries.
3. `docs/ARCHITECTURE.md` for ownership and dependency direction.
4. `docs/MILESTONES.md` for the current milestone.
5. `docs/DECISIONS.md` before revisiting an already settled decision.

If code and documentation disagree, stop and surface the mismatch. Do not silently reinterpret a locked rule.

## Locked gameplay rules

- Direction input always moves the hunter. Looping must never freeze body movement.
- Toggle is the default loop input: the first press plants an anchor and pays out a living tether as the hunter continues moving; the second press closes it.
- Hold/release remains an accessibility alternative, not the default. Both modes use the same loop rules and generous snap assistance.
- A successful loop captures enemies inside it. Larger enemies can require repeated or part-specific captures.
- Captures grant XP and recovery/biomass. Enemy species can offer temporary imprint candidates.
- A new imprint never overwrites the active imprint automatically. The player explicitly keeps or replaces it.
- XP level-ups produce permanent mutations for the current run. Absorption history may weight or unlock choices but must not force them.
- The signature apex mutation is four-direction loop projection; it is late-run power, not the default control scheme.

## Technical boundaries

- TypeScript, Vite, Vitest. Two rendering backends: PixiJS 8 (2D, the default) and three.js (real-time 3D, behind `?renderer=three`). See D-027.
- Keep simulation and game rules independent from any renderer. Pure geometry/progression code belongs under `src/core` or `src/game`; rendering belongs under `src/presentation`.
- A renderer talks to the simulation through exactly one contract: `RendererHost` (`src/presentation/RendererHost.ts`), fed one `PlaygroundRenderState` per frame. `GameApp` must never import a backend, and neither backend may read or change a rule. Backend-specific code lives under `src/presentation/pixi/` or `src/presentation/three/`; anything both backends need is a plain module directly under `src/presentation`.
- Backends are dynamically imported, so a player downloads one of them, never both. `scripts/verify-release.mjs` gates each chunk's gzipped size on its own.
- `src/core` imports only from `src/core`. Where a core module needs a shape that config already declares, restate it structurally rather than importing config.
- Prefer data-driven content under `src/content` as it is introduced. Do not bury balance values in renderers.
- Use typed intent and event boundaries when systems begin communicating. Avoid a global mutable event dump.
- Avoid a heavyweight physics dependency unless a measured problem justifies it.
- Target keyboard and pointer/touch from the same gameplay intent layer. Keyboard first is acceptable for a milestone; keyboard-only architecture is not.
- Preserve a stable 60 FPS target on ordinary integrated-GPU laptops. Pool burst effects before adding large enemy counts.

## Visual boundaries

- Palette: charcoal-black biomass, ivory bone/tendon, restrained arterial red and warning amber against cold rain-soaked streets.
- Readability beats detail at gameplay scale. Every enemy family needs a distinct silhouette and attack telegraph.
- References are for material, contrast, camera, and motion language only. Never copy protected characters, logos, UI, exact silhouettes, or scene compositions.
- The decisive feedback moment is loop closure → contraction → decomposition → reward intake. Treat it as one authored beat across animation, particles, camera, and sound.

## Verification

Run the narrowest relevant tests while working. Before handing off a completed implementation milestone, run:

```powershell
npm run check
```

New pure rules require unit tests. Fixes require a regression test when practical. A build passing does not replace a short manual play check for input or visual changes.

## Documentation discipline

- Record behavior-changing decisions in `docs/DECISIONS.md`.
- Update `docs/GAME_DESIGN.md` when a locked rule changes.
- Log cross-agent handoffs and milestone outcomes in `docs/CODEX_COLLABORATION.md`.
- Keep docs concise and current; remove stale instructions instead of appending contradictions.

## Agent use

The primary agent is the integrator and owns architecture, gameplay rules, input, progression, shared configuration, and final merges.

Use `visual_director` only for bounded presentation work after the related mechanic has an explicit contract. Use `reviewer` read-only at milestone boundaries. For a highly isolated math/test task, a temporary worker may be used, but do not create another permanent role.

At most one write-capable subagent may work beside the primary agent. Assign non-overlapping files, communicate interface changes, wait for the result, then run integration checks. Do not delegate merely because work can be split; parallel write conflicts cost more than they save in this small project.
