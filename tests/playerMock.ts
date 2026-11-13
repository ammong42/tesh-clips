import { vi } from "vitest";
import type {
  YouTubeAPI,
  PlayerOptions,
  YouTubePlayer,
} from "../src/lib/youtubePlayer";
// Test double only; not shipped or evidence of live playback.
export class MockPlayer implements YouTubePlayer {
  static instances: MockPlayer[] = [];
  seekTo = vi.fn();
  playVideo = vi.fn();
  destroy = vi.fn(() => this.iframe.remove());
  iframe: HTMLIFrameElement;
  constructor(
    target: HTMLElement,
    public options: PlayerOptions,
  ) {
    this.iframe = document.createElement("iframe");
    this.iframe.title = "Synthetic test player";
    target.replaceWith(this.iframe);
    MockPlayer.instances.push(this);
    queueMicrotask(() => options.events.onReady({ target: this }));
  }
  getIframe() {
    return this.iframe;
  }
}
export const mockApiLoader = async (): Promise<YouTubeAPI> => ({
  Player: MockPlayer,
});
