# Production art v6 — directional 3D actors

- `source/*-directional-chroma-v1.png` are the untouched ImageGen outputs.
- Runtime sheets under `public/assets/art/characters/directional/` remove only
  the chroma-green background and preserve the authored eight directions.
- Atlas order is `N, NE, E, SE / S, SW, W, NW`.
- Lighting is authored screen-fixed from the upper left so facing changes no
  longer rotate baked highlights like a flat decal.
- The sheets are presentation-only and do not change collision radii, movement,
  capture geometry, or enemy behavior.
