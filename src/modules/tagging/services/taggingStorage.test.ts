import { describe, it, expect } from "vitest";
import { defaultTagOptions } from "./taggingStorage";

describe("defaultTagOptions", () => {
  it("has exactly 6 entries", () => {
    expect(defaultTagOptions).toHaveLength(6);
  });

  it("contains the expected tag ids", () => {
    const ids = defaultTagOptions.map((t) => t.id);
    expect(ids).toContain("insight");
    expect(ids).toContain("follow-up");
    expect(ids).toContain("risk");
    expect(ids).toContain("quote");
    expect(ids).toContain("frustration");
    expect(ids).toContain("delight");
  });

  it("each tag has a non-empty label", () => {
    for (const tag of defaultTagOptions) {
      expect(tag.label.length).toBeGreaterThan(0);
    }
  });

  it("each tag has a valid MUI color value", () => {
    const validColors = ["default", "primary", "secondary", "success", "warning", "error", "info"];
    for (const tag of defaultTagOptions) {
      expect(validColors).toContain(tag.color);
    }
  });

  it("all ids are unique", () => {
    const ids = defaultTagOptions.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each tag has shortLabel and shortcutDigit for UI", () => {
    for (const tag of defaultTagOptions) {
      expect(tag.shortLabel?.length).toBeGreaterThan(0);
      expect(tag.shortcutDigit?.length).toBeGreaterThan(0);
    }
  });
});
