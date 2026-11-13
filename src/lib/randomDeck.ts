import type { Pool } from "./catalog";
export interface Deck {
  known: string[];
  remaining: string[];
  last: string | null;
}
export type Queues = Partial<Record<Pool, Deck>>;
export type RNG = () => number;
export function shuffle<T>(values: readonly T[], rng: RNG = Math.random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const random = rng();
    if (!Number.isFinite(random) || random < 0 || random >= 1)
      throw new Error("RNG must return a number in [0, 1).");
    const j = Math.floor(random * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function reconcileDeck(
  previous: Deck | undefined,
  eligible: readonly string[],
  rng: RNG = Math.random,
): Deck {
  const ids = [...new Set(eligible)],
    allowed = new Set(ids),
    known = new Set(previous?.known ?? []);
  const remaining = [...new Set(previous?.remaining ?? [])].filter((id) =>
    allowed.has(id),
  );
  const added = shuffle(
    ids.filter((id) => !known.has(id) && !remaining.includes(id)),
    rng,
  );
  return {
    known: ids,
    remaining: [...remaining, ...added],
    last: previous?.last ?? null,
  };
}
export function draw(
  queues: Queues,
  pool: Pool,
  eligible: readonly string[],
  rng: RNG = Math.random,
): { id: string | null; queues: Queues; newCycle: boolean } {
  const deck = reconcileDeck(queues[pool], eligible, rng);
  if (!deck.known.length)
    return { id: null, queues: { ...queues, [pool]: deck }, newCycle: false };
  let newCycle = false;
  if (!deck.remaining.length) {
    newCycle = true;
    deck.remaining = shuffle(deck.known, rng);
    if (deck.remaining.length > 1 && deck.remaining[0] === deck.last) {
      const swap = 1 + Math.floor(rng() * (deck.remaining.length - 1));
      [deck.remaining[0], deck.remaining[swap]] = [
        deck.remaining[swap],
        deck.remaining[0],
      ];
    }
  }
  const id = deck.remaining.shift()!;
  deck.last = id;
  return { id, queues: { ...queues, [pool]: deck }, newCycle };
}
