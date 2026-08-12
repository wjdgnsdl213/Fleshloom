export const ART_ASSET_PATHS = {
  background: 'assets/art/environment/quarantine-street-v1.png',
  asphaltTile: 'assets/art/environment/wet-asphalt-tile-v1.png',
  quarantineProps:
    'assets/art/environment/quarantine-props-sheet-v1.webp',
  carrier: 'assets/art/characters/carrier-09.png',
  drifter: 'assets/art/characters/drifter.png',
  carrierDirectional:
    'assets/art/characters/directional/carrier-directional-sheet-v2.webp',
  drifterDirectional:
    'assets/art/characters/directional/drifter-directional-sheet-v2.webp',
  armoredDrifterDirectional:
    'assets/art/characters/directional/armored-drifter-directional-sheet-v1.webp',
  rusherDirectional:
    'assets/art/characters/directional/rusher-directional-sheet-v1.webp',
  watcherDirectional:
    'assets/art/characters/directional/watcher-directional-sheet-v1.webp',
  cutterDirectional:
    'assets/art/characters/directional/cutter-directional-sheet-v1.webp',
  mimicDirectional:
    'assets/art/characters/directional/mimic-directional-sheet-v1.webp',
  eliteHuskDirectional:
    'assets/art/characters/directional/elite-husk-directional-sheet-v1.webp',
  wardenDirectional:
    'assets/art/characters/directional/warden-directional-sheet-v1.webp',
  armoredDrifter: 'assets/art/enemies/armored-drifter.png',
  rusher: 'assets/art/enemies/rusher.png',
  watcher: 'assets/art/enemies/watcher.png',
  cutter: 'assets/art/enemies/cutter.png',
  mimic: 'assets/art/enemies/mimic.png',
  eliteHusk: 'assets/art/enemies/elite-husk.png',
  warden: 'assets/art/boss/warden.png',
  tether: 'assets/art/loop/living-tether-tile-v2.webp',
  carrierWalk: 'assets/art/characters/animation/carrier-walk-sheet-v1.webp',
  drifterWalk: 'assets/art/characters/animation/drifter-walk-sheet-v1.webp',
  armoredDrifterWalk:
    'assets/art/characters/animation/armored-drifter-walk-sheet-v1.webp',
  rusherWalk: 'assets/art/characters/animation/rusher-walk-sheet-v1.webp',
  watcherWalk: 'assets/art/characters/animation/watcher-walk-sheet-v1.webp',
  cutterWalk: 'assets/art/characters/animation/cutter-walk-sheet-v1.webp',
  mimicWalk: 'assets/art/characters/animation/mimic-walk-sheet-v1.webp',
  eliteHuskWalk:
    'assets/art/characters/animation/elite-husk-walk-sheet-v1.webp',
} as const;

export type ArtAssetKey = keyof typeof ART_ASSET_PATHS;

export const STARTUP_ART_ASSET_KEYS = [
  'asphaltTile',
  'carrierDirectional',
  'drifterDirectional',
  'tether',
] as const satisfies readonly ArtAssetKey[];

export const DEFERRED_ART_ASSET_KEYS = [
  'carrier',
  'drifter',
  'carrierWalk',
  'drifterWalk',
  'quarantineProps',
  'armoredDrifterDirectional',
  'rusherDirectional',
  'watcherDirectional',
  'cutterDirectional',
  'mimicDirectional',
  'eliteHuskDirectional',
  'wardenDirectional',
  'armoredDrifter',
  'rusher',
  'watcher',
  'cutter',
  'mimic',
  'eliteHusk',
  'warden',
  'armoredDrifterWalk',
  'rusherWalk',
  'watcherWalk',
  'cutterWalk',
  'mimicWalk',
  'eliteHuskWalk',
] as const satisfies readonly ArtAssetKey[];

export const FALLBACK_ART_ASSET_KEYS = [
  'background',
] as const satisfies readonly ArtAssetKey[];

export function resolvePublicAssetUrl(
  relativePath: string,
  baseUrl: string,
): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${relativePath.replace(/^\/+/, '')}`;
}

export function createArtAssetUrls(baseUrl: string): Record<ArtAssetKey, string> {
  return Object.fromEntries(
    Object.entries(ART_ASSET_PATHS).map(([key, path]) => [
      key,
      resolvePublicAssetUrl(path, baseUrl),
    ]),
  ) as Record<ArtAssetKey, string>;
}

export const ART_ASSET_URLS = createArtAssetUrls(import.meta.env.BASE_URL);
