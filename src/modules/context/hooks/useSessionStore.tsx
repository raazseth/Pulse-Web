import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useOptionalAuth } from "@/modules/auth/hooks/useAuthStore";
import { defaultTagOptions } from "@/modules/tagging/services/taggingStorage";
import { TagOption, TranscriptTag } from "@/modules/tagging/types";
import { SessionSnapshot } from "@/shared/types/session";
import { SessionMetadata, SessionNote, SessionStatus, SessionStoreState } from "@/modules/context/types";
import type { HudApiFullSnapshot } from "@/modules/context/types/hudApiSnapshot";
import { mapServerHudTagToTranscriptTag } from "@/modules/context/utils/mapServerHudTag";

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
  applyServerHudSnapshot: (snap: HudApiFullSnapshot) => void;
}

const SESSION_STORAGE_KEY = "pulse-hud-session";
const LAST_SESSION_STORAGE_KEY = "pulse-hud-last-session";

function userStorageKey(userId?: string) {
  return userId ? `${SESSION_STORAGE_KEY}:${userId}` : SESSION_STORAGE_KEY;
}

export function lastSessionStorageKey(userId: string) {
  return `${LAST_SESSION_STORAGE_KEY}:${userId}`;
}

function createDefaultState(): SessionStoreState {
  return {
    sessionId: "",
    sessionStatus: "active",
    metadata: {
      title: "Untitled Session",
      facilitator: "",
      audience: "",
      role: "",
    },
    notes: [],
    tags: [],
    focusedTagId: defaultTagOptions[0].id,
  };
}

const SessionStoreContext = createContext<SessionStoreValue | null>(null);

function readSnapshot(userId?: string): SessionStoreState {
  const fallback = createDefaultState();
  const uid = userId?.trim();
  if (!uid) {
    return fallback;
  }

  const parseSessionId = (raw: unknown): string => {
    if (typeof raw !== "string") return "";
    return raw.trim();
  };

  const rawSnapshot = window.localStorage.getItem(userStorageKey(uid));
  if (!rawSnapshot) {
    return fallback;
  }

  try {
    const snapshot = JSON.parse(rawSnapshot) as Partial<SessionSnapshot>;
    const sid = parseSessionId(snapshot.sessionId);
    const base: SessionStoreState = {
      sessionId: sid || fallback.sessionId,
      sessionStatus: (snapshot as Partial<SessionStoreState>).sessionStatus ?? fallback.sessionStatus,
      metadata: snapshot.metadata ?? fallback.metadata,
      notes: snapshot.notes ?? fallback.notes,
      tags: snapshot.tags ?? fallback.tags,
      selectedTranscriptId: snapshot.selectedTranscriptId,
      focusedTagId: snapshot.focusedTagId ?? fallback.focusedTagId,
    };
    return base;
  } catch {
    return fallback;
  }
}

export function SessionStoreProvider({ children }: PropsWithChildren) {
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const [state, setState] = useState<SessionStoreState>(() =>
    typeof window === "undefined" ? createDefaultState() : readSnapshot(user?.id),
  );

  useEffect(() => {
    if (!user?.id) return;
    window.localStorage.setItem(userStorageKey(user.id), JSON.stringify(state));
    if (state.sessionId) {
      window.localStorage.setItem(lastSessionStorageKey(user.id), state.sessionId);
    }
  }, [state, user?.id]);

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

  const applyServerHudSnapshot = useCallback((snap: HudApiFullSnapshot) => {
    const { session } = snap;
    setState((s) => ({
      ...s,
      sessionId: session.id,
      sessionStatus: session.status,
      metadata: {
        title: session.title || session.context?.title || "Untitled Session",
        facilitator: session.facilitator || session.context?.facilitator || "",
        audience: session.audience || session.context?.audience || "",
        role: session.role || session.context?.role || "",
      },
      notes: (snap.notes ?? s.notes).map((note) => ({
        id: note.id,
        label: note.label,
        body: note.body,
        linkedTagIds: note.linkedTagIds,
      })),
      tags: snap.tags.map((t) => mapServerHudTagToTranscriptTag(t)),
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
      applyServerHudSnapshot,
    }),
    [
      state,
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
      applyServerHudSnapshot,
    ],
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
