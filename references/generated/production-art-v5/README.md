# P7-2 living tether asset

Generated and integrated: 2026-08-12

## Purpose

Replace the first production tether with a denser styleframe-faithful strip:
braided charcoal-black biomass, a restrained arterial-red inner strand, and a
regular ivory hook rhythm. The bitmap is presentation-only; loop sampling,
closure, capture, and rewards remain renderer-independent.

## Sources and outputs

- `source/living-tether-v2-chroma.png` is the recovered first chroma render
  from the interrupted P7-2 pass.
- `source/living-tether-v2-clean-chroma.png` is the final built-in ImageGen
  edit. It removes two unintended straight background marks while preserving
  the cable and hook layout.
- `source/living-tether-v2-seamless-chroma.png` is the second built-in ImageGen
  edit. It moves all hooks away from the vertical edges and gives both edges a
  plain matching cable cross-section.
- `public/assets/art/loop/living-tether-tile-v2.webp` is the runtime alpha
  asset produced from the seamless chroma source.
- `living-tether-v2-repeat-preview.jpg` shows three adjacent copies of the
  final wrap-aware runtime asset on a dark neutral background.

The original source is retained for provenance. The runtime does not load it.

## Generation brief

Horizontal seamless-looking living cable for a low three-quarter top-down
action game. Use dense intertwined charcoal-black wet muscle strands, one
restrained glowing arterial-red inner braid, and alternating ivory tendon/bone
hooks. Preserve a readable continuous centerline and transparent-ready
silhouette against a perfectly flat green chroma background. No environment,
text, logo, protected character, or UI.

## Final cleanup prompt

```text
Use case: precise-object-edit
Asset type: seamless horizontal living-tether texture for the FLESHLOOM game
Primary request: Remove only the two thin, perfectly straight horizontal gray-green line artifacts below the braided living cable. They run under the lower ivory hooks and are not part of the creature. Reconstruct that area as clean empty background.
Input image: the supplied image is the edit target.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for later removal, with no shadows, gradients, texture, reflections, floor plane, or lighting variation.
Constraints: preserve the braided charcoal-black biomass cable, glowing arterial-red core, repeating ivory hooks, their positions, proportions, materials, lighting, horizontal composition, and seamless-looking left/right continuation as exactly as possible. Change only the two stray straight lines below the cable. No extra anatomy, no text, no watermark. Do not crop the cable or hooks. Do not use #00ff00 in the subject.
```

## Seamless-repeat prompt

```text
Use case: precise-object-edit
Asset type: horizontally repeating MeshRope texture tile for the FLESHLOOM game
Primary request: Rebuild this living cable as a genuinely seamless horizontal repeat tile. The braided cable must cross both the left and right image boundaries at exactly the same vertical position, thickness, silhouette, lighting, color, and braid phase so copies placed side by side join with no visible cut or jump.
Input image: the supplied image is the edit target and material/anatomy reference.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for later removal, with no shadows, gradients, texture, reflections, floor plane, or lighting variation.
Composition: one straight horizontal cable centered vertically. Keep all ivory hooks fully inside the image and at least 110 pixels away from both left and right boundaries; no hook, loose tendon, highlight spike, or shadow may touch or cross either vertical boundary. At each vertical boundary show only the same plain braided charcoal-black body and centered arterial-red core, spanning the exact same y range. Use a short repeating motif suitable for frequent UV wrapping.
Constraints: preserve the dense braided charcoal-black wet biomass, restrained glowing arterial-red inner strand, ivory tendon/bone hook material, low three-quarter game-render lighting, and overall cable thickness. No straight gray/green line artifacts. No extra anatomy, no text, no watermark, no environment. Do not crop the cable vertically. Do not use #00ff00 in the subject.
```

Built-in ImageGen edit mode was used. Alpha extraction used the installed
`remove_chroma_key.py` helper with border key sampling, soft matte, despill,
one-pixel edge contraction, threshold 20, and opaque threshold 180. A final
128-pixel wrap-aware boundary feather makes the first and last columns equal in
alpha and visible premultiplied color; the lossless WebP preserves that edge.

## Validation

- Runtime dimensions: 1,774 x 887.
- Runtime size: 580,466 bytes.
- Alpha bounds: `(0, 274, 1774, 623)` with all four corners fully transparent.
- Left/right edge maximum alpha difference: 0. Maximum visible premultiplied
  RGB difference: 0. Three-repeat inspection shows no hook or silhouette cut.
- SHA-256:
  `aa4ae87caf789c89b436514725231e1aaa085aaa90a4e197934c4d912acd0cec`.
  The release verifier rejects an unreviewed replacement.
- Distance-based presentation tests cover open/closed path length, segment
  tangents, world-space hook spacing, and opposite-phase braid placement.
- `npm run release:verify`: 40 test files / 337 tests, ESLint, strict
  TypeScript, production build, 20 public-file copies, 12 index references,
  5.49MiB startup art, and 17.28MiB total public payload passed.
- Live browser motion inspection remains pending because no browser backend was
  available in the managed environment.
