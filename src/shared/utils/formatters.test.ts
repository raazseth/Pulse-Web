import { describe, it, expect } from "vitest";
import { formatClock } from "./formatters";

describe("formatClock", () => {
  it("returns a non-empty string for a valid ISO timestamp", () => {
    const result = formatClock("2024-06-15T12:34:56.000Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes colon-separated time components", () => {
    const result = formatClock("2024-01-01T09:05:03.000Z");
    expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  it("produces different results for timestamps 12 hours apart", () => {
    const morning = formatClock("2024-01-01T00:00:00.000Z");
    const afternoon = formatClock("2024-01-01T12:00:00.000Z");
    expect(morning).not.toBe(afternoon);
  });

  it("produces the same result for equal timestamps", () => {
    const ts = "2024-03-20T15:45:30.000Z";
    expect(formatClock(ts)).toBe(formatClock(ts));
  });

  it("returns '--:--:--' for an invalid timestamp string", () => {
    expect(formatClock("not-a-date")).toBe("--:--:--");
    expect(formatClock("")).toBe("--:--:--");
  });
});
