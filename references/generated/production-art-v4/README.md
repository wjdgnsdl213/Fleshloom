# FLESHLOOM Production Art V4 — Locomotion Sheets

Date: 2026-08-12

## Purpose

Replace whole-bitmap drifting with readable, grounded locomotion that approaches `references/generated/loop-gameplay-styleframe-v1.png` at gameplay scale.

## Reference roles

- `loop-gameplay-styleframe-v1.png`: camera, grounded pose, small-screen silhouette, dark wet material, restrained color, and contact-weight reference.
- Existing per-actor PNG: identity, anatomy, bone placement, and species distinction reference.
- The generated outputs are new runtime poses; the styleframe is not copied as a runtime crop.

## Styleframe gap audit

| Target signal | Before P7-1 | P7-1 lock |
| --- | --- | --- |
| Ground contact | Whole image translated/breathed | Authored alternating contact/passing poses |
| Body weight | Uniform scale pulse | Distance-driven shoulder/hip compression and lateral roll |
| Carrier gait | One static symmetric body | Four-frame leg/arm/tendril counterphase |
| Drifter gait | Static enemy image | Long-arm drag and alternating bent feet |
| Species rhythm | Shared sine twitch | Per-species stride distance and authored frames |
| Idle | Continuous fake walk/breath | Planted authored idle frame; cycle advances only with displacement |
| Runtime cost | Large individual PNGs | Eight alpha WebP sheets total about 1.15MiB |

## Output map

| Actor | Chroma source | Runtime alpha sheet | Motion brief |
| --- | --- | --- | --- |
| Carrier-09 | `source/carrier-walk-sheet-chroma.png` | `public/assets/art/characters/animation/carrier-walk-sheet-v1.webp` | Alternating leg contact, opposite arm swing, tendril lag |
| Drifter | `source/drifter-walk-sheet-chroma.png` | `.../drifter-walk-sheet-v1.webp` | Long-hand drag, bent-foot shamble |
| Armored Drifter | `source/armored-drifter-walk-sheet-chroma.png` | `.../armored-drifter-walk-sheet-v1.webp` | Heavy shell inertia and two-beat shamble |
| Rusher | `source/rusher-walk-sheet-chroma.png` | `.../rusher-walk-sheet-v1.webp` | Low spear-arm charge gait |
| Watcher | `source/watcher-walk-sheet-chroma.png` | `.../watcher-walk-sheet-v1.webp` | Three-legged planted stalking cycle |
| Cutter | `source/cutter-walk-sheet-chroma.png` | `.../cutter-walk-sheet-v1.webp` | Foot contact opposite scythe swing |
| Mimic | `source/mimic-walk-sheet-chroma.png` | `.../mimic-walk-sheet-v1.webp` | Twin halves lag and break symmetry while crawling |
| Elite Husk | `source/elite-husk-walk-sheet-chroma.png` | `.../elite-husk-walk-sheet-v1.webp` | Slow knuckle/foot weight transfer and shell delay |

## Shared final prompt structure

All eight assets used the built-in image generation tool. Every call paired the current actor as the identity/anatomy reference with the approved styleframe as the camera/material/motion reference.

```text
Use case: stylized-concept
Asset type: production top-down 2x2 sprite sheet for FLESHLOOM <actor> locomotion
Primary request: four sequential poses of the SAME actor in exact row-major order:
left contact, compressed passing, right contact, stretched passing. Alternate planted limbs,
shoulder/hip weight transfer, no floating. Same identity, scale, center, upward facing,
three-quarter top-down camera and lighting in every frame.
Backdrop: perfectly uniform flat #00ff00 chroma key. No scenery, floor, shadow, reflection,
grid, labels, crops, text, watermark or green in the subject.
Style: high-detail photoreal dark action-RPG sprite matching the approved styleframe,
wet black/brown tissue, restrained aged ivory, species core color kept subtle.
```

Actor-specific prompts then locked the anatomy and gait described in the output table. Exact detailed prompts remain available in the generation call history for this P7-1 workstream.

## Alpha processing

The installed imagegen `remove_chroma_key.py` helper was used with border auto-key, soft matte, thresholds 12/220, despill, and one-pixel edge contraction. Runtime outputs are alpha WebP; chroma sources remain archived for non-destructive revision.

## Validation

- Every result is an exact visual 2×2 layout with the same actor identity across all four cells.
- Alternating limb contact is visible in all eight sheets at original resolution.
- Alpha outputs use 1,254×1,254 sheets and retain transparent corners without an obvious green rim.
- Runtime frame progression is driven by actual displacement, not elapsed animation time.
- Warden is excluded because it orbits/attacks in a fixed arena instead of walking.
