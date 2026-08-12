# FLESHLOOM production art v1

Created on 2026-08-12 with the built-in image generation tool. The approved
`../loop-gameplay-styleframe-v1.png` was supplied as a material, lighting, and
camera reference only. All prompts explicitly prohibited copying characters,
silhouettes, HUD, compositions, logos, and recognizable designs.

## Original runtime assets

- `public/assets/art/characters/carrier-09.png`
- `public/assets/art/characters/drifter.png`
- `public/assets/art/environment/quarantine-street-v1.png`
- `public/assets/art/loop/living-tether-tile.png` (superseded and removed from
  `public/` by the P7-2 v2 WebP; its chroma source remains here)

The character and tether source renders used a flat green background. Their
unmodified outputs are preserved under `source/`. Runtime PNGs were processed
with `remove_chroma_key.py` using border key sampling, a soft matte (14/88),
0.65 px edge feathering, and despill cleanup. The earlier long tether strip is
archived as `living-tether-strip.png`; this v1 set originally used the square
repeat tile to avoid stretching material details around large loops. P7-2 now
uses `public/assets/art/loop/living-tether-tile-v2.webp`.

## Final prompt set

### Carrier-09

One original, isolated, north-facing Carrier-09 game sprite from a
near-orthographic high top-down three-quarter camera. Compact asymmetric
charcoal-black wet anatomy, restrained arterial core, chipped ivory cranial
hook and ribs, and three trailing tissue tendrils. Broad readable value groups,
polished 3D game rendering, and a uniform `#00ff00` background with no floor,
shadow, scenery, UI, text, logo, or resemblance to an existing character.

### Drifter

One original, isolated, north-facing hunched infected prey sprite using the
same camera. Muted gray-brown flesh, broken ivory plates, asymmetrical arms,
simple crouched silhouette, and a clear hostile-cyan containment core. Uniform
`#00ff00` background and the same no-floor/no-shadow/no-UI/no-existing-character
constraints.

### Quarantine street

An empty 16:9 rain-soaked quarantine-street combat plate from the approved
camera: open cracked asphalt center, shallow puddles, restrained lane paint,
edge barricades, sparse biomass, and dim emergency lights. No characters,
bodies, loop, HUD, text, logo, split panels, or copied map composition.

### Living tether

One straight horizontal deformable-rope texture: black wet organic sheath,
narrow arterial filament, tendon ridges, and sparse ivory barbs. Directly
overhead, repeatable-looking ends, uniform `#00ff00` background, and no loop,
knot, creature, floor, shadow, particles, UI, or text.

### Living tether repeat tile

A new square 1:1 short segment derived from the approved tether material, with
matching left/right cut profiles, a centered arterial strand, and one or two
ivory barbs. The tile uses a uniform `#00ff00` background and forbids scenery,
shadows, UI, text, and branching. Its runtime alpha bounds are y=455..781 in a
1254-square texture. Pixi repeats it every ~74 world pixels at scale 0.059,
leaving about 19.3 visible pixels of organic thickness.
