import { defaultTagOptions } from "@/modules/tagging/services/taggingStorage";
import type { TranscriptTag } from "@/modules/tagging/types";

export function mapServerHudTagToTranscriptTag(tag: {
  id: string;
  transcriptId?: string;
  label: string;
  createdAt: string;
  metadata?: Record<string, string>;
}): TranscriptTag {
  const catalogId =
    tag.metadata?.tagKey ??
    defaultTagOptions.find((o) => o.label === tag.label)?.id ??
    tag.label;
  return {
    id: tag.id,
    tagId: catalogId,
    transcriptId: tag.transcriptId,
    timestamp: tag.createdAt,
    transcriptLineAt: tag.metadata?.transcriptAt,
    messagePreview: tag.metadata?.transcriptText,
  };
}
