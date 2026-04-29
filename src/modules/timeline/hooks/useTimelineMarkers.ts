import { useMemo } from "react";
import { TranscriptTag } from "@/modules/tagging/types";
import { TranscriptItem, TranscriptSignalCue } from "@/modules/transcript/types";
import { isIntervieweeSpeaker } from "@/modules/transcript/utils/interviewRoles";
import { PromptSuggestion } from "@/modules/prompts/types";
import { TimelineMarker } from "@/modules/timeline/types";

interface UseTimelineMarkersOptions {
  prompts: PromptSuggestion[];
  tags: TranscriptTag[];
  transcripts: TranscriptItem[];
  signals: TranscriptSignalCue[];
}

const SIGNAL_LABELS: Record<TranscriptSignalCue["kind"], string> = {
  silence: "Lexical",
  "sentiment-shift": "Lexical",
  keyword: "Lexical",
};

function promptTimelineItemId(
  prompt: PromptSuggestion,
  transcripts: TranscriptItem[],
): string | undefined {
  const ids = prompt.transcriptIds?.length
    ? prompt.transcriptIds
    : prompt.transcriptId
      ? [prompt.transcriptId]
      : [];
  for (let i = ids.length - 1; i >= 0; i--) {
    const id = ids[i];
    const row = transcripts.find((t) => t.id === id);
    if (row && isIntervieweeSpeaker(row.speakerId)) return id;
  }
  return ids[ids.length - 1];
}



const TIMELINE_LIMITS = {
  transcripts: 16,
  tags: 12,
  prompts: 8,
  signals: 8,
} as const;

export function useTimelineMarkers({
  prompts,
  tags,
  transcripts,
  signals,
}: UseTimelineMarkersOptions) {
  return useMemo<TimelineMarker[]>(
    () => [
      ...transcripts.slice(-TIMELINE_LIMITS.transcripts).map((item) => ({
        id: `transcript-${item.id}`,
        itemId: item.id,
        kind: "transcript" as const,
        label: item.speakerId,
        timestamp: item.timestamp,
      })),
      ...tags.slice(-TIMELINE_LIMITS.tags).map((tag) => ({
        id: tag.id,
        itemId: tag.transcriptId,
        kind: "tag" as const,
        label: tag.tagId,
        timestamp: tag.timestamp,
      })),
      ...prompts.slice(-TIMELINE_LIMITS.prompts).map((prompt) => ({
        id: prompt.id,
        itemId: promptTimelineItemId(prompt, transcripts),
        kind: "prompt" as const,
        label: prompt.title,
        timestamp: prompt.timestamp,
      })),
      ...signals.slice(-TIMELINE_LIMITS.signals).map((signal) => ({
        id: signal.id,
        itemId: signal.transcriptId,
        kind: "signal" as const,
        label: signal.label,
        timestamp: signal.timestamp,
      })),
    ].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    ),
    [prompts, tags, transcripts, signals],
  );
}
