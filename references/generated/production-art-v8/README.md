# Production art v8 — directional enemy atlas sources

- `source/*-directional-chroma-v1.png` are the untouched ImageGen outputs.
- Runtime sheets under `public/assets/art/characters/directional/` remove the
  chroma background, normalize every cell to 320×320, and use the atlas order
  `N, NE, E, SE / S, SW, W, NW`.
- Lighting is authored from the screen upper-left in every direction so actor
  facing changes no longer rotate baked highlights like a flat decal.
- The sheets are presentation-only. Collision radii, movement, capture rules,
  rewards, and enemy behavior remain unchanged.

