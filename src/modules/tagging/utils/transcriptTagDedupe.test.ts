import { describe, it, expect } from "vitest";
import { transcriptLineHasCatalogTag } from "./transcriptTagDedupe";
import type { TranscriptTag } from "@/modules/tagging/types";

const tags: TranscriptTag[] = [
  {
    id: "t1",
    tagId: "insight",
    transcriptId: "line-a",
    timestamp: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "t2",
    tagId: "risk",
    transcriptId: "line-a",
    timestamp: "2024-01-01T00:01:00.000Z",
  },
  {
    id: "t3",
    tagId: "insight",
    transcriptId: "line-b",
    timestamp: "2024-01-01T00:02:00.000Z",
  },
];

describe("transcriptLineHasCatalogTag", () => {
  it("returns true when line already has that catalog tag", () => {
    expect(transcriptLineHasCatalogTag(tags, "line-a", "insight")).toBe(true);
  });

  it("returns false when same catalog tag is on another line", () => {
    expect(transcriptLineHasCatalogTag(tags, "line-a", "insight")).toBe(true);
    expect(transcriptLineHasCatalogTag(tags, "line-c", "insight")).toBe(false);
  });

  it("returns false when line has other tags but not this catalog id", () => {
    expect(transcriptLineHasCatalogTag(tags, "line-a", "quote")).toBe(false);
  });
});
