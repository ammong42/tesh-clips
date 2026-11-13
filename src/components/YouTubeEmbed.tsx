import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  loadYouTubeAPI,
  playerError,
  type YouTubeAPI,
  type YouTubePlayer,
} from "../lib/youtubePlayer";
export interface PlayerHandle {
  replay(): void;
}
export interface EmbedProps {
  videoId: string;
  title: string;
  onCanReplay: (ready: boolean) => void;
  apiLoader?: () => Promise<YouTubeAPI>;
}
type State = "loading" | "ready" | "ended" | "blocked" | "error";
const YouTubeEmbed = forwardRef<PlayerHandle, EmbedProps>(function YouTubeEmbed(
  { videoId, title, onCanReplay, apiLoader = loadYouTubeAPI },
  ref,
) {
  const mount = useRef<HTMLDivElement>(null),
    instance = useRef<YouTubePlayer | null>(null),
    ready = useRef(false);
  const [state, setState] = useState<State>("loading"),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useImperativeHandle(
    ref,
    () => ({
      replay() {
        if (!ready.current || !instance.current) return;
        try {
          instance.current.seekTo(0, true);
          instance.current.playVideo();
          setState("ready");
        } catch {
          setState("error");
          setError(
            "YouTube could not replay this clip. Try loading the player again.",
          );
          onCanReplay(false);
        }
      },
    }),
    [onCanReplay],
  );
  useEffect(() => {
    let disposed = false,
      player: YouTubePlayer | null = null,
      timer: ReturnType<typeof setTimeout> | undefined;
    ready.current = false;
    onCanReplay(false);
    setState("loading");
    setError("");
    const fail = (message: string) => {
      if (disposed) return;
      ready.current = false;
      onCanReplay(false);
      setError(message);
      setState("error");
      clearTimeout(timer);
    };
    apiLoader()
      .then((api) => {
        if (disposed || !mount.current) return;
        const target = document.createElement("div");
        mount.current.replaceChildren(target);
        timer = setTimeout(
          () =>
            fail(
              "YouTube is taking too long to respond. Check your connection or open the clip on YouTube.",
            ),
          15000,
        );
        player = new api.Player(target, {
          videoId,
          width: "100%",
          height: "100%",
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            origin: window.location.origin,
            playsinline: 1,
            controls: 1,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              if (disposed) return;
              clearTimeout(timer);
              instance.current = event.target;
              ready.current = true;
              const iframe = event.target.getIframe?.();
              if (iframe) {
                iframe.title = `YouTube video: ${title}`;
                iframe.referrerPolicy = "strict-origin-when-cross-origin";
              }
              setState("ready");
              onCanReplay(true);
            },
            onStateChange: (event) => {
              if (!disposed) {
                if (event.data === 0) setState("ended");
                else if (event.data === 1) setState("ready");
              }
            },
            onError: (event) => fail(playerError(event.data)),
            onAutoplayBlocked: () => {
              if (!disposed) setState("blocked");
            },
          },
        });
        instance.current = player;
      })
      .catch(() =>
        fail(
          "YouTube could not load. Check your connection or content blocker, or open the clip on YouTube.",
        ),
      );
    return () => {
      disposed = true;
      clearTimeout(timer);
      ready.current = false;
      instance.current = null;
      try {
        player?.destroy();
      } catch {
        /* Already removed. */
      }
    };
  }, [videoId, title, attempt, apiLoader, onCanReplay]);
  return (
    <section className="player-section" aria-label="Video player">
      <div className="player-frame" aria-busy={state === "loading"}>
        <div ref={mount} className="youtube-mount" />
      </div>
      <div
        className={`player-message ${state === "error" ? "is-error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {state === "loading" && (
          <>
            <span className="loading-dot" />
            Loading the YouTube player…
          </>
        )}
        {state === "ready" &&
          "Press play in the YouTube player. Take a moment for yourself."}
        {state === "ended" &&
          "That’s a little wisdom to take with you. Replay it or try another clip."}
        {state === "blocked" &&
          "Your browser paused autoplay. Press play in the visible YouTube player."}
        {state === "error" && (
          <>
            <span>{error} You can choose Play Another below.</span>
            <button
              className="text-button"
              onClick={() => setAttempt((a) => a + 1)}
            >
              Retry player
            </button>
          </>
        )}
      </div>
    </section>
  );
});
export default YouTubeEmbed;
