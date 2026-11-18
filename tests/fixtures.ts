import { PLAYLIST_ID, type Catalog, type Clip } from "../src/lib/catalog";
import type { StorageLike } from "../src/lib/storage";
export function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
// SYNTHETIC TEST FIXTURES ONLY. Not verified YouTube IDs or John Tesh metadata.
export const fixtureClip = (id: string, change: Partial<Clip> = {}): Clip => ({
  id,
  title: `Synthetic test clip ${id}`,
  description: "Synthetic metadata for automated tests only.",
  channelTitle: "Synthetic test channel",
  thumbnailUrl: null,
  durationSeconds: 65,
  position: 0,
  categories: ["sleep"],
  embeddable: true,
  ...change,
});
export const fixtureCatalog = (clips: Clip[] = []): Catalog => ({
  schemaVersion: 1,
  playlistId: PLAYLIST_ID,
  importedAt: "2026-10-30T00:00:00.000Z",
  classifierVersion: "keywords-v2",
  clips,
});
export const A = "TEST_SLEEP1",
  B = "TEST_BRAIN1",
  C = "TEST_EXER01";
