import { describe, it, expect } from "vitest";
import { A, B, memoryStorage } from "./fixtures";
import {
  FAVORITES_KEY,
  QUEUES_KEY,
  favoritesValue,
  queuesValue,
  loadState,
  parseFavorites,
  parseQueues,
  persist,
  toggleFavorite,
} from "../src/lib/storage";
import { draw } from "../src/lib/randomDeck";
describe("versioned local persistence", () => {
  it("persists favorites and queues independently, including catalog-missing favorites", () => {
    const storage = memoryStorage(),
      favorites = toggleFavorite([], { id: A, title: "Synthetic saved title" }),
      { queues } = draw({}, "sleep", [A, B], () => 0.5);
    expect(persist(storage, FAVORITES_KEY, favoritesValue(favorites))).toBe(
      true,
    );
    expect(persist(storage, QUEUES_KEY, queuesValue(queues))).toBe(true);
    expect(loadState(storage)).toEqual({ favorites, queues, warning: null });
    expect(
      toggleFavorite(favorites, { id: A, title: "Synthetic saved title" }),
    ).toEqual([]);
    expect(loadState(storage).queues).toEqual(queues);
  });
  it("tolerates absent, corrupt, old schema and denied storage", () => {
    const storage = memoryStorage();
    expect(loadState(storage)).toEqual({
      favorites: [],
      queues: {},
      warning: null,
    });
    storage.setItem(FAVORITES_KEY, "{bad json");
    storage.setItem(
      QUEUES_KEY,
      JSON.stringify({ schemaVersion: 5, pools: {} }),
    );
    expect(loadState(storage).warning).toBeTruthy();
    expect(loadState(null).warning).toBeTruthy();
    const denied = {
      getItem() {
        throw new Error("SecurityError");
      },
      setItem() {
        throw new Error("QuotaExceeded");
      },
    };
    expect(loadState(denied).favorites).toEqual([]);
    expect(persist(denied, FAVORITES_KEY, {})).toBe(false);
    expect(persist(null, FAVORITES_KEY, {})).toBe(false);
  });
  it("does not clear valid favorites when queues are malformed", () => {
    const storage = memoryStorage(),
      favorites = toggleFavorite([], { id: A, title: "Synthetic saved title" });
    storage.setItem(FAVORITES_KEY, JSON.stringify(favoritesValue(favorites)));
    storage.setItem(QUEUES_KEY, "null");
    expect(loadState(storage).favorites).toEqual(favorites);
    expect(loadState(storage).warning).toBeTruthy();
  });
  it("ignores retired Finance queues while retaining existing history and favorites", () => {
    const storage = memoryStorage(),
      favorite = toggleFavorite([], { id: A, title: "Legacy saved clip" });
    const sleep = { known: [A, B], remaining: [B], last: A };
    const surprise = { known: [A, B], remaining: [A], last: B };
    storage.setItem(FAVORITES_KEY, JSON.stringify(favoritesValue(favorite)));
    storage.setItem(
      QUEUES_KEY,
      JSON.stringify({
        schemaVersion: 1,
        pools: {
          sleep,
          "surprise-me": surprise,
          finance: { known: [A], remaining: [], last: A },
        },
      }),
    );
    const loaded = loadState(storage);
    expect(loaded).toEqual({
      favorites: favorite,
      queues: { sleep, "surprise-me": surprise },
      warning: null,
    });
    const next = draw(loaded.queues, "longevity", [A, B], () => 0.5);
    expect(next.id).not.toBeNull();
    expect(next.queues.sleep).toEqual(sleep);
    expect(next.queues["surprise-me"]).toEqual(surprise);
  });
  it("rejects duplicate/invalid IDs, unsupported schema, and impossible queue membership", () => {
    const f = { id: A, title: "Title", savedAt: "2026-10-30" };
    for (const input of [
      null,
      { schemaVersion: 1, favorites: [{ ...f, id: "bad" }] },
      { schemaVersion: 1, favorites: [f, f] },
      { schemaVersion: 1, favorites: [{ ...f, savedAt: "bad" }] },
    ])
      expect(() => parseFavorites(input)).toThrow();
    for (const deck of [
      { known: [A], remaining: [B], last: null },
      { known: [A, A], remaining: [A], last: null },
      { known: [A], remaining: [A, A], last: null },
    ])
      expect(() =>
        parseQueues({ schemaVersion: 1, pools: { sleep: deck } }),
      ).toThrow();
  });
});
