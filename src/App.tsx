import { useEffect, useRef, useState } from "react";
import {
  parseCatalog,
  eligibleIds,
  POOLS,
  VIDEO_ID,
  type Catalog,
  type Clip,
  type Pool,
} from "./lib/catalog";
import { draw } from "./lib/randomDeck";
import {
  browserStorage,
  loadState,
  persist,
  toggleFavorite,
  favoritesValue,
  queuesValue,
  FAVORITES_KEY,
  QUEUES_KEY,
  STORAGE_WARNING,
  type Favorite,
  type StorageLike,
} from "./lib/storage";
import Icon, { type IconName } from "./components/Icon";
import YouTubeEmbed, { type PlayerHandle } from "./components/YouTubeEmbed";
import type { YouTubeAPI } from "./lib/youtubePlayer";
import "./styles/app.css";
export const categoryInfo: Record<
  Pool,
  {
    title: string;
    tagline: string;
    description: string;
    icon: IconName;
    note: string;
  }
> = {
  sleep: {
    title: "Sleep",
    tagline: "Rest a little easier.",
    description:
      "Wind down with ideas for better nights and brighter mornings.",
    icon: "moon",
    note: "FOR A QUIETER MIND",
  },
  "brain-health": {
    title: "Brain Health",
    tagline: "Keep your mind curious.",
    description:
      "Explore memory, focus, and the little things that help us think.",
    icon: "brain",
    note: "A FRESH PERSPECTIVE",
  },
  finance: {
    title: "Finance",
    tagline: "Make room for what matters.",
    description: "Practical ideas for your money and everyday decisions.",
    icon: "wallet",
    note: "SMALL STEPS, EVERY DAY",
  },
  "surprise-me": {
    title: "Surprise Me",
    tagline: "A little serendipity.",
    description:
      "An unexpected idea from the whole collection. See what finds you.",
    icon: "sparkles",
    note: "LET CURIOSITY LEAD",
  },
};
type View =
  | { page: "home" }
  | { page: "saved" }
  | { page: "play"; id: string; pool: Pool; fromSaved: boolean };
function readView(): View {
  const route = new URLSearchParams(window.location.hash.slice(1));
  if (route.get("view") === "saved") return { page: "saved" };
  if (route.get("view") === "play") {
    const id = route.get("id") ?? "",
      pool = route.get("pool");
    return {
      page: "play",
      id: VIDEO_ID.test(id) ? id : "",
      pool: POOLS.includes(pool as Pool) ? (pool as Pool) : "surprise-me",
      fromSaved: route.get("from") === "saved",
    };
  }
  return { page: "home" };
}
function hashFor(view: View): string {
  if (view.page === "home") return "";
  if (view.page === "saved") return "#view=saved";
  return `#${new URLSearchParams({ view: "play", id: view.id, pool: view.pool, ...(view.fromSaved ? { from: "saved" } : {}) })}`;
}
const defaultLoader = async () => (await import("../data/clips.json")).default;
const duration = (seconds: number | null) =>
  seconds === null
    ? null
    : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export interface AppProps {
  loadCatalog?: () => Promise<unknown>;
  storage?: StorageLike | null;
  apiLoader?: () => Promise<YouTubeAPI>;
}
export default function App({
  loadCatalog = defaultLoader,
  storage,
  apiLoader,
}: AppProps) {
  const [store] = useState(() =>
      storage === undefined ? browserStorage() : storage,
    ),
    [initial] = useState(() => loadState(store));
  const [favorites, setFavorites] = useState(initial.favorites),
    queues = useRef(initial.queues),
    [warning, setWarning] = useState(initial.warning);
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [catalogError, setCatalogError] = useState(""),
    [view, setView] = useState<View>(readView),
    [notice, setNotice] = useState("");
  const [canReplay, setCanReplay] = useState(false),
    [playerVersion, setPlayerVersion] = useState(0),
    player = useRef<PlayerHandle>(null),
    heading = useRef<HTMLHeadingElement>(null),
    moved = useRef(false);
  useEffect(() => {
    let active = true;
    loadCatalog()
      .then((raw) => {
        if (active) setCatalog(parseCatalog(raw));
      })
      .catch(() => {
        if (active)
          setCatalogError(
            "The collection couldn’t load. Please reload the page, or visit your saved clips.",
          );
      });
    return () => {
      active = false;
    };
  }, [loadCatalog]);
  useEffect(() => {
    const change = () => {
      moved.current = true;
      setView(readView());
      setNotice("");
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [view, catalog, catalogError]);
  function navigate(next: View) {
    moved.current = true;
    const hash = hashFor(next);
    if (window.location.hash !== hash)
      window.history.pushState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${hash}`,
      );
    setView(next);
  }
  function select(pool: Pool) {
    if (!catalog) return;
    const result = draw(queues.current, pool, eligibleIds(catalog, pool));
    if (!result.id) {
      setNotice(
        `There are no available ${categoryInfo[pool].title} clips yet. Try another topic.`,
      );
      return;
    }
    queues.current = result.queues;
    if (!persist(store, QUEUES_KEY, queuesValue(result.queues)))
      setWarning(STORAGE_WARNING);
    setCanReplay(false);
    setPlayerVersion((v) => v + 1);
    setNotice(
      result.newCycle
        ? "You’ve explored this whole collection. A freshly shuffled round is ready."
        : "A little wisdom, picked for you.",
    );
    navigate({ page: "play", id: result.id, pool, fromSaved: false });
  }
  function save(clip: { id: string; title: string }) {
    const next = toggleFavorite(favorites, clip),
      saved = next.some((f) => f.id === clip.id);
    setFavorites(next);
    if (!persist(store, FAVORITES_KEY, favoritesValue(next)))
      setWarning(STORAGE_WARNING);
    setNotice(
      saved
        ? "Clip saved to your collection."
        : "Clip removed from your saved collection.",
    );
  }
  function openSaved(favorite: Favorite) {
    setCanReplay(false);
    setNotice("");
    setPlayerVersion((v) => v + 1);
    navigate({
      page: "play",
      id: favorite.id,
      pool: "surprise-me",
      fromSaved: true,
    });
  }
  function home() {
    setNotice("");
    navigate({ page: "home" });
  }
  const clip: Clip | undefined =
    view.page === "play"
      ? catalog?.clips.find((c) => c.id === view.id)
      : undefined;
  const snapshot =
    view.page === "play" ? favorites.find((f) => f.id === view.id) : undefined;
  const favorite = clip ? favorites.some((f) => f.id === clip.id) : !!snapshot,
    playable = catalog?.clips.filter((c) => c.embeddable).length ?? 0,
    isLoading = !catalog && !catalogError;
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <button
          className="brand"
          onClick={home}
          aria-label="A Little Life Wisdom home"
        >
          <span className="brand-mark">
            <Icon name="leaf" />
          </span>
          <span>
            A Little
            <br />
            <strong>Life Wisdom</strong>
          </span>
        </button>
        <nav aria-label="Main navigation">
          <button
            className={`saved-nav ${view.page === "saved" ? "active" : ""}`}
            onClick={() => {
              setNotice("");
              navigate({ page: "saved" });
            }}
          >
            <Icon name="bookmark" />
            <span>Saved Clips</span>
            <span className="count">{favorites.length}</span>
          </button>
        </nav>
      </header>
      {warning && (
        <div className="storage-warning" role="status">
          {warning}
        </div>
      )}
      <main id="main-content" tabIndex={-1}>
        <div
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {notice}
        </div>
        {view.page === "home" && (
          <>
            <section className="hero" aria-labelledby="home-title">
              <span className="eyebrow">
                <span /> SMALL IDEAS. A LITTLE MORE POSSIBILITY.
              </span>
              <h1 id="home-title" tabIndex={-1} ref={heading}>
                A moment for you.
                <br />
                <em>A little wisdom for life.</em>
              </h1>
              <p className="hero-subtitle">
                Discover something useful in just a minute.
              </p>
              <p className="hero-detail">
                Explore ideas from John Tesh’s videos.
                <br className="mobile-break" /> Pick a topic. Find a fresh
                perspective.
              </p>
              <div className="hero-decoration" aria-hidden="true">
                <Icon name="sun" />
                <span className="orbit-one" />
                <span className="orbit-two" />
                <span className="tiny-star">✦</span>
              </div>
            </section>
            <section className="topics" aria-labelledby="topics-title">
              <div className="section-heading">
                <h2 id="topics-title">What’s on your mind?</h2>
                <span>
                  A little inspiration starts here <Icon name="arrow" />
                </span>
              </div>
              <div className="category-grid">
                {POOLS.map((pool) => {
                  const info = categoryInfo[pool],
                    count = catalog ? eligibleIds(catalog, pool).length : 0;
                  return (
                    <button
                      className={`category-card ${pool}`}
                      key={pool}
                      onClick={() => select(pool)}
                      disabled={!count}
                      aria-describedby={`${pool}-availability`}
                    >
                      <span className="card-top">
                        <span className="category-icon">
                          <Icon name={info.icon} />
                        </span>
                        <Icon name="arrow" className="card-arrow" />
                      </span>
                      <span className="card-label">{info.note}</span>
                      <h3>{info.title}</h3>
                      <span className="card-tagline">{info.tagline}</span>
                      <span className="card-description">
                        {info.description}
                      </span>
                      <span
                        className="card-availability"
                        id={`${pool}-availability`}
                      >
                        {isLoading
                          ? "Loading collection…"
                          : count
                            ? `${count} ${count === 1 ? "clip" : "clips"} to explore`
                            : "Clips coming soon"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
            {isLoading && (
              <div className="collection-note" role="status">
                Gathering a little wisdom…
              </div>
            )}
            {catalogError && (
              <div className="collection-note" role="alert">
                <Icon name="leaf" />
                <div>
                  <h2>A pause in the collection</h2>
                  <p>{catalogError}</p>
                  <button
                    className="text-button"
                    onClick={() => window.location.reload()}
                  >
                    Reload collection
                  </button>
                </div>
              </div>
            )}
            {catalog && !playable && (
              <div className="collection-note">
                <Icon name="leaf" />
                <div>
                  <h2>Good things are on their way.</h2>
                  <p>
                    The collection is waiting for its first clips. Come back
                    soon for a little inspiration. Your saved collection is
                    still yours to revisit.
                  </p>
                </div>
              </div>
            )}
            <section className="gentle-note">
              <span className="note-icon">
                <Icon name="heart" />
              </span>
              <div>
                <h2>A small idea can stay with you.</h2>
                <p>
                  Save the clips you love. Come back whenever you need a little
                  inspiration.
                </p>
              </div>
              <span className="local-pill">
                Just for you. Saved on this device.
              </span>
            </section>
          </>
        )}
        {view.page === "play" && (
          <div className="playback-layout">
            <div className="view-topline">
              <button
                className="text-button"
                onClick={
                  view.fromSaved ? () => navigate({ page: "saved" }) : home
                }
              >
                <Icon name="back" />
                {view.fromSaved ? "Back to Saved Clips" : "Back to topics"}
              </button>
              <span className={`topic-pill ${view.pool}`}>
                {view.fromSaved
                  ? "From your saved collection"
                  : categoryInfo[view.pool].title}
              </span>
            </div>
            {isLoading ? (
              <>
                <h1 tabIndex={-1} ref={heading}>
                  A little wisdom is loading…
                </h1>
                <p role="status">Finding your clip.</p>
              </>
            ) : clip?.embeddable ? (
              <>
                <div className="playback-title">
                  <span className="eyebrow">A MOMENT WELL SPENT</span>
                  <h1 tabIndex={-1} ref={heading}>
                    {clip.title}
                  </h1>
                  <p>
                    {clip.channelTitle && <span>{clip.channelTitle}</span>}
                    {duration(clip.durationSeconds) && (
                      <span className="duration">
                        {duration(clip.durationSeconds)}
                      </span>
                    )}
                  </p>
                  <div className="tags">
                    {clip.categories
                      .filter((c) => c !== "uncategorized")
                      .map((c) => (
                        <span key={c}>{categoryInfo[c as Pool].title}</span>
                      ))}
                  </div>
                </div>
                <YouTubeEmbed
                  key={`${clip.id}-${playerVersion}`}
                  ref={player}
                  videoId={clip.id}
                  title={clip.title}
                  onCanReplay={setCanReplay}
                  apiLoader={apiLoader}
                />
                <div className="playback-actions">
                  <button
                    className={`button secondary ${favorite ? "is-saved" : ""}`}
                    aria-pressed={favorite}
                    onClick={() => save(clip)}
                  >
                    <Icon name={favorite ? "check" : "bookmark"} />
                    {favorite ? "Saved" : "Save Clip"}
                  </button>
                  <button
                    className="button secondary"
                    disabled={!canReplay}
                    onClick={() => {
                      player.current?.replay();
                      setNotice("Replaying this clip.");
                    }}
                  >
                    <Icon name="replay" />
                    Replay
                  </button>
                  <button
                    className="button primary next-button"
                    onClick={() => select(view.pool)}
                  >
                    <Icon name="sparkles" />
                    Play Another
                    <Icon name="arrow" />
                  </button>
                </div>
                <div className="playback-foot">
                  <button className="text-button" onClick={home}>
                    Home
                  </button>
                  <a
                    className="text-button"
                    href={`https://www.youtube.com/watch?v=${clip.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open on YouTube
                    <Icon name="external" />
                  </a>
                </div>
                {notice && (
                  <p className="action-note" aria-hidden="true">
                    {notice}
                  </p>
                )}
              </>
            ) : (
              <section className="empty-state">
                <span className="empty-icon">
                  <Icon name="bookmark" />
                </span>
                <h1 tabIndex={-1} ref={heading}>
                  {snapshot?.title ?? "This clip isn’t in the collection"}
                </h1>
                <p>
                  {catalogError ||
                    "This video is no longer available in the current catalog. Your saved clip stays here until you choose to remove it."}
                </p>
                <div className="empty-actions">
                  {VIDEO_ID.test(view.id) && (
                    <a
                      className="button secondary"
                      href={`https://www.youtube.com/watch?v=${view.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open on YouTube
                      <Icon name="external" />
                    </a>
                  )}
                  {snapshot && (
                    <button
                      className="button secondary"
                      onClick={() => save(snapshot)}
                    >
                      Remove saved clip
                    </button>
                  )}
                  {playable > 0 && (
                    <button
                      className="button primary"
                      onClick={() => select(view.pool)}
                    >
                      Play Another
                    </button>
                  )}
                  <button className="text-button" onClick={home}>
                    Home
                    <Icon name="arrow" />
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
        {view.page === "saved" && (
          <section className="saved-page">
            <button className="text-button" onClick={home}>
              <Icon name="back" />
              Back to topics
            </button>
            <div className="saved-heading">
              <span className="eyebrow">THE IDEAS YOU KEEP</span>
              <h1 tabIndex={-1} ref={heading}>
                Your little collection.
              </h1>
              <p>
                {favorites.length
                  ? `${favorites.length} saved ${favorites.length === 1 ? "clip" : "clips"}. A fresh perspective, worth revisiting.`
                  : "Keep a little inspiration close at hand."}
              </p>
            </div>
            {favorites.length ? (
              <ul className="saved-list">
                {favorites.map((f) => {
                  const item = catalog?.clips.find((c) => c.id === f.id);
                  return (
                    <li key={f.id} className="saved-item">
                      <button
                        className="saved-open"
                        onClick={() => openSaved(f)}
                      >
                        <span className="saved-item-icon">
                          <Icon
                            name={
                              item?.categories[0] &&
                              item.categories[0] !== "uncategorized"
                                ? categoryInfo[item.categories[0]].icon
                                : "bookmark"
                            }
                          />
                        </span>
                        <span className="saved-item-copy">
                          <strong>{item?.title ?? f.title}</strong>
                          <span>
                            {isLoading
                              ? "Loading collection…"
                              : !item?.embeddable
                                ? "Not in the current collection · saved for you"
                                : item.categories
                                    .filter((c) => c !== "uncategorized")
                                    .map((c) => categoryInfo[c as Pool].title)
                                    .join(" · ") || "A little discovery"}
                          </span>
                        </span>
                        <Icon name="play" />
                      </button>
                      <button
                        className="remove-saved"
                        aria-label={`Remove ${item?.title ?? f.title} from saved clips`}
                        onClick={() => save(f)}
                      >
                        <Icon name="bookmark" />
                        <span>Remove</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">
                  <Icon name="bookmark" />
                </span>
                <h2>A place for your favorites.</h2>
                <p>
                  When a clip speaks to you, tap Save Clip.
                  <br />
                  You’ll find it right here, ready for another listen.
                </p>
                <button className="button primary" onClick={home}>
                  Explore the topics
                  <Icon name="arrow" />
                </button>
              </div>
            )}
            <p className="privacy-note">
              <Icon name="heart" />
              Saved in this browser, on this device. No account needed.
            </p>
          </section>
        )}
      </main>
      <footer className="site-footer">
        <span className="footer-brand">
          <Icon name="leaf" />A little wiser. A little brighter.
        </span>
        <p>
          Videos sourced from{" "}
          <a
            href="https://www.youtube.com/playlist?list=PLPwjiJlz-ZBY"
            target="_blank"
            rel="noopener noreferrer"
          >
            John Tesh on YouTube
            <Icon name="external" />
          </a>
          .<br />
          An independent prototype. Not affiliated with or endorsed by John
          Tesh.
        </p>
        <span className="footer-privacy">
          Your favorites stay on your device.
          <br />
          YouTube loads when you open a clip.
        </span>
      </footer>
    </div>
  );
}
