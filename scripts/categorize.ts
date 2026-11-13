import {
  isCategory,
  isRecord,
  TOPICS,
  VIDEO_ID,
  type Category,
  type Topic,
} from "../src/lib/catalog";
export const CLASSIFIER_VERSION = "keywords-v1";
// Whole words/phrases once per field: title=2, description=1; phrases doubled; threshold=2.
export const KEYWORDS: Record<Topic, string[]> = {
  sleep: [
    "sleep",
    "sleeping",
    "bedtime",
    "circadian",
    "insomnia",
    "nap",
    "napping",
    "restful",
    "sleep quality",
    "fall asleep",
  ],
  "brain-health": [
    "brain",
    "memory",
    "cognition",
    "cognitive",
    "focus",
    "learning",
    "neuroscience",
    "mental sharpness",
    "concentration",
    "dementia",
  ],
  finance: [
    "money",
    "budget",
    "budgeting",
    "finances",
    "financial",
    "spending",
    "saving money",
    "personal finance",
    "debt",
    "retirement",
    "investing",
  ],
};
const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function classify(title: string, description: string): Category[] {
  const t = ` ${normalize(title)} `,
    d = ` ${normalize(description)} `;
  const categories = TOPICS.filter(
    (topic) =>
      KEYWORDS[topic].reduce((score, phrase) => {
        const needle = ` ${phrase} `,
          weight = phrase.includes(" ") ? 2 : 1;
        return (
          score +
          weight * ((t.includes(needle) ? 2 : 0) + (d.includes(needle) ? 1 : 0))
        );
      }, 0) >= 2,
  );
  return categories.length ? categories : ["uncategorized"];
}
export type Overrides = Record<string, Category[]>;
export function parseOverrides(input: unknown): Overrides {
  if (!isRecord(input))
    throw new Error("Category overrides must be an object keyed by video ID.");
  const result: Overrides = {};
  for (const [id, categories] of Object.entries(input)) {
    if (
      !VIDEO_ID.test(id) ||
      !Array.isArray(categories) ||
      !categories.length ||
      !categories.every(isCategory) ||
      (categories.includes("uncategorized") &&
        categories.some((c) => c !== "uncategorized"))
    )
      throw new Error(
        "Invalid category override: use an 11-character ID and nonempty topic labels, or uncategorized alone.",
      );
    result[id] = [...new Set(categories)];
  }
  return result;
}
export function categorize(
  id: string,
  title: string,
  description: string,
  overrides: Overrides,
): Category[] {
  return overrides[id] ? [...overrides[id]] : classify(title, description);
}
