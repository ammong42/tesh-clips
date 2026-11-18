// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import {
  A,
  B,
  C,
  fixtureCatalog,
  fixtureClip,
  memoryStorage,
} from "./fixtures";
import {
  FAVORITES_KEY,
  QUEUES_KEY,
  favoritesValue,
  toggleFavorite,
} from "../src/lib/storage";
import { MockPlayer, mockApiLoader } from "./playerMock";
const testCatalog = fixtureCatalog([
  fixtureClip(A, { title: "Synthetic sleep one" }),
  fixtureClip(B, {
    title: "Synthetic sleep two",
    categories: ["sleep", "brain-health"],
  }),
  fixtureClip(C, { title: "Synthetic exercise tip", categories: ["exercise"] }),
  fixtureClip("TEST_LONG01", {
    title: "Synthetic longevity idea",
    categories: ["longevity"],
  }),
  fixtureClip("TEST_FOOD01", {
    title: "Synthetic food idea",
    categories: ["food"],
  }),
  fixtureClip("TEST_TRANS1", {
    title: "Synthetic Transformation Tuesdays idea",
    categories: ["transformation-tuesdays"],
  }),
  fixtureClip("TEST_OTHER1", {
    title: "Synthetic unmatched idea",
    categories: ["uncategorized"],
  }),
]);
const loadCatalog = async () => testCatalog,
  latest = () => MockPlayer.instances.at(-1)!;
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  MockPlayer.instances = [];
});
afterEach(cleanup);
describe("app interactions with synthetic catalog and a mocked YouTube API", () => {
  it("offers six topics and a separate full-collection Surprise Me selection", async () => {
    render(
      <App
        loadCatalog={loadCatalog}
        storage={memoryStorage()}
        apiLoader={mockApiLoader}
      />,
    );
    await screen.findByRole("button", { name: /\bSleep\b/ });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /\bFood\b/ })).toBeEnabled(),
    );
    for (const name of [
      "Sleep",
      "Brain Health",
      "Longevity",
      "Exercise",
      "Food",
      "Transformation Tuesdays",
      "Surprise Me",
    ])
      expect(
        screen.getByRole("button", { name: new RegExp(name) }),
      ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Finance" }),
    ).not.toBeInTheDocument();
    expect(
      screen
        .getByRole("button", { name: /\bSurprise Me\b/ })
        .closest(".category-grid"),
    ).toBeNull();
    expect(screen.getByText("All topics")).toBeInTheDocument();
  });
  it("draws, saves, replays, ends, plays another and opens saved without consuming a deck; restores on reload", async () => {
    const storage = memoryStorage(),
      user = userEvent.setup(),
      mount = () =>
        render(
          <App
            loadCatalog={loadCatalog}
            storage={storage}
            apiLoader={mockApiLoader}
          />,
        ),
      view = mount();
    await user.click(await screen.findByRole("button", { name: /\bSleep\b/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Replay" })).toBeEnabled(),
    );
    const first = latest(),
      drawnQueue = storage.getItem(QUEUES_KEY);
    await user.click(screen.getByRole("button", { name: "Save Clip" }));
    expect(screen.getByRole("button", { name: "Saved" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(first.destroy).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Replay" }));
    expect(first.seekTo).toHaveBeenCalledWith(0, true);
    expect(first.playVideo).toHaveBeenCalledTimes(1);
    expect(storage.getItem(QUEUES_KEY)).toBe(drawnQueue);
    act(() => first.options.events.onStateChange({ data: 0 }));
    expect(screen.getByText(/That’s a little wisdom/)).toBeInTheDocument();
    expect(storage.getItem(QUEUES_KEY)).toBe(drawnQueue);
    await user.click(screen.getByRole("button", { name: "Play Another" }));
    await waitFor(() => expect(latest()).not.toBe(first));
    expect(latest().options.videoId).not.toBe(first.options.videoId);
    expect(first.destroy).toHaveBeenCalledTimes(1);
    const afterAnother = storage.getItem(QUEUES_KEY);
    await user.click(screen.getByRole("button", { name: /Saved Clips/ }));
    await user.click(
      screen.getByRole("button", {
        name: new RegExp(
          `^${testCatalog.clips.find((c) => c.id === first.options.videoId)!.title}`,
        ),
      }),
    );
    await waitFor(() =>
      expect(latest().options.videoId).toBe(first.options.videoId),
    );
    expect(storage.getItem(QUEUES_KEY)).toBe(afterAnother);
    expect(
      screen.getByRole("button", { name: "Back to Saved Clips" }),
    ).toBeInTheDocument();
    view.unmount();
    mount();
    await screen.findByRole("button", { name: "Saved" });
    expect(storage.getItem(QUEUES_KEY)).toBe(afterAnother);
    await user.click(screen.getByRole("button", { name: "Saved" }));
    expect(JSON.parse(storage.getItem(FAVORITES_KEY)!).favorites).toEqual([]);
  });
  it("handles player errors, blocked autoplay and retry with recovery links", async () => {
    const user = userEvent.setup();
    render(
      <App
        loadCatalog={loadCatalog}
        storage={memoryStorage()}
        apiLoader={mockApiLoader}
      />,
    );
    await user.click(
      await screen.findByRole("button", {
        name: /\bBrain Health\b/,
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Replay" })).toBeEnabled(),
    );
    act(() => latest().options.events.onAutoplayBlocked());
    expect(
      screen.getByText(/Your browser paused autoplay/),
    ).toBeInTheDocument();
    act(() => latest().options.events.onError({ data: 150 }));
    expect(screen.getByText(/owner does not allow/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replay" })).toBeDisabled();
    expect(
      screen.getByRole("link", { name: /Open on YouTube/ }),
    ).toHaveAttribute("href", `https://www.youtube.com/watch?v=${B}`);
    const old = latest();
    await user.click(screen.getByRole("button", { name: "Retry player" }));
    await waitFor(() => expect(latest()).not.toBe(old));
    expect(old.destroy).toHaveBeenCalled();
    expect(latest().options.videoId).toBe(B);
  });
  it("shows honest empty states, disabled topic controls and empty saved view", async () => {
    const user = userEvent.setup();
    render(
      <App
        loadCatalog={async () => fixtureCatalog()}
        storage={memoryStorage()}
      />,
    );
    expect(
      await screen.findByText("Good things are on their way."),
    ).toBeInTheDocument();
    const buttons = screen
      .getAllByRole("button")
      .filter((b) => b.classList.contains("category-card"));
    expect(buttons).toHaveLength(6);
    expect(
      screen.getByRole("button", { name: /\bSurprise Me\b/ }),
    ).toBeDisabled();
    for (const button of buttons) expect(button).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Saved Clips/ }));
    expect(screen.getByText("A place for your favorites.")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Explore the topics" }),
    );
    expect(
      screen.getByRole("heading", { name: /A moment for you/ }),
    ).toHaveFocus();
  });
  it("retains missing favorites with their title snapshots and explicit removal", async () => {
    const storage = memoryStorage();
    storage.setItem(
      FAVORITES_KEY,
      JSON.stringify(
        favoritesValue(
          toggleFavorite([], { id: A, title: "Synthetic missing favorite" }),
        ),
      ),
    );
    const user = userEvent.setup();
    render(
      <App loadCatalog={async () => fixtureCatalog()} storage={storage} />,
    );
    await user.click(screen.getByRole("button", { name: /Saved Clips/ }));
    await user.click(
      await screen.findByRole("button", {
        name: /^Synthetic missing favorite/,
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Synthetic missing favorite" }),
    ).toBeInTheDocument();
    expect(JSON.parse(storage.getItem(FAVORITES_KEY)!).favorites).toHaveLength(
      1,
    );
    expect(storage.getItem(QUEUES_KEY)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Remove saved clip" }));
    expect(JSON.parse(storage.getItem(FAVORITES_KEY)!).favorites).toEqual([]);
  });
  it("recovers a retired Finance playback URL and saved clip before the user reimports", async () => {
    const storage = memoryStorage();
    const favorites = toggleFavorite([], {
      id: A,
      title: "Synthetic legacy favorite",
    });
    storage.setItem(FAVORITES_KEY, JSON.stringify(favoritesValue(favorites)));
    window.history.replaceState(null, "", `/#view=play&id=${A}&pool=finance`);
    const legacy = {
      ...fixtureCatalog(),
      classifierVersion: "keywords-v1",
      clips: [{ ...fixtureClip(A), categories: ["finance"] }],
    };
    render(
      <App
        loadCatalog={async () => legacy}
        storage={storage}
        apiLoader={mockApiLoader}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Replay" })).toBeEnabled(),
    );
    expect(screen.getByText("Surprise Me")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saved" })).toBeInTheDocument();
    expect(storage.getItem(QUEUES_KEY)).toBeNull();
    expect(JSON.parse(storage.getItem(FAVORITES_KEY)!).favorites).toEqual(
      favorites,
    );
    expect(screen.queryByText("Finance")).not.toBeInTheDocument();
  });
  it("recovers from malformed catalog and invalid direct playback routes", async () => {
    window.history.replaceState(null, "", "/#view=play&id=bad");
    render(
      <App
        loadCatalog={async () => ({ bad: true })}
        storage={memoryStorage()}
      />,
    );
    expect(
      await screen.findByRole("heading", {
        name: "This clip isn’t in the collection",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/collection couldn’t load/)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Open on YouTube/ }),
    ).not.toBeInTheDocument();
  });
  it("keeps working in memory when browser storage is unavailable", async () => {
    const user = userEvent.setup();
    render(
      <App
        loadCatalog={loadCatalog}
        storage={null}
        apiLoader={mockApiLoader}
      />,
    );
    expect(
      screen.getByText(/Device storage is unavailable/),
    ).toBeInTheDocument();
    await user.click(
      await screen.findByRole("button", {
        name: /\bExercise\b/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Save Clip" }));
    expect(screen.getByRole("button", { name: "Saved" })).toBeInTheDocument();
  });
  it("recreates the player for a one-item pool and announces the new cycle", async () => {
    const user = userEvent.setup();
    render(
      <App
        loadCatalog={loadCatalog}
        storage={memoryStorage()}
        apiLoader={mockApiLoader}
      />,
    );
    await user.click(
      await screen.findByRole("button", {
        name: /\bExercise\b/,
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Replay" })).toBeEnabled(),
    );
    const old = latest();
    await user.click(screen.getByRole("button", { name: "Play Another" }));
    await waitFor(() => expect(latest()).not.toBe(old));
    expect(latest().options.videoId).toBe(C);
    expect(
      screen.getAllByText(/freshly shuffled round/).length,
    ).toBeGreaterThan(0);
  });
  it("shows catalog loading and API load errors rather than blank controls", async () => {
    const user = userEvent.setup(),
      failedApi = vi.fn(async () => {
        throw new Error("Unavailable");
      });
    render(
      <App
        loadCatalog={loadCatalog}
        storage={memoryStorage()}
        apiLoader={failedApi}
      />,
    );
    expect(screen.getByText("Gathering a little wisdom…")).toBeInTheDocument();
    await user.click(
      await screen.findByRole("button", {
        name: /\bSurprise Me\b/,
      }),
    );
    expect(
      await screen.findByText(/YouTube could not load/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replay" })).toBeDisabled();
  });
});
