import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTimelineMarkers } from "./useTimelineMarkers";
import type { TranscriptItem, TranscriptSignalCue } from "@/modules/transcript/types";
import type { PromptSuggestion } from "@/modules/prompts/types";
import type { TranscriptTag } from "@/modules/tagging/types";

function makeTranscript(id: string, timestamp: string): TranscriptItem {
  return { id, text: "some text", timestamp, speakerId: "Alice", formattedTime: timestamp };
}

function makeTag(id: string, timestamp: string): TranscriptTag {
  return { id, tagId: "insight", timestamp };
}

function makePrompt(id: string, timestamp: string): PromptSuggestion {
  return { id, title: "Clarify", body: "text", timestamp };
}

function makeSignal(id: string, timestamp: string): TranscriptSignalCue {
  return {
    id,
    sessionId: "sess-1",
    kind: "keyword",
    label: "blocker detected",
    timestamp,
  };
}

const EMPTY = { prompts: [], tags: [], transcripts: [], signals: [] };

describe("useTimelineMarkers", () => {
  it("returns an empty array when all inputs are empty", () => {
    const { result } = renderHook(() => useTimelineMarkers(EMPTY));
    expect(result.current).toEqual([]);
  });

  it("maps transcript items to kind='transcript' markers", () => {
    const transcripts = [makeTranscript("t1", "2024-01-01T00:00:00.000Z")];
    const { result } = renderHook(() =>
      useTimelineMarkers({ ...EMPTY, transcripts }),
    );
    expect(result.current[0].kind).toBe("transcript");
    expect(result.current[0].id).toBe("transcript-t1");
    expect(result.current[0].label).toBe("Alice");
  });

  it("maps tags to kind='tag' markers", () => {
    const tags = [makeTag("tag-1", "2024-01-01T00:01:00.000Z")];
    const { result } = renderHook(() => useTimelineMarkers({ ...EMPTY, tags }));
    expect(result.current[0].kind).toBe("tag");
    expect(result.current[0].id).toBe("tag-1");
    expect(result.current[0].label).toBe("insight");
  });

  it("maps prompts to kind='prompt' markers", () => {
    const prompts = [makePrompt("pr-1", "2024-01-01T00:02:00.000Z")];
    const { result } = renderHook(() => useTimelineMarkers({ ...EMPTY, prompts }));
    expect(result.current[0].kind).toBe("prompt");
    expect(result.current[0].label).toBe("Clarify");
  });

  it("maps signals to kind='signal' markers using server signal label", () => {
    const signals = [makeSignal("sig-1", "2024-01-01T00:03:00.000Z")];
    const { result } = renderHook(() =>
      useTimelineMarkers({ ...EMPTY, signals }),
    );
    expect(result.current[0].kind).toBe("signal");
    expect(result.current[0].label).toBe("blocker detected");
  });

  it("sorts all markers by timestamp ascending", () => {
    const transcripts = [
      makeTranscript("t-late", "2024-01-01T00:10:00.000Z"),
      makeTranscript("t-early", "2024-01-01T00:01:00.000Z"),
    ];
    const tags = [makeTag("tag-mid", "2024-01-01T00:05:00.000Z")];

    const { result } = renderHook(() =>
      useTimelineMarkers({ ...EMPTY, transcripts, tags }),
    );

    const timestamps = result.current.map((m) => m.timestamp);
    const sorted = [...timestamps].sort();
    expect(timestamps).toEqual(sorted);
  });

  it("limits transcripts to the last 16", () => {
    const transcripts = Array.from({ length: 20 }, (_, i) =>
      makeTranscript(`t${i}`, `2024-01-01T00:${String(i).padStart(2, "0")}:00.000Z`),
    );
    const { result } = renderHook(() =>
      useTimelineMarkers({ ...EMPTY, transcripts }),
    );
    const transcriptMarkers = result.current.filter((m) => m.kind === "transcript");
    expect(transcriptMarkers).toHaveLength(16);
  });

  it("limits prompts to the last 8", () => {
    const prompts = Array.from({ length: 12 }, (_, i) =>
      makePrompt(`pr${i}`, `2024-01-01T00:${String(i).padStart(2, "0")}:00.000Z`),
    );
    const { result } = renderHook(() =>
      useTimelineMarkers({ ...EMPTY, prompts }),
    );
    const promptMarkers = result.current.filter((m) => m.kind === "prompt");
    expect(promptMarkers).toHaveLength(8);
  });

  it("uses signal label for silence cues", () => {
    const signals = [{ ...makeSignal("s1", "2024-01-01T00:00:00.000Z"), kind: "silence" as const, label: "pause detected" }];
    const { result } = renderHook(() => useTimelineMarkers({ ...EMPTY, signals }));
    expect(result.current[0].label).toBe("pause detected");
  });

  it("uses signal label for sentiment-shift cues", () => {
    const signals = [{ ...makeSignal("s2", "2024-01-01T00:00:00.000Z"), kind: "sentiment-shift" as const, label: "emotion spike" }];
    const { result } = renderHook(() => useTimelineMarkers({ ...EMPTY, signals }));
    expect(result.current[0].label).toBe("emotion spike");
  });
});
