import { describe, it, expect } from "vitest";
import { classify, categorize, parseOverrides } from "../scripts/categorize";
import { A } from "./fixtures";
describe("deterministic metadata classifier", () => {
  it.each([
    ["Better SLEEP!", "", ["sleep"]],
    ["Improve your memory", "", ["brain-health"]],
    ["A money tip", "", ["finance"]],
    ["Sleep, memory & saving money", "", ["sleep", "brain-health", "finance"]],
    ["A new idea", "Improve your mental sharpness", ["brain-health"]],
    ["Learning together", "sleep bedtime", ["sleep", "brain-health"]],
    ["Unmatched title", "nothing topical here", ["uncategorized"]],
    ["Oversleeping moneybags", "", ["uncategorized"]],
  ])("classifies %s", (title, description, expected) =>
    expect(classify(title, description)).toEqual(expected),
  );
  it("does not duplicate category labels or count repeated weak keywords", () => {
    expect(classify("Sleep sleep bedtime", "sleep sleep")).toEqual(["sleep"]);
    expect(classify("", "money money money")).toEqual(["uncategorized"]);
  });
  it("overrides replace automatic tags and deduplicate", () => {
    const overrides = parseOverrides({ [A]: ["finance", "finance"] });
    expect(categorize(A, "Sleep", "memory", overrides)).toEqual(["finance"]);
    expect(() => parseOverrides({ [A]: ["surprise-me"] })).toThrow();
    expect(() => parseOverrides({ [A]: ["uncategorized", "sleep"] })).toThrow();
    expect(() => parseOverrides({ bad: ["sleep"] })).toThrow();
  });
});
