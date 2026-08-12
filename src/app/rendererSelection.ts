/**
 * Renderer backend selection.
 *
 * `?renderer=three` opts into the real-time 3D backend; `?renderer=pixi`
 * forces the 2D backend. Unlike the dev-only qaScene harness this works in
 * production builds, so the owner can A/B the two on a deployed URL. The
 * default flips to 'three' only through the parity gate (plan M10) with an
 * explicit owner decision.
 */

export type RendererKind = 'pixi' | 'three';

export const DEFAULT_RENDERER: RendererKind = 'pixi';

export function resolveRendererKind(
  parameters: Pick<URLSearchParams, 'get'>,
): RendererKind {
  const requested = parameters.get('renderer');
  if (requested === 'pixi' || requested === 'three') {
    return requested;
  }
  return DEFAULT_RENDERER;
}
