import { isRecord, POOLS, VIDEO_ID } from "./catalog";
import type { Deck, Queues } from "./randomDeck";
export const FAVORITES_KEY = "life-wisdom:favorites:v1",
  QUEUES_KEY = "life-wisdom:queues:v1";
export interface Favorite {
  id: string;
  title: string;
  savedAt: string;
}
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const STORAGE_WARNING =
  "Device storage is unavailable or could not be read. You can keep using the site, but some saves and listening history may only last for this visit.";
export function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const isIdList = (x: unknown): x is string[] =>
  Array.isArray(x) &&
  x.every((id) => typeof id === "string" && VIDEO_ID.test(id)) &&
  new Set(x).size === x.length;
export function parseFavorites(input: unknown): Favorite[] {
  if (
    !isRecord(input) ||
    input.schemaVersion !== 1 ||
    !Array.isArray(input.favorites)
  )
    throw new Error("Unsupported favorites format.");
  const ids = new Set<string>();
  return input.favorites.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      !VIDEO_ID.test(item.id) ||
      ids.has(item.id) ||
      typeof item.title !== "string" ||
      !item.title.trim() ||
      typeof item.savedAt !== "string" ||
      !Number.isFinite(Date.parse(item.savedAt))
    )
      throw new Error("Invalid favorite.");
    ids.add(item.id);
    return { id: item.id, title: item.title, savedAt: item.savedAt };
  });
}
export function parseQueues(input: unknown): Queues {
  if (!isRecord(input) || input.schemaVersion !== 1 || !isRecord(input.pools))
    throw new Error("Unsupported queue format.");
  const queues: Queues = {};
  for (const pool of POOLS) {
    const deck = input.pools[pool];
    if (deck === undefined) continue;
    if (
      !isRecord(deck) ||
      !isIdList(deck.known) ||
      !isIdList(deck.remaining) ||
      !deck.remaining.every((id) => (deck.known as string[]).includes(id)) ||
      !(
        deck.last === null ||
        (typeof deck.last === "string" && VIDEO_ID.test(deck.last))
      )
    )
      throw new Error("Invalid random deck.");
    queues[pool] = {
      known: [...deck.known],
      remaining: [...deck.remaining],
      last: deck.last,
    } as Deck;
  }
  return queues;
}
export function loadState(storage: StorageLike | null): {
  favorites: Favorite[];
  queues: Queues;
  warning: string | null;
} {
  let warning: string | null = storage ? null : STORAGE_WARNING;
  function read<T>(key: string, parse: (x: unknown) => T, fallback: T): T {
    if (!storage) return fallback;
    try {
      const value = storage.getItem(key);
      return value === null ? fallback : parse(JSON.parse(value));
    } catch {
      warning = STORAGE_WARNING;
      return fallback;
    }
  }
  const favorites = read(FAVORITES_KEY, parseFavorites, []),
    queues = read(QUEUES_KEY, parseQueues, {});
  return { favorites, queues, warning };
}
export function persist(
  storage: StorageLike | null,
  key: string,
  value: unknown,
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export const favoritesValue = (favorites: Favorite[]) => ({
  schemaVersion: 1,
  favorites,
});
export const queuesValue = (pools: Queues) => ({ schemaVersion: 1, pools });
export function toggleFavorite(
  favorites: readonly Favorite[],
  clip: { id: string; title: string },
  now = new Date(),
): Favorite[] {
  return favorites.some((f) => f.id === clip.id)
    ? favorites.filter((f) => f.id !== clip.id)
    : [
        { id: clip.id, title: clip.title, savedAt: now.toISOString() },
        ...favorites,
      ];
}
