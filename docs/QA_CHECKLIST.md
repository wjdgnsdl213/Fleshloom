# QA Checklist

## First 30 seconds

- [ ] Movement works immediately with arrows and WASD.
- [ ] The player can identify body, anchor, tether, and enemies without text.
- [ ] Tutorial prompts appear only when relevant and disappear after success.
- [ ] A rough loop is auto-assisted into a valid first capture.
- [ ] A tap or failed loop does not feel like severe punishment.

## Input

- [ ] Diagonal movement is not faster.
- [ ] Releasing loop input while another key is pressed still closes once.
- [ ] Losing window focus cancels or safely resolves held input; no stuck Space state.
- [ ] Browser scrolling is prevented only for gameplay keys while the canvas is active.
- [ ] Hold and toggle modes yield the same simulation intent.
- [ ] Touch can move and loop simultaneously.

## Loop geometry

- [ ] Duplicate and near-duplicate samples are ignored.
- [ ] Tiny, collinear, clockwise, and counter-clockwise paths are handled.
- [ ] Self-intersections resolve deterministically.
- [ ] Closing near the anchor and near an earlier trail segment both work.
- [ ] Enemies on the boundary use one consistent rule.
- [ ] Very large loops cannot exceed sample/performance limits.
- [ ] Camera movement or resize does not change world-space capture results.

## Combat and progression

- [ ] One enemy is captured once per closure.
- [ ] Cutter interruption cannot award the canceled capture.
- [ ] Invulnerability prevents multi-hit damage bursts.
- [ ] Multiple captures sum XP and recovery with the intended cap.
- [ ] Active imprint never changes without explicit player selection.
- [ ] Level-up choice remains permanent for that run and resets next run.
- [ ] Boss stages cannot be skipped or become invulnerable forever.

## Presentation and accessibility

- [ ] Enemy telegraphs remain visible under rain, particles, and loop preview.
- [ ] Closure, player damage, and loop cut use distinct feedback.
- [ ] Reduced shake and reduced flash settings are respected everywhere.
- [ ] Music/SFX/master volume settings persist for the session.
- [ ] Critical information is not color-only.
- [ ] Korean and English strings fit their UI containers when localization is added.

## Release

- [ ] `npm run check` passes from a clean install.
- [ ] The production build loads via a static server, not only Vite dev mode.
- [ ] No missing assets, console errors, or unhandled promise rejections.
- [ ] Chrome, Edge, and one mobile browser complete a run.
- [ ] Public and backup URLs work in a signed-out/private session.
- [ ] Restart from death and ending takes at most two actions.

