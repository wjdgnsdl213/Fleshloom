/**
 * Renderer backend seam.
 *
 * GameApp talks to exactly this interface; the Pixi 2D backend and the three
 * 3D backend both implement it. The host owns its canvas, its frame loop, and
 * its asset lifecycle. The simulation owns everything else.
 */

import type { PlaygroundRenderState } from './RenderState';

export interface ViewSize {
  readonly width: number;
  readonly height: number;
}

export type FrameListener = (deltaSeconds: number) => void;

export interface RendererHost {
  /**
   * Creates the canvas, appends it to `host`, and resolves once the assets
   * needed for the first frame are ready. Returns the canvas so the caller
   * can manage focus and input listeners.
   */
  init(host: HTMLElement): Promise<HTMLCanvasElement>;

  /** Starts loading assets that may appear later; safe to ignore failures. */
  loadDeferredAssets(): Promise<void>;

  /** Logical (CSS pixel) view size — same semantics as Pixi's app.screen. */
  viewSize(): ViewSize;

  /** Registers a per-frame callback driven by the host's own loop. */
  addFrameListener(listener: FrameListener): void;

  /** Draws one frame of the supplied state. */
  render(state: PlaygroundRenderState): void;

  /**
   * Dev-only QA capture of the current viewport as a base64 PNG data URL.
   * Returns null when the backend cannot provide one.
   */
  captureViewport(): Promise<string | null>;

  destroy(): void;
}
