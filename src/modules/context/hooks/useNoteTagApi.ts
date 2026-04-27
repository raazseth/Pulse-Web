import { useCallback } from "react";
import { fetchWithAuth } from "@/shared/utils/fetchWithAuth";
import { getHudNoteTagsUrl, getHudNoteTagUrl } from "@/shared/utils/hudApi";
import { isServerNote } from "./useNoteApi";

interface UseNoteTagApiOptions {
  sessionId: string;
  accessToken: string | null;
  refreshAccessToken: () => Promise<string | null>;
}

export function useNoteTagApi({ sessionId, accessToken, refreshAccessToken }: UseNoteTagApiOptions) {
  const getToken = useCallback(() => accessToken, [accessToken]);

  const addTagToNote = useCallback(
    async (noteId: string, tagId: string): Promise<void> => {
      if (!isServerNote(noteId) || !isServerNote(tagId)) return;
      const res = await fetchWithAuth(
        getHudNoteTagsUrl(sessionId, noteId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId }),
        },
        getToken,
        refreshAccessToken,
      );
      if (!res.ok) throw new Error(`Add tag to note failed (${res.status})`);
    },
    [sessionId, getToken, refreshAccessToken],
  );

  const removeTagFromNote = useCallback(
    async (noteId: string, tagId: string): Promise<void> => {
      if (!isServerNote(noteId) || !isServerNote(tagId)) return;
      const res = await fetchWithAuth(
        getHudNoteTagUrl(sessionId, noteId, tagId),
        { method: "DELETE" },
        getToken,
        refreshAccessToken,
      );
      if (!res.ok) throw new Error(`Remove tag from note failed (${res.status})`);
    },
    [sessionId, getToken, refreshAccessToken],
  );

  return { addTagToNote, removeTagFromNote };
}
