import { describe, expect, it } from "vitest";
import raw from "../data/clips.json";
import { parseCatalog, TOPICS, eligibleIds } from "../src/lib/catalog";
import { A, B, fixtureCatalog, fixtureClip } from "./fixtures";
describe("catalog boundary", () => {
  it("ships a schema-valid catalog (empty until a real import succeeds)", () => {
    expect(parseCatalog(raw).playlistId).toBe("PLPwjiJlz-ZBY");
    if (raw.importedAt === null) expect(raw.clips).toEqual([]);
  });
  it.each([null, {}, { ...raw, schemaVersion: 2 }, { ...raw, clips: [{}] }])(
    "rejects malformed catalogs",
    (input) => {
      expect(() => parseCatalog(input)).toThrow();
    },
  );
  it("accepts all six topic tags together and keeps Surprise Me as a selection mode", () => {
    const catalog = parseCatalog(
      fixtureCatalog([fixtureClip(A, { categories: [...TOPICS] })]),
    );
    for (const pool of [...TOPICS, "surprise-me"] as const)
      expect(eligibleIds(catalog, pool)).toEqual([A]);
    expect(() =>
      parseCatalog({
        ...catalog,
        clips: [{ ...catalog.clips[0], categories: ["surprise-me"] }],
      }),
    ).toThrow();
  });
  it("keeps legacy Finance clips playable until refresh without mutating the original catalog", () => {
    const legacy = {
      ...fixtureCatalog(),
      classifierVersion: "keywords-v1",
      clips: [
        { ...fixtureClip(A), categories: ["finance"] },
        { ...fixtureClip(B), categories: ["sleep", "finance"] },
      ],
    };
    const parsed = parseCatalog(legacy);
    expect(parsed.clips.map((c) => c.categories)).toEqual([
      ["uncategorized"],
      ["sleep"],
    ]);
    expect(eligibleIds(parsed, "surprise-me")).toEqual([A, B]);
    expect(eligibleIds(parsed, "sleep")).toEqual([B]);
    expect(legacy.clips[0].categories).toEqual(["finance"]);
    expect(() =>
      parseCatalog({
        ...legacy,
        clips: [{ ...legacy.clips[0], categories: ["invented-topic"] }],
      }),
    ).toThrow();
  });
});
