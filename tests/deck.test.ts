import { describe, it, expect } from "vitest";
import {
  draw,
  reconcileDeck,
  shuffle,
  type Queues,
} from "../src/lib/randomDeck";
import { eligibleIds } from "../src/lib/catalog";
import { A, B, C, fixtureCatalog, fixtureClip } from "./fixtures";
describe("independent shuffled decks", () => {
  it("draws all IDs before repeating, avoids a boundary repeat, and does not mutate input", () => {
    let queues: Queues = {};
    const drawn: string[] = [];
    for (let i = 0; i < 12; i++) {
      const before = structuredClone(queues),
        result = draw(queues, "sleep", [A, B, C], () => 0.4);
      expect(queues).toEqual(before);
      drawn.push(result.id!);
      queues = result.queues;
    }
    for (let i = 0; i < 12; i += 3) {
      expect(new Set(drawn.slice(i, i + 3)).size).toBe(3);
      if (i) expect(drawn[i]).not.toBe(drawn[i - 1]);
    }
  });
  it("handles zero and one eligible clip", () => {
    expect(draw({}, "sleep", [], () => 0).id).toBeNull();
    const first = draw({}, "sleep", [A]),
      next = draw(first.queues, "sleep", [A]);
    expect([first.id, next.id]).toEqual([A, A]);
    expect(next.newCycle).toBe(true);
  });
  it("does not consume other pools; serialized reload continues the same deck", () => {
    const first = draw({}, "sleep", [A, B, C], () => 0.8),
      other = draw(first.queues, "finance", [A, C], () => 0);
    expect(other.queues.sleep).toEqual(first.queues.sleep);
    const reload = JSON.parse(JSON.stringify(other.queues)) as Queues,
      second = draw(reload, "sleep", [A, B, C], () => 0.8);
    expect(second.id).not.toBe(first.id);
    expect(second.queues.finance).toEqual(other.queues.finance);
  });
  it("reconciles removed IDs and appends new IDs without restoring drawn IDs", () => {
    const deck = { known: [A, B, C], remaining: [B, C, C], last: A },
      updated = reconcileDeck(deck, [A, C, "TEST_NEW001"], () => 0);
    expect(updated.remaining).toEqual([C, "TEST_NEW001"]);
    expect(updated.last).toBe(A);
    expect(reconcileDeck(updated, [A, C, "TEST_NEW001"], () => 0)).toEqual(
      updated,
    );
  });
  it("gives newly eligible clips a turn even when the old catalog was exhausted", () => {
    const result = draw(
      { sleep: { known: [A, B], remaining: [], last: B } },
      "sleep",
      [A, B, C],
    );
    expect(result.id).toBe(C);
    expect(result.newCycle).toBe(false);
  });
  it("uses every playable clip in Surprise Me, including uncategorized, and topic pools separately", () => {
    const catalog = fixtureCatalog([
      fixtureClip(A),
      fixtureClip(B, { categories: ["uncategorized"] }),
      fixtureClip(C, { embeddable: false }),
    ]);
    expect(eligibleIds(catalog, "surprise-me")).toEqual([A, B]);
    expect(eligibleIds(catalog, "sleep")).toEqual([A]);
  });
  it("implements Fisher-Yates with an injected RNG", () => {
    expect(shuffle([A, B, C], () => 0)).toEqual([B, C, A]);
    expect(() => shuffle([A, B], () => 1)).toThrow();
  });
});
