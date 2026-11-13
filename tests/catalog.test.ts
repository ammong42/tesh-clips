import { describe, expect, it } from "vitest";
import raw from "../data/clips.json";
import { parseCatalog } from "../src/lib/catalog";
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
});
