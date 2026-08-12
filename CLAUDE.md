# Claude Code entry point

`AGENTS.md` is the binding repository instruction file. Read it completely
before editing. Then read `docs/HANDOFF.md` and follow its required document
order. Do not rely on chat history or infer a different game from parent
workspace material.

## First commands

```bash
git status -sb
git log -3 --oneline --decorate
npm ci
npm run release:verify
```

If the code and locked documents disagree, stop and report the mismatch. Do not
silently reinterpret a mechanic.

## Current objective

Continue with **P7-3 representative-screen composition and styleframe
fidelity**, as specified in `docs/HANDOFF.md`. The approved completion reference
is `references/generated/loop-gameplay-styleframe-v1.png`.

Preserve the core contracts: movement never freezes while tethering, Toggle is
the default loop input, Hold is an accessibility alternative with identical
rules, the living loop is the only lethal action, imprints require explicit
keep/replace choice, XP mutations remain run-permanent, and Fourfold Hunt stays
a late-run Apex.

Prefer presentation-only changes for P7-3. Simulation and rules stay independent
from Pixi. Run the narrowest tests while working and `npm run release:verify`
before handoff. Record milestone results in `docs/CODEX_COLLABORATION.md`, update
the relevant current docs, make a dedicated commit, and push `origin/main`.
