export interface YouTubePlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  destroy(): void;
  getIframe?(): HTMLIFrameElement;
}
export interface PlayerOptions {
  videoId: string;
  width: string;
  height: string;
  host: string;
  playerVars: {
    origin: string;
    playsinline: number;
    controls: number;
    rel: number;
  };
  events: {
    onReady: (event: { target: YouTubePlayer }) => void;
    onStateChange: (event: { data: number }) => void;
    onError: (event: { data: number }) => void;
    onAutoplayBlocked: () => void;
  };
}
export interface YouTubeAPI {
  Player: new (container: HTMLElement, options: PlayerOptions) => YouTubePlayer;
}
declare global {
  interface Window {
    YT?: YouTubeAPI;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let apiPromise: Promise<YouTubeAPI> | null = null;
export function loadYouTubeAPI(): Promise<YouTubeAPI> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady,
      script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    const timer = window.setTimeout(() => fail(), 15000);
    const cleanup = () => {
      window.clearTimeout(timer);
      window.onYouTubeIframeAPIReady = previous;
    };
    const fail = () => {
      cleanup();
      script.remove();
      apiPromise = null;
      reject(
        new Error(
          "YouTube could not load. Check your connection or content blocker.",
        ),
      );
    };
    window.onYouTubeIframeAPIReady = () => {
      cleanup();
      try {
        previous?.();
      } catch {
        /* Other embeds must not break this one. */
      }
      if (window.YT?.Player) resolve(window.YT);
      else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return apiPromise;
}
export function playerError(code: number): string {
  if (code === 100) return "This video has been removed or made private.";
  if (code === 101 || code === 150)
    return "The owner does not allow this video to play here.";
  if (code === 153)
    return "YouTube could not verify this player’s origin. Try opening the video on YouTube.";
  if (code === 2) return "YouTube could not recognize this video.";
  if (code === 5) return "Your browser could not play this video.";
  return "YouTube could not play this video. Availability can vary by region, age, or device.";
}
