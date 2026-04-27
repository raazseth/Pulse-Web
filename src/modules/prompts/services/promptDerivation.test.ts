import { describe, it, expect } from "vitest";
import { derivePromptSuggestions } from "./promptDerivation";
import type { TranscriptItem } from "@/modules/transcript/types";

function makeItem(overrides: Partial<TranscriptItem> = {}): TranscriptItem {
  return {
    id: "item-1",
    text: "neutral text with no keywords",
    timestamp: "2024-01-01T00:00:00.000Z",
    speakerId: "speaker-1",
    formattedTime: "12:00:00 AM",
    ...overrides,
  };
}

describe("derivePromptSuggestions", () => {
  it("returns an empty array for empty input", () => {
    expect(derivePromptSuggestions([])).toEqual([]);
  });

  it("pads with fallbacks when nothing matches rules", () => {
    const items = [makeItem({ text: "the weather is nice today" })];
    const results = derivePromptSuggestions(items);
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0].title).toMatch(/^Ask /);
    expect(results.every((r) => r.transcriptTimeLabel)).toBe(true);
  });

  it("matches 'unclear' -> Clarify uncertainty", () => {
    const items = [makeItem({ text: "It is unclear what they meant" })];
    const results = derivePromptSuggestions(items);
    expect(results[0].title).toBe("Clarify uncertainty");
  });

  it("matches 'why' (case-insensitive) -> Probe the reasoning", () => {
    const items = [makeItem({ text: "WHY did you choose that approach?" })];
    const results = derivePromptSuggestions(items);
    expect(results[0].title).toBe("Probe the reasoning");
  });

  it("matches 'next step' -> Capture the action", () => {
    const items = [makeItem({ id: "b1", text: "What is the next step from here?" })];
    const results = derivePromptSuggestions(items);
    expect(results[0].title).toBe("Capture the action");
    expect(results[0].transcriptId).toBe("b1");
  });

  it("matches 'risk' -> Surface the blocker", () => {
    const items = [makeItem({ id: "c1", text: "There is a risk here we should address" })];
    const results = derivePromptSuggestions(items);
    expect(results[0].title).toBe("Surface the blocker");
    expect(results[0].transcriptId).toBe("c1");
  });

  it("applies at most one rule per transcript line", () => {
    const items = [makeItem({ text: "question about the risk" })];
    const results = derivePromptSuggestions(items);
    const ruleTitles = results.filter((r) => !r.id.includes("-fallback-")).map((r) => r.title);
    expect(ruleTitles).toEqual(["Surface the blocker"]);
  });

  it("caps output at 4 results even with many keyword matches", () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      makeItem({
        id: `item-${i}`,
        text: "next step on the risk",
        timestamp: `2024-01-${String((i % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
        formattedTime: `${i % 24}:00:00 AM`,
      }),
    );
    const results = derivePromptSuggestions(items);
    expect(results.length).toBeLessThanOrEqual(4);
  });

  it("only considers the last 10 items for rule scanning", () => {
    const items = [
      makeItem({ id: "excluded", text: "why did this happen" }),
      ...Array.from({ length: 12 }, (_, i) =>
        makeItem({ id: `item-${i}`, text: "neutral content" }),
      ),
    ];
    const results = derivePromptSuggestions(items);
    expect(results.every((r) => r.transcriptId !== "excluded")).toBe(true);
  });

  it("generates suggestion ids as item-id + title for rule hits", () => {
    const items = [makeItem({ id: "xyz-99", text: "because we chose speed" })];
    const results = derivePromptSuggestions(items);
    expect(results[0].id).toBe("xyz-99-Probe the reasoning");
  });

  it("returns results with most recent match first (reversed order)", () => {
    const items = [
      makeItem({ id: "older", text: "what is the risk", timestamp: "2024-01-01T00:00:00.000Z" }),
      makeItem({
        id: "newer",
        text: "follow up on next step",
        timestamp: "2024-01-02T00:00:00.000Z",
        formattedTime: "01:00:00 AM",
      }),
    ];
    const results = derivePromptSuggestions(items);
    expect(results[0].transcriptId).toBe("newer");
  });

  it("stagger fallback prompts across recent lines when possible", () => {
    const items = [
      makeItem({
        id: "a",
        text: "hello",
        timestamp: "2024-01-01T10:00:00.000Z",
        formattedTime: "10:00:00 AM",
      }),
      makeItem({
        id: "b",
        text: "world",
        timestamp: "2024-01-01T11:00:00.000Z",
        formattedTime: "11:00:00 AM",
      }),
    ];
    const results = derivePromptSuggestions(items);
    const fallbacks = results.filter((r) => r.id.includes("-fallback-"));
    expect(fallbacks.length).toBeGreaterThanOrEqual(2);
    const labels = fallbacks.map((r) => r.transcriptTimeLabel);
    expect(new Set(labels).size).toBeGreaterThan(1);
  });
});
