# Decision Log

Only behavior-changing decisions belong here. Add a new entry instead of rewriting history; mark superseded decisions explicitly.

## D-001 — Complete compact game is the target

- Date: 2026-08-11
- Status: accepted
- Decision: build toward a complete 10–12 minute title/tutorial/run/boss/ending/results loop. The vertical slice is a milestone, not the final product.
- Reason: contest judging benefits from a finished arc, while reusable architecture avoids throwing the prototype away.

## D-002 — The loop is the only lethal action

- Date: 2026-08-11
- Status: accepted
- Decision: remove the ordinary attack. Loop-derived effects may damage or control enemies, but they trigger from loop play rather than a separate attack button.
- Reason: this preserves the clearest original identity and makes every build deepen the same verb.

## D-003 — Movement continues during loop construction

- Date: 2026-08-11
- Status: accepted
- Decision: direction input always moves the body. Pressing loop plants an anchor; holding lays tether; release closes.
- Reason: a stationary remote loop weakened agency and added a second movement mode. This model creates risk through the player's actual route.

## D-004 — Temporary imprints and permanent mutations are separate

- Date: 2026-08-11
- Status: accepted
- Decision: enemy absorption offers temporary species imprints; XP level-ups offer permanent run mutations. Absorption history may influence availability but does not choose for the player.
- Reason: this retains Vampire Survivors-style build clarity while making species selection meaningful moment to moment.

## D-005 — Imprints never auto-overwrite

- Date: 2026-08-11
- Status: accepted
- Decision: multi-enemy capture yields at most two weighted candidates. Existing imprint remains unless the player explicitly replaces it.
- Reason: the player can preserve a desired trait without avoiding combat, while still being invited to adapt.

## D-006 — Four-direction loop is an Apex mutation

- Date: 2026-08-11
- Status: accepted
- Decision: reflected paths grow from one helper toward a final four-direction hunt including the player body.
- Reason: it is visually memorable and mechanically powerful, so it should serve as a run climax rather than baseline complexity.

## D-007 — Restrained agent team

- Date: 2026-08-11
- Status: accepted
- Decision: primary integrator plus two callable roles only: write-capable visual director and read-only milestone reviewer. At most one parallel writer.
- Reason: this project is small and shared-file conflicts would erase the speed benefit of a larger permanent agent roster.

## D-008 — Original parasitic-hunter art direction

- Date: 2026-08-11
- Status: accepted
- Decision: use a quarantined-city body-horror tone rather than a cellular swarm. Existing Prototype images inform material and motion only; final characters, UI, silhouettes, and compositions remain original.
- Reason: this matches the user's intended fantasy while avoiding imitation and retaining gameplay readability.

## D-009 — Assisted closure selects one explicit polygon

- Date: 2026-08-11
- Status: accepted for M1 play test
- Decision: closure preview resolves in this order: valid anchor snap, latest valid self-intersection, valid earlier-trail snap, then direct anchor closure. Invalid tiny snap candidates are ignored in favor of a potentially valid direct closure.
- Reason: the displayed polygon and the capture polygon must be identical, while rough beginner paths should succeed whenever their broad intent is clear. The priority remains tunable after first-time tests.

## D-010 — Toggle is the default loop input

- Date: 2026-08-11
- Status: accepted for M1 play test
- Decision: the first Space press plants the anchor and begins tracing; the second closes the loop. Hold/release remains a selectable alternative using identical gameplay rules. This supersedes only the input gesture in D-003, not its always-moving body rule.
- Reason: Toggle removes the need to hold one key while steering and felt clearer in the owner's hands. Five first-time tests must still validate the default before it is locked for release.

## D-011 — FLESHLOOM is the selected title

- Date: 2026-08-11
- Status: accepted
- Decision: retire the `NEON SWARM` working title and use `FLESHLOOM` for the game, package, repository folder, runtime metadata, and future deployment slugs.
- Reason: `Flesh` establishes the body-horror material while `Loom` describes weaving a lethal living enclosure and rebuilding the hunter from absorbed tissue. The double `OO` also supplies a distinct loop-shaped logo motif.

## D-012 — Capture resolves before damage in the same frame

- Date: 2026-08-12
- Status: accepted
- Decision: after movement and enemy/projectile stepping, a completed loop removes captured enemies and applies recovery, XP, and imprint offers before any remaining projectile or contact damage is applied.
- Reason: the displayed successful capture must be trustworthy, captured enemies cannot deal a final invisible hit, and clutch recovery becomes a legible part of loop mastery.

## D-013 — Permanent and temporary choices use different clocks

- Date: 2026-08-12
- Status: accepted for M2 play test
- Decision: mutation drafts pause simulation immediately. Imprint offers begin with 2.5 seconds at 15% simulation speed and then pause fully until the player explicitly keeps or replaces. The 0.82-second capture echo always uses presentation time and finishes during either choice.
- Reason: permanent build choices need calm comparison, while temporary appetite should initially preserve combat rhythm without becoming unreadable.

## D-014 — The vertical slice is a deterministic three-minute run

- Date: 2026-08-12
- Status: accepted
- Decision: M2 uses seeded mutation and wave randomness with five timed phases: safe Drifters, capture retry, Rusher introduction, Watcher introduction, then mixed pressure. Cutter remains excluded until after minute three.
- Reason: reproducible runs make balance and contest judging easier to evaluate while guaranteeing that the signature mechanic precedes interruption pressure.

## D-015 — Touch uses a split virtual control surface

- Date: 2026-08-12
- Status: accepted for M2 play test
- Decision: coarse-pointer devices use a left virtual movement stick and a separate right LOOP button. The LOOP button produces the same physical held state consumed by the shared toggle/hold controller; it does not implement separate mobile rules.
- Reason: this preserves movement during tether construction and keeps desktop and mobile outcomes on one `InputIntent` contract.

## D-016 — Minute three is a compatibility checkpoint

- Date: 2026-08-12
- Status: accepted
- Decision: the full-run wave director delegates 0:00-3:00 directly to the proven M2 director, then adds Cutter, Mimic, Elite Husk, and higher caps until 9:00. It does not fork or reinterpret the onboarding schedule.
- Reason: the contest-critical first minutes retain identical spawn timing and RNG consumption while later systems can evolve independently.

## D-017 — Loop projections are one deduplicated attack

- Date: 2026-08-12
- Status: accepted
- Decision: Symmetry and Fourfold rotate the selected closure around its planted anchor. Capture classification checks every projected polygon but resolves each enemy ID once. Blade is an exterior band from the same closure, not a separate attack input.
- Reason: projected loops can feel spectacular without multiplying rewards for overlapping geometry or weakening the one-verb combat identity.

## D-018 — Lineage progression unlocks after the checkpoint

- Date: 2026-08-12
- Status: accepted
- Decision: the six M2 mutations remain the only draft pool through 3:00. Four lineage mutations unlock at the checkpoint. After all four imprint families have been activated and all four lineage mutations reach rank one, Fourfold Hunt is guaranteed in the next eligible draft.
- Reason: early choices stay readable and regression-stable, while the apex remains achievable rather than dependent on one lucky random roll.

## D-019 — Simulation uses a finite world and presentation-only camera

- Date: 2026-08-12
- Status: accepted
- Decision: the quarantine district is a fixed 3,200×1,800 world. Player movement, loop geometry, enemies, projectiles, collision, and capture stay in world coordinates. A soft dead-zone camera only translates the Pixi world container; weather and DOM controls remain in viewport space. The Warden transition creates a bounded local arena around the encounter point.
- Reason: movement can traverse a real place without coupling game rules to browser size, while resize behavior and boss framing remain deterministic.
