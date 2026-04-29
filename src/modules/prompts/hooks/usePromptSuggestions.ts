import { useMemo } from "react";
import { TranscriptItem, TranscriptSocketPrompt } from "@/modules/transcript/types";
import { derivePromptSuggestions } from "@/modules/prompts/services/promptDerivation";
import { PromptSuggestion } from "@/modules/prompts/types";

function alignPromptTimes(prompt: PromptSuggestion, items: TranscriptItem[]): PromptSuggestion {
  const ids = prompt.transcriptIds?.length
    ? prompt.transcriptIds
    : prompt.transcriptId
      ? [prompt.transcriptId]
      : [];
  if (!ids.length) return prompt;
  const refs = ids
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is TranscriptItem => Boolean(i));
  if (!refs.length) return prompt;
  const anchor = refs.reduce((a, b) => (a.timestamp >= b.timestamp ? a : b));
  return {
    ...prompt,
    timestamp: anchor.timestamp,
    transcriptTimeLabel: anchor.formattedTime,
  };
}

function mapRemotePrompt(prompt: TranscriptSocketPrompt): PromptSuggestion {
  const origin = prompt.suggestionOrigin === "model" ? "model" : "local";
  const ids = (prompt.transcriptIds ?? []).filter(Boolean);
  return {
    id: prompt.id,
    sessionId: prompt.sessionId,
    title: prompt.title,
    body: prompt.text,
    transcriptId: ids[ids.length - 1],
    transcriptIds: ids.length ? ids : undefined,
    timestamp: prompt.timestamp,
    suggestionOrigin: origin,
  };
}

export function usePromptSuggestions(
  items: TranscriptItem[],
  remotePrompts: TranscriptSocketPrompt[],
) {
  const prompts = useMemo(() => {
    const base = remotePrompts.length
      ? remotePrompts.map(mapRemotePrompt)
      : derivePromptSuggestions(items);
    if (!items.length) return base;
    return base.map((p) => alignPromptTimes(p, items));
  }, [items, remotePrompts]);

  return { prompts };
}
