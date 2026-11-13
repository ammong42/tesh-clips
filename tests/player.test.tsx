// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import YouTubeEmbed from "../src/components/YouTubeEmbed";
import { A, B } from "./fixtures";
import { MockPlayer, mockApiLoader } from "./playerMock";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  MockPlayer.instances = [];
});
describe("player lifecycle failures", () => {
  it("times out a player that never becomes ready", async () => {
    vi.useFakeTimers();
    const noReady = async () => ({
        Player: class {
          seekTo() {}
          playVideo() {}
          destroy() {}
        },
      }),
      availability = vi.fn();
    render(
      <YouTubeEmbed
        videoId={A}
        title="Synthetic timeout fixture"
        onCanReplay={availability}
        apiLoader={noReady}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(15001);
    });
    expect(screen.getByText(/taking too long/)).toBeInTheDocument();
    expect(availability).toHaveBeenLastCalledWith(false);
  });
  it("destroys previous player on clip change and ignores its late callbacks", async () => {
    const ready = vi.fn(),
      view = render(
        <YouTubeEmbed
          videoId={A}
          title="Synthetic first"
          onCanReplay={ready}
          apiLoader={mockApiLoader}
        />,
      );
    await act(async () => {
      await Promise.resolve();
    });
    const first = MockPlayer.instances.at(-1)!;
    view.rerender(
      <YouTubeEmbed
        videoId={B}
        title="Synthetic second"
        onCanReplay={ready}
        apiLoader={mockApiLoader}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(first.destroy).toHaveBeenCalledOnce();
    act(() => first.options.events.onError({ data: 150 }));
    expect(screen.queryByText(/owner does not allow/)).not.toBeInTheDocument();
    expect(
      screen.getByTitle("YouTube video: Synthetic second"),
    ).toBeInTheDocument();
  });
});
describe("official API script loader", () => {
  afterEach(() => {
    document
      .querySelectorAll('script[src="https://www.youtube.com/iframe_api"]')
      .forEach((s) => s.remove());
    delete window.YT;
    delete window.onYouTubeIframeAPIReady;
  });
  it("loads a single script for concurrent consumers and resolves only when the API is ready", async () => {
    vi.resetModules();
    const { loadYouTubeAPI } = await import("../src/lib/youtubePlayer"),
      first = loadYouTubeAPI();
    expect(loadYouTubeAPI()).toBe(first);
    expect(
      document.querySelectorAll(
        'script[src="https://www.youtube.com/iframe_api"]',
      ),
    ).toHaveLength(1);
    window.YT = { Player: MockPlayer };
    window.onYouTubeIframeAPIReady!();
    expect(await first).toBe(window.YT);
  });
  it("rejects network/script failures and supports a fresh retry", async () => {
    vi.resetModules();
    const { loadYouTubeAPI } = await import("../src/lib/youtubePlayer"),
      first = loadYouTubeAPI(),
      rejected = expect(first).rejects.toThrow(/could not load/);
    document
      .querySelector('script[src="https://www.youtube.com/iframe_api"]')!
      .dispatchEvent(new Event("error"));
    await rejected;
    const retry = loadYouTubeAPI();
    expect(retry).not.toBe(first);
    window.YT = { Player: MockPlayer };
    window.onYouTubeIframeAPIReady!();
    await expect(retry).resolves.toBe(window.YT);
  });
});
