import type { TranscriptTag } from "@/modules/tagging/types";

                                                                                         
export function transcriptLineHasCatalogTag(
  tags: TranscriptTag[],
  transcriptId: string,
  catalogTagId: string,
): boolean {
  return tags.some((t) => t.transcriptId === transcriptId && t.tagId === catalogTagId);
}
