import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { defaultTagOptions } from "@/modules/tagging/services/taggingStorage";
import { TagOption, TranscriptTag } from "@/modules/tagging/types";
import { SessionSnapshot } from "@/shared/types/session";
import { SessionMetadata, SessionNote, SessionStatus, SessionStoreState } from "@/modules/context/types";

interface SessionStoreValue extends SessionStoreState {
  availableTags: TagOption[];
  focusTag: (tagId: string) => void;
  selectTranscript: (transcriptId?: string) => void;
  setSessionId: (sessionId: string) => void;
  setSessionStatus: (status: SessionStatus) => void;
  setTags: (tags: TranscriptTag[]) => void;
  upsertTag: (tag: TranscriptTag) => void;
  updateMetadata: (patch: Partial<SessionMetadata>) => void;
  updateNotes: (notes: SessionNote[]) => void;
  addNote: (note: SessionNote) => void;
  removeNote: (noteId: string) => void;
  updateNoteTags: (noteId: string, tagId: string, linked: boolean) => void;
}

const SESSION_STORAGE_KEY = "pulse-hud-session";

const defaultState: SessionStoreState = {
  sessionId: crypto.randomUUID(),
  sessionStatus: "active",
  metadata: {
    title: "Foundations Study Session",
    facilitator: "Host Team",
    audience: "Core cohort",
    role: "",
  },
  notes: [
    { id: "note-1", label: "Study goals", body: "What are the key research questions for this session?" },
    { id: "note-2", label: "Interview structure", body: "Warm-up → Core topics → Follow-up → Wrap." },
    { id: "note-3", label: "Past notes", body: "Add recurring themes or prior findings here." },
  ],
  tags: [],
  focusedTagId: defaultTagOptions[0].id,
};

const SessionStoreContext = createContext<SessionStoreValue | null>(null);

function readSnapshot(): SessionStoreState {
  const rawSnapshot = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!rawSnapshot) return defaultState;

  try {
    const snapshot = JSON.parse(rawSnapshot) as Partial<SessionSnapshot>;
    return {
      sessionId: snapshot.sessionId ?? defaultState.sessionId,
      sessionStatus: (snapshot as Partial<SessionStoreState>).sessionStatus ?? defaultState.sessionStatus,
      metadata: snapshot.metadata ?? defaultState.metadata,
      notes: snapshot.notes ?? defaultState.notes,
      tags: snapshot.tags ?? defaultState.tags,
      selectedTranscriptId: snapshot.selectedTranscriptId,
      focusedTagId: snapshot.focusedTagId ?? defaultState.focusedTagId,
    };
  } catch {
    return defaultState;
  }
}

export function SessionStoreProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionStoreState>(() =>
    typeof window === "undefined" ? defaultState : readSnapshot(),
  );

  useEffect(() => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  
  
  
  
  
  const focusTag = useCallback((tagId: string) => {
    setState((s) => ({ ...s, focusedTagId: tagId }));
  }, []);

  const selectTranscript = useCallback((selectedTranscriptId?: string) => {
    setState((s) => ({ ...s, selectedTranscriptId }));
  }, []);

  const setSessionId = useCallback((sessionId: string) => {
    setState((s) => ({ ...s, sessionId }));
  }, []);

  const setSessionStatus = useCallback((sessionStatus: SessionStatus) => {
    setState((s) => ({ ...s, sessionStatus }));
  }, []);

  const setTags = useCallback((tags: TranscriptTag[]) => {
    setState((s) => ({ ...s, tags }));
  }, []);

  const upsertTag = useCallback((tag: TranscriptTag) => {
    setState((s) => {
      const idx = s.tags.findIndex((t) => t.id === tag.id);
      if (idx < 0) return { ...s, tags: [...s.tags, tag] };
      const next = [...s.tags];
      next[idx] = tag;
      return { ...s, tags: next };
    });
  }, []);

  const updateMetadata = useCallback((patch: Partial<SessionMetadata>) => {
    setState((s) => ({ ...s, metadata: { ...s.metadata, ...patch } }));
  }, []);

  const updateNotes = useCallback((notes: SessionNote[]) => {
    setState((s) => ({ ...s, notes }));
  }, []);

  const addNote = useCallback((note: SessionNote) => {
    setState((s) => ({ ...s, notes: [...s.notes, note] }));
  }, []);

  const removeNote = useCallback((noteId: string) => {
    setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== noteId) }));
  }, []);

  const updateNoteTags = useCallback((noteId: string, tagId: string, linked: boolean) => {
    setState((s) => ({
      ...s,
      notes: s.notes.map((n) =>
        n.id !== noteId ? n : {
          ...n,
          linkedTagIds: linked
            ? [...new Set([...(n.linkedTagIds ?? []), tagId])]
            : (n.linkedTagIds ?? []).filter((id) => id !== tagId),
        },
      ),
    }));
  }, []);

  const value = useMemo<SessionStoreValue>(
    () => ({
      ...state,
      availableTags: defaultTagOptions,
      focusTag,
      selectTranscript,
      setSessionId,
      setSessionStatus,
      setTags,
      upsertTag,
      updateMetadata,
      updateNotes,
      addNote,
      removeNote,
      updateNoteTags,
    }),
    
    [state, focusTag, selectTranscript, setSessionId, setSessionStatus, setTags, upsertTag, updateMetadata, updateNotes, addNote, removeNote, updateNoteTags],
  );

  return (
    <SessionStoreContext.Provider value={value}>
      {children}
    </SessionStoreContext.Provider>
  );
}

export function useSessionStore() {
  const ctx = useContext(SessionStoreContext);
  if (!ctx) throw new Error("useSessionStore must be used within SessionStoreProvider");
  return ctx;
}
