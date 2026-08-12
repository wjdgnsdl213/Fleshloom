/**
 * Pixi 8 backend behind the RendererHost seam.
 *
 * Owns the Pixi Application (which GameApp used to own directly), wraps the
 * existing LoopPlaygroundRenderer untouched, and adapts the Pixi ticker to
 * plain deltaSeconds frame listeners.
 */

import { Application, Rectangle, type Ticker } from 'pixi.js';
import { GAMEPLAY_COLORS } from '../../config/graphics';
import { LoopPlaygroundRenderer } from '../LoopPlaygroundRenderer';
import type {
  FrameListener,
  RendererHost,
  ViewSize,
} from '../RendererHost';
import type { PlaygroundRenderState } from '../RenderState';

export class PixiRendererHost implements RendererHost {
  private readonly app = new Application();
  private readonly renderer = new LoopPlaygroundRenderer();
  private readonly frameListeners: FrameListener[] = [];

  public async init(host: HTMLElement): Promise<HTMLCanvasElement> {
    await this.app.init({
      resizeTo: host,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      backgroundColor: GAMEPLAY_COLORS.void,
    });

    await this.renderer.loadAssets();

    host.appendChild(this.app.canvas);
    this.renderer.attach(this.app.stage);
    this.app.ticker.add(this.tick);
    return this.app.canvas;
  }

  public async loadDeferredAssets(): Promise<void> {
    await this.renderer.loadDeferredAssets();
  }

  public viewSize(): ViewSize {
    return {
      width: this.app.screen.width,
      height: this.app.screen.height,
    };
  }

  public addFrameListener(listener: FrameListener): void {
    this.frameListeners.push(listener);
  }

  public render(state: PlaygroundRenderState): void {
    this.renderer.render(state);
  }

  public async captureViewport(): Promise<string | null> {
    return this.app.renderer.extract.base64({
      target: this.app.stage,
      frame: new Rectangle(
        0,
        0,
        this.app.screen.width,
        this.app.screen.height,
      ),
    });
  }

  public destroy(): void {
    this.app.ticker.remove(this.tick);
    this.app.destroy(true, { children: true });
  }

  private readonly tick = (ticker: Ticker): void => {
    const deltaSeconds = ticker.deltaMS / 1000;
    for (const listener of this.frameListeners) {
      listener(deltaSeconds);
    }
  };
}

export function createPixiRendererHost(): RendererHost {
  return new PixiRendererHost();
}
