import { useCallback, useMemo } from "react";
import { fetchWithAuth } from "@/shared/utils/fetchWithAuth";
import { getHudNotesUrl, getHudNoteUrl } from "@/shared/utils/hudApi";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

                                                                         
export const isServerNote = (id: string) => UUID_RE.test(id);

interface UseNoteApiOptions {
  sessionId: string;
  accessToken: string | null;
  refreshAccessToken: () => Promise<string | null>;
}

export function useNoteApi({ sessionId, accessToken, refreshAccessToken }: UseNoteApiOptions) {
  const getToken = useCallback(() => accessToken, [accessToken]);

  const createNote = useCallback(
    async (body: string, transcriptId?: string): Promise<{ id: string; body: string }> => {
      if (!sessionId) throw new Error("Cannot create note without a session");
      const res = await fetchWithAuth(
        getHudNotesUrl(sessionId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, ...(transcriptId && { transcriptId }) }),
        },
        getToken,
        refreshAccessToken,
      );
      if (!res.ok) throw new Error(`Create note failed (${res.status})`);
      const json = await res.json() as { data?: { id: string; body: string } };
      return json.data!;
    },
    [sessionId, getToken, refreshAccessToken],
  );

  const updateNote = useCallback(
    async (noteId: string, body: string): Promise<void> => {
      if (!sessionId) return;
      if (!isServerNote(noteId)) return;
      const res = await fetchWithAuth(
        getHudNoteUrl(sessionId, noteId),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        },
        getToken,
        refreshAccessToken,
      );
      if (!res.ok) throw new Error(`Update note failed (${res.status})`);
    },
    [sessionId, getToken, refreshAccessToken],
  );

  const deleteNote = useCallback(
    async (noteId: string): Promise<void> => {
      if (!sessionId) return;
      if (!isServerNote(noteId)) return;
      const res = await fetchWithAuth(
        getHudNoteUrl(sessionId, noteId),
        { method: "DELETE" },
        getToken,
        refreshAccessToken,
      );
      if (!res.ok) throw new Error(`Delete note failed (${res.status})`);
    },
    [sessionId, getToken, refreshAccessToken],
  );

  const listNotes = useCallback(
    async (overrideSessionId?: string): Promise<Array<{ id: string; label?: string; body: string; linkedTagIds?: string[] }>> => {
      const sid = overrideSessionId ?? sessionId;
      if (!sid) return [];
      const res = await fetchWithAuth(getHudNotesUrl(sid), {}, getToken, refreshAccessToken);
      if (!res.ok) throw new Error(`List notes failed (${res.status})`);
      const json = await res.json() as { data?: Array<{ id: string; label?: string; body: string; linkedTagIds?: string[] }> };
      return json.data ?? [];
    },
    [sessionId, getToken, refreshAccessToken],
  );

  return useMemo(
    () => ({ createNote, updateNote, deleteNote, listNotes }),
    [createNote, updateNote, deleteNote, listNotes],
  );
}
