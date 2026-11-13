export const PLAYLIST_ID = "PLPwjiJlz-ZBY";
export const TOPICS = ["sleep", "brain-health", "finance"] as const;
export type Topic = (typeof TOPICS)[number];
export type Category = Topic | "uncategorized";
export type Pool = Topic | "surprise-me";
export const POOLS: Pool[] = [...TOPICS, "surprise-me"];
export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export interface Clip {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  position: number;
  categories: Category[];
  embeddable: boolean;
}
export interface Catalog {
  schemaVersion: 1;
  playlistId: string;
  importedAt: string | null;
  classifierVersion: string;
  clips: Clip[];
}
export const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
export const isCategory = (x: unknown): x is Category =>
  [...TOPICS, "uncategorized"].includes(x as Category);
const validDate = (x: unknown): x is string =>
  typeof x === "string" && Number.isFinite(Date.parse(x));
export function parseCatalog(value: unknown): Catalog {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.playlistId !== PLAYLIST_ID ||
    !(value.importedAt === null || validDate(value.importedAt)) ||
    typeof value.classifierVersion !== "string" ||
    !Array.isArray(value.clips)
  )
    throw new Error(
      "The clip catalog is unavailable or has an unsupported format.",
    );
  const ids = new Set<string>();
  for (const clip of value.clips) {
    if (
      !isRecord(clip) ||
      typeof clip.id !== "string" ||
      !VIDEO_ID.test(clip.id) ||
      ids.has(clip.id) ||
      typeof clip.title !== "string" ||
      !clip.title.trim() ||
      typeof clip.description !== "string" ||
      typeof clip.channelTitle !== "string" ||
      !(
        clip.thumbnailUrl === null ||
        (typeof clip.thumbnailUrl === "string" &&
          /^https:\/\//.test(clip.thumbnailUrl))
      ) ||
      !(
        clip.durationSeconds === null ||
        (typeof clip.durationSeconds === "number" &&
          Number.isFinite(clip.durationSeconds) &&
          clip.durationSeconds >= 0)
      ) ||
      !Number.isInteger(clip.position) ||
      (clip.position as number) < 0 ||
      typeof clip.embeddable !== "boolean" ||
      !Array.isArray(clip.categories) ||
      !clip.categories.length ||
      !clip.categories.every(isCategory) ||
      new Set(clip.categories).size !== clip.categories.length ||
      (clip.categories.includes("uncategorized") && clip.categories.length > 1)
    )
      throw new Error(
        "The clip catalog contains an invalid or duplicate entry. Re-run the local import.",
      );
    ids.add(clip.id);
  }
  return value as unknown as Catalog;
}
export function eligibleIds(catalog: Catalog, pool: Pool): string[] {
  return catalog.clips
    .filter(
      (c) =>
        c.embeddable && (pool === "surprise-me" || c.categories.includes(pool)),
    )
    .map((c) => c.id);
}
