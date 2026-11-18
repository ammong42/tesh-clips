import { describe, it, expect } from "vitest";
import {
  classify,
  categorize,
  parseOverrides,
  CLASSIFIER_VERSION,
} from "../scripts/categorize";
import { A } from "./fixtures";
describe("deterministic metadata classifier", () => {
  it.each([
    ["Better SLEEP!", "", ["sleep"]],
    ["Improve your memory", "", ["brain-health"]],
    ["Healthy aging and longevity", "", ["longevity"]],
    ["A strength-training workout", "", ["exercise"]],
    ["Food, fiber and vegetables", "", ["food"]],
    [
      "Sleep, memory and exercise for longevity",
      "",
      ["sleep", "brain-health", "longevity", "exercise"],
    ],
    [
      "Nutrition and strength training for healthy aging",
      "",
      ["longevity", "exercise", "food"],
    ],
    [
      "Transformation Tuesdays: exercise and nutrition",
      "",
      ["exercise", "food", "transformation-tuesdays"],
    ],
    ["A new idea", "Improve your mental sharpness", ["brain-health"]],
    ["A new idea", "Healthy eating and whole grains", ["food"]],
    ["A new idea", "Learn about physical activity", ["exercise"]],
    ["A new idea", "Ideas for living longer", ["longevity"]],
    ["Learning together", "sleep bedtime", ["sleep", "brain-health"]],
    ["Unmatched title", "nothing topical here", ["uncategorized"]],
    ["Oversleeping moneybags", "", ["uncategorized"]],
    ["Budgeting and saving money", "", ["uncategorized"]],
    ["A transformation in your life", "See you Tuesday", ["uncategorized"]],
    ["Unrelated title", "Transformation Tuesday", ["transformation-tuesdays"]],
    ["Unrelated title", "#TransformationTuesdays", ["transformation-tuesdays"]],
    ["#TransformationTuesday", "", ["transformation-tuesdays"]],
    ["TRANSFORMATION—TUESDAYS!", "", ["transformation-tuesdays"]],
    ["Transformation Tuesdaysish", "", ["uncategorized"]],
  ])("classifies %s", (title, description, expected) =>
    expect(classify(title, description)).toEqual(expected),
  );
  it("does not duplicate labels or count repeated weak keywords", () => {
    expect(classify("Sleep sleep bedtime", "sleep sleep")).toEqual(["sleep"]);
    expect(classify("", "protein protein protein")).toEqual(["uncategorized"]);
    expect(
      classify("Transformation Tuesday and Transformation Tuesdays", ""),
    ).toEqual(["transformation-tuesdays"]);
  });
  it("overrides replace automatic tags, allow multiple categories, and deduplicate", () => {
    const overrides = parseOverrides({ [A]: ["food", "longevity", "food"] });
    expect(categorize(A, "Sleep", "memory", overrides)).toEqual([
      "food",
      "longevity",
    ]);
    expect(() => parseOverrides({ [A]: ["surprise-me"] })).toThrow();
    expect(() => parseOverrides({ [A]: ["uncategorized", "sleep"] })).toThrow();
    expect(() => parseOverrides({ bad: ["sleep"] })).toThrow();
    expect(parseOverrides({ [A]: ["transformation-tuesdays"] })).toEqual({
      [A]: ["transformation-tuesdays"],
    });
  });
  it("rejects retired Finance overrides with instructions instead of silently reinterpreting them", () => {
    expect(() => parseOverrides({ [A]: ["finance"] })).toThrow(
      /Finance was removed/,
    );
  });
  it("versions the changed rules for imported catalogs", () =>
    expect(CLASSIFIER_VERSION).toBe("keywords-v2"));
});
