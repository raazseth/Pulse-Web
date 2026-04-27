import type { TranscriptTag } from "@/modules/tagging/types";

/** True if this transcript line already has a tag for the same catalog id (`tagKey`). */
export function transcriptLineHasCatalogTag(
  tags: TranscriptTag[],
  transcriptId: string,
  catalogTagId: string,
): boolean {
  return tags.some((t) => t.transcriptId === transcriptId && t.tagId === catalogTagId);
}
