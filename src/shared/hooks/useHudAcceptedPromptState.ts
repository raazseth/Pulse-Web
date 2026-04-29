import { useCallback, useEffect, useState } from "react";
import type { PromptSuggestion } from "@/modules/prompts/types";
import type { AcceptedMsg } from "@/shared/components/HudSuggestionsTab";

export function useHudAcceptedPromptState(
  sessionId: string | undefined,
  onPromptUse?: (promptId: string) => void,
  onPromptDismiss?: (promptId: string) => void,
) {
  const [acceptedMessages, setAcceptedMessages] = useState<AcceptedMsg[]>([]);
  const [dismissedPromptIds, setDismissedPromptIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setAcceptedMessages([]);
    setDismissedPromptIds(new Set());
  }, [sessionId]);

  const handleHudPromptAccept = useCallback(
    (prompt: PromptSuggestion) => {
      setAcceptedMessages((prev) => [
        ...prev,
        {
          id: `accepted-${prompt.id}`,
          text: prompt.body || prompt.title,
          title: prompt.title,
          timestamp: prompt.timestamp,
          origin: prompt.suggestionOrigin ?? "local",
          transcriptId: prompt.transcriptId,
          transcriptIds: prompt.transcriptIds,
        },
      ]);
      setDismissedPromptIds((prev) => new Set([...prev, prompt.id]));
      onPromptUse?.(prompt.id);
    },
    [onPromptUse],
  );

  const handleHudPromptDismissId = useCallback(
    (id: string) => {
      setDismissedPromptIds((prev) => new Set([...prev, id]));
      onPromptDismiss?.(id);
    },
    [onPromptDismiss],
  );

  return {
    acceptedMessages,
    dismissedPromptIds,
    handleHudPromptAccept,
    handleHudPromptDismissId,
  };
}
