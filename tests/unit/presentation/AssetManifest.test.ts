import { describe, expect, it } from 'vitest';
import {
  ART_ASSET_PATHS,
  createArtAssetUrls,
  DEFERRED_ART_ASSET_KEYS,
  FALLBACK_ART_ASSET_KEYS,
  resolvePublicAssetUrl,
  STARTUP_ART_ASSET_KEYS,
} from '../../../src/presentation/AssetManifest';

describe('asset manifest', () => {
  it('resolves public assets against root and nested deployment bases', () => {
    const path = 'assets/art/characters/carrier-09.png';

    expect(resolvePublicAssetUrl(path, './')).toBe(
      './assets/art/characters/carrier-09.png',
    );
    expect(resolvePublicAssetUrl(path, '/')).toBe(
      '/assets/art/characters/carrier-09.png',
    );
    expect(resolvePublicAssetUrl(`/${path}`, '/Fleshloom')).toBe(
      '/Fleshloom/assets/art/characters/carrier-09.png',
    );
  });

  it('keeps the startup payload focused on assets required for first input', () => {
    expect(STARTUP_ART_ASSET_KEYS).toEqual([
      'asphaltTile',
      'carrier',
      'drifter',
      'tether',
      'carrierWalk',
      'drifterWalk',
    ]);
    expect(STARTUP_ART_ASSET_KEYS).not.toContain('armoredDrifter');
    expect(STARTUP_ART_ASSET_KEYS).not.toContain('warden');
  });

  it('assigns every production art asset to exactly one loading phase', () => {
    const plannedKeys = [
      ...STARTUP_ART_ASSET_KEYS,
      ...DEFERRED_ART_ASSET_KEYS,
      ...FALLBACK_ART_ASSET_KEYS,
    ];

    expect(new Set(plannedKeys).size).toBe(plannedKeys.length);
    expect([...plannedKeys].sort()).toEqual(Object.keys(ART_ASSET_PATHS).sort());
  });

  it('creates a complete URL record for the selected deployment base', () => {
    const urls = createArtAssetUrls('/Fleshloom/');

    expect(urls.armoredDrifter).toBe(
      '/Fleshloom/assets/art/enemies/armored-drifter.png',
    );
    expect(Object.keys(urls)).toHaveLength(Object.keys(ART_ASSET_PATHS).length);
  });
});
