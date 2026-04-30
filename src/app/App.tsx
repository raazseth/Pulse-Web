import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, Grid, Stack, Typography } from "@mui/material";
import { ContextPanel } from "@/modules/context/components/ContextPanel";
import {
  lastSessionStorageKey,
  useSessionStore,
} from "@/modules/context/hooks/useSessionStore";
import { useHudContextApi } from "@/modules/context/hooks/useHudContextApi";
import { useNoteApi } from "@/modules/context/hooks/useNoteApi";
import { useNoteTagApi } from "@/modules/context/hooks/useNoteTagApi";
import {
  useSessionList,
  type SessionSummary,
} from "@/modules/context/hooks/useSessionList";
import { PromptSuggestionPanel } from "@/modules/prompts/components/PromptSuggestionPanel";
import { usePromptSuggestions } from "@/modules/prompts/hooks/usePromptSuggestions";
import { TagPanel } from "@/modules/tagging/components/TagPanel";
import { useTaggingShortcuts } from "@/modules/tagging/hooks/useTaggingShortcuts";
import { TimelinePanel } from "@/modules/timeline/components/TimelinePanel";
import { useTimelineMarkers } from "@/modules/timeline/hooks/useTimelineMarkers";
import { TranscriptComposer } from "@/modules/transcript/components/TranscriptComposer";
import { TranscriptPanel } from "@/modules/transcript/components/TranscriptPanel";
import { FloatingPulseHudPanel } from "@/shared/components/FloatingPulseHudPanel";
import { useTranscriptHud } from "@/modules/transcript/context/TranscriptHudContext";
import { useTranscriptStream } from "@/modules/transcript/hooks/useTranscriptStream";
import {
  useTranscriptMainBridge,
  useTranscriptPipBridge,
} from "@/modules/transcript/hooks/useTranscriptBridge";
import { useMicCapture } from "@/modules/transcript/hooks/useMicCapture";
import { useBrowserFirstVoice } from "@/modules/transcript/hooks/useBrowserFirstVoice";
import { useSystemAudioCapture } from "@/modules/transcript/hooks/useSystemAudioCapture";
import {
  getHudExportUrl,
  getHudPromptUrl,
  getHudSessionStartUrl,
  getHudSessionStopUrl,
} from "@/shared/utils/hudApi";
import { getRuntimeApiConfig } from "@/shared/utils/hudApiBaseUrl";
import { fetchWithAuth } from "@/shared/utils/fetchWithAuth";
import { useToast } from "@/shared/components/Toast";
import { useAuth } from "@/modules/auth/hooks/useAuthStore";
import { mapServerHudTagToTranscriptTag } from "@/modules/context/utils/mapServerHudTag";
import { transcriptLineHasCatalogTag } from "@/modules/tagging/utils/transcriptTagDedupe";
import { FloatingPulseHud } from "@/shared/components/FloatingPulseHud";
import { useHudAcceptedPromptState } from "@/shared/hooks/useHudAcceptedPromptState";
import { hasPipQuery } from "@/shared/utils/electronPipSatellite";
import { singleFlightByKey } from "@/shared/utils/singleFlightByKey";
import { SessionNote } from "@/modules/context/types";
import { TranscriptSocketTag } from "@/modules/transcript/types";
import { TranscriptSessionState } from "@/modules/transcript/types";

function pickPreferredServerSession(list: SessionSummary[]): SessionSummary {
  return list.find((s) => s.status === "active") ?? list[0];
}

const TAG_CAPTURE_TEXT_MAX = 450;

function buildTagCaptureMetadata(
  line: { timestamp: string; text: string },
  catalogTagId: string,
): Record<string, string> {
  const raw = String(line.text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const snippet =
    raw.length <= TAG_CAPTURE_TEXT_MAX
      ? raw
      : `${raw.slice(0, TAG_CAPTURE_TEXT_MAX - 1)}…`;
  return {
    tagKey: catalogTagId,
    transcriptAt: line.timestamp,
    ...(snippet ? { transcriptText: snippet } : {}),
  };
}

export function App() {
  const isPipMode = typeof window !== "undefined" && hasPipQuery();
  const { accessToken, refreshAccessToken, user } = useAuth();
  const { setHudSocketStatus, setHudSocketError } = useTranscriptHud();
  const { toast } = useToast();
  const speakerIdRef = useRef("interviewee");
  const tagAttachInflightRef = useRef(new Set<string>());
  const sendChunkRef = useRef<
    (payload: {
      text: string;
      speakerId?: string;
      timestamp?: string;
      context?: Record<string, string>;
    }) => boolean
  >(() => false);
  const [voiceAutoSend, setVoiceAutoSend] = useState(true);
  const [composerLine, setComposerLine] = useState("");
  const session = useSessionStore();
  const runtimeApiConfig = useMemo(() => getRuntimeApiConfig(), []);

  useEffect(() => {
    console.info("[api-config]", runtimeApiConfig);
  }, [runtimeApiConfig]);

  const transcript = useTranscriptStream({
    sessionId: session.sessionId,
    accessToken,
    refreshAccessToken,
    disabled: isPipMode || !accessToken || !session.sessionId,
    onSessionAccessDenied: useCallback(() => {
      session.setSessionId("");
      if (user?.id) {
        try {
          window.localStorage.removeItem(lastSessionStorageKey(user.id));
        } catch {
          /* noop */
        }
      }
    }, [session.setSessionId, user?.id]),
    onSessionState: useCallback(
      (state: TranscriptSessionState) => {
        session.setTags(state.tags.map(mapServerHudTagToTranscriptTag));
      },
      [session.setTags],
    ),
    onTagCreated: useCallback(
      (tag: TranscriptSocketTag) => {
        const mapped = mapServerHudTagToTranscriptTag(tag);
        if (mapped.transcriptId) {
          tagAttachInflightRef.current.delete(
            `${mapped.transcriptId}\0${mapped.tagId}`,
          );
        }
        session.upsertTag(mapped);
      },
      [session.upsertTag],
    ),
  });

  useTranscriptMainBridge(
    !isPipMode,
    transcript.items,
    transcript.prompts,
    transcript.signals,
    transcript.status,
    transcript.sendChunk,
  );
  const pipBridge = useTranscriptPipBridge(isPipMode);
  const pipConnected = pipBridge.status === "connected";

  sendChunkRef.current = isPipMode ? pipBridge.sendChunk : transcript.sendChunk;

  const effectiveItems = isPipMode ? pipBridge.items : transcript.items;
  const effectivePrompts = isPipMode ? pipBridge.prompts : transcript.prompts;
  const effectiveSignals = isPipMode ? pipBridge.signals : transcript.signals;

  const promptSuggestions = usePromptSuggestions(
    effectiveItems,
    effectivePrompts,
  );

  const timelineMarkers = useTimelineMarkers({
    prompts: promptSuggestions.prompts,
    tags: session.tags,
    transcripts: effectiveItems,
    signals: effectiveSignals,
  });

  const selectedTag = useMemo(
    () => session.availableTags.find((tag) => tag.id === session.focusedTagId),
    [session.availableTags, session.focusedTagId],
  );

  const selectedTranscript = useMemo(
    () =>
      transcript.items.find(
        (item) => item.id === session.selectedTranscriptId,
      ) ?? transcript.items.at(-1),
    [session.selectedTranscriptId, transcript.items],
  );

  const floatingTranscriptPreview = useMemo(
    () => transcript.items.slice(-2),
    [transcript.items],
  );

  const floatingQuickTags = useMemo(
    () => session.availableTags.slice(0, 8),
    [session.availableTags],
  );

  const tryAttachCatalogTagToLine = useCallback(
    (
      catalogTagId: string,
      line: { id: string; text: string; timestamp: string } | undefined,
    ) => {
      if (!line) return false;
      const tag = session.availableTags.find(
        (item) => item.id === catalogTagId,
      );
      if (!tag) return false;
      const key = `${line.id}\0${tag.id}`;
      if (tagAttachInflightRef.current.has(key)) return false;
      if (transcriptLineHasCatalogTag(session.tags, line.id, tag.id))
        return false;
      tagAttachInflightRef.current.add(key);
      const ok = transcript.createTag({
        label: tag.label,
        transcriptId: line.id,
        metadata: buildTagCaptureMetadata(line, tag.id),
      });
      if (!ok) tagAttachInflightRef.current.delete(key);
      return ok;
    },
    [session.availableTags, session.tags, transcript.createTag],
  );

  const sendFocusedTag = useCallback(() => {
    if (!selectedTranscript || !selectedTag) return;
    void tryAttachCatalogTagToLine(selectedTag.id, selectedTranscript);
  }, [selectedTranscript, selectedTag, tryAttachCatalogTagToLine]);

  const handleTagAttach = useCallback(
    (catalogTagId: string, transcriptIdOverride?: string) => {
      const line = transcriptIdOverride
        ? transcript.items.find((item) => item.id === transcriptIdOverride)
        : selectedTranscript;
      void tryAttachCatalogTagToLine(catalogTagId, line);
    },
    [selectedTranscript, transcript.items, tryAttachCatalogTagToLine],
  );

  useTaggingShortcuts({
    onTagLatest: sendFocusedTag,
    tagPalette: session.availableTags,
    onFocusTagByIndex: (index) => {
      const t = session.availableTags[index];
      if (!t) return;
      session.focusTag(t.id);
      handleTagAttach(t.id);
    },
  });

  const handleComposerSubmit = useCallback(
    ({
      text,
      speakerId,
      transcriptSource,
    }: {
      text: string;
      speakerId: string;
      transcriptSource?: "browser-speech" | "server-transcribe";
    }) =>
      sendChunkRef.current({
        text,
        speakerId,
        context: {
          title: session.metadata.title,
          facilitator: session.metadata.facilitator,
          audience: session.metadata.audience,
          role: session.metadata.role,
          notes: session.notes.map((n) => n.body).join("\n"),
          ...(transcriptSource ? { transcriptSource } : {}),
        },
      }),
    [session.metadata, session.notes],
  );

  const applyVoiceToComposerLine = useCallback(
    (chunk: string, replace: boolean) => {
      const t = chunk.trim();
      if (!t) return;
      setComposerLine((prev) => {
        if (replace) return t;
        const p = prev.trimEnd();
        if (!p) return t;
        return `${p} ${t}`;
      });
    },
    [],
  );

  const handleMicChunk = useCallback(
    (text: string) => {
      const speakerId = speakerIdRef.current;
      console.log("[server-transcript]", { text, speakerId });
      applyVoiceToComposerLine(text, voiceAutoSend);
      if (!voiceAutoSend) return;
      const sent = handleComposerSubmit({
        text,
        speakerId,
        transcriptSource: "server-transcribe",
      });
      if (sent) setComposerLine("");
    },
    [voiceAutoSend, applyVoiceToComposerLine, handleComposerSubmit],
  );

  const handleBrowserDictatedText = useCallback(
    (text: string) => {
      const speakerId = speakerIdRef.current;
      applyVoiceToComposerLine(text, voiceAutoSend);
      if (!voiceAutoSend) return;
      const sent = handleComposerSubmit({
        text,
        speakerId,
        transcriptSource: "browser-speech",
      });
      if (sent) setComposerLine("");
    },
    [voiceAutoSend, applyVoiceToComposerLine, handleComposerSubmit],
  );

  const voiceTranscribeFallbackRef = useRef<(() => void) | null>(null);

  const mic = useMicCapture({
    accessToken,
    refreshAccessToken,
    transcribeSessionId: session.sessionId,
    onChunk: handleMicChunk,
    onVoiceBackendError: () => voiceTranscribeFallbackRef.current?.(),
  });

  const handleSystemAudioChunk = useCallback(
    (text: string) => {
      const speakerId = "system";
      applyVoiceToComposerLine(text, voiceAutoSend);
      if (!voiceAutoSend) return;
      const sent = handleComposerSubmit({
        text,
        speakerId,
        transcriptSource: "server-transcribe",
      });
      if (sent) setComposerLine("");
    },
    [voiceAutoSend, applyVoiceToComposerLine, handleComposerSubmit],
  );

  const systemAudio = useSystemAudioCapture({
    accessToken,
    refreshAccessToken,
    transcribeSessionId: session.sessionId,
    onChunk: handleSystemAudioChunk,
    sendAudioChunk: isPipMode
      ? undefined
      : (audio, mimeType) =>
          transcript.sendAudioChunk({
            audio,
            mimeType,
            speakerId: "system",
            lang: "en",
            context: {
              title: session.metadata.title,
              facilitator: session.metadata.facilitator,
              audience: session.metadata.audience,
              role: session.metadata.role,
              notes: session.notes.map((n) => n.body).join("\n"),
              transcriptSource: "server-transcribe",
            },
          }),
  });

  const handleSystemAudioStart = useCallback(async () => {
    if (accessToken) {
      fetchWithAuth(
        getHudSessionStartUrl(session.sessionId),
        { method: "POST" },
        () => accessToken,
        refreshAccessToken,
      ).catch(() => {});
    }
    await systemAudio.start();
  }, [accessToken, refreshAccessToken, session.sessionId, systemAudio.start]);

  const handleSystemAudioStop = useCallback(() => {
    systemAudio.stop();
    if (accessToken) {
      fetchWithAuth(
        getHudSessionStopUrl(session.sessionId),
        { method: "POST" },
        () => accessToken,
        refreshAccessToken,
      ).catch(() => {});
    }
  }, [accessToken, refreshAccessToken, session.sessionId, systemAudio.stop]);

  const noteApi = useNoteApi({
    sessionId: session.sessionId,
    accessToken,
    refreshAccessToken,
  });

  const noteSyncTimers = useRef<Map<string, number>>(new Map());

  const flushNoteTimer = useCallback((noteId: string) => {
    const timers = noteSyncTimers.current;
    const existing = timers.get(noteId);
    if (existing) {
      window.clearTimeout(existing);
      timers.delete(noteId);
    }
  }, []);

  const handleNoteSave = useCallback(
    (note: SessionNote) => {
      if (note.editorLocked) return;
      const timers = noteSyncTimers.current;
      const existing = timers.get(note.id);
      if (existing) window.clearTimeout(existing);
      const id = window.setTimeout(() => {
        noteApi.updateNote(note.id, note.body).catch(() => {});
        timers.delete(note.id);
      }, 1000);
      timers.set(note.id, id);
    },
    [noteApi],
  );

  const handleNoteCommit = useCallback(
    (note: SessionNote) => {
      flushNoteTimer(note.id);
      noteApi.updateNote(note.id, note.body).catch(() => {});
    },
    [flushNoteTimer, noteApi],
  );

  const handleNoteAdd = useCallback(async () => {
    if (session.notes.some((n) => n.isDraft)) return;
    try {
      const created = await noteApi.createNote("");
      session.addNote({
        id: created.id,
        label: "New note",
        body: created.body,
        linkedTagIds: [],
        isDraft: true,
      });
    } catch {}
  }, [session.addNote, session.notes, noteApi]);

  const handleNoteDelete = useCallback(
    (noteId: string) => {
      session.removeNote(noteId);
      noteApi.deleteNote(noteId).catch(() => {});
    },
    [session.removeNote, noteApi],
  );

  const handlePromptDismiss = useCallback(
    (promptId: string) => {
      fetchWithAuth(
        getHudPromptUrl(session.sessionId, promptId),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dismissed: true }),
        },
        () => accessToken,
        refreshAccessToken,
      ).catch(() => {});
    },
    [session.sessionId, accessToken, refreshAccessToken],
  );

  const handlePromptUse = useCallback(
    (promptId: string) => {
      fetchWithAuth(
        getHudPromptUrl(session.sessionId, promptId),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ used: true }),
        },
        () => accessToken,
        refreshAccessToken,
      ).catch(() => {});
    },
    [session.sessionId, accessToken, refreshAccessToken],
  );

  const {
    acceptedMessages: pipAcceptedMessages,
    dismissedPromptIds: pipDismissedPromptIds,
    handleHudPromptAccept: pipHandleHudPromptAccept,
    handleHudPromptDismissId: pipHandleHudPromptDismissId,
  } = useHudAcceptedPromptState(
    session.sessionId,
    handlePromptUse,
    handlePromptDismiss,
  );

  const noteTagApi = useNoteTagApi({
    sessionId: session.sessionId,
    accessToken,
    refreshAccessToken,
  });

  const handleNoteTagAdd = useCallback(
    (noteId: string, tagId: string) => {
      session.updateNoteTags(noteId, tagId, true);
      noteTagApi.addTagToNote(noteId, tagId).catch(() => {});
    },
    [session.updateNoteTags, noteTagApi],
  );

  const handleNoteTagRemove = useCallback(
    (noteId: string, tagId: string) => {
      session.updateNoteTags(noteId, tagId, false);
      noteTagApi.removeTagFromNote(noteId, tagId).catch(() => {});
    },
    [session.updateNoteTags, noteTagApi],
  );

  const { patchContext } = useHudContextApi({
    sessionId: session.sessionId,
    accessToken,
    refreshAccessToken,
  });

  const contextSyncTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!accessToken) return;
    if (contextSyncTimer.current) window.clearTimeout(contextSyncTimer.current);
    contextSyncTimer.current = window.setTimeout(() => {
      contextSyncTimer.current = null;
      patchContext({
        title: session.metadata.title,
        facilitator: session.metadata.facilitator,
        audience: session.metadata.audience,
        role: session.metadata.role,
      }).catch(() => {});
    }, 700);
    return () => {
      if (contextSyncTimer.current)
        window.clearTimeout(contextSyncTimer.current);
    };
  }, [
    accessToken,
    patchContext,
    session.metadata.title,
    session.metadata.facilitator,
    session.metadata.audience,
    session.metadata.role,
    session.sessionId,
  ]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    noteApi
      .listNotes()
      .then((rows) => {
        if (cancelled) return;
        session.updateNotes(
          rows.map(
            (r): SessionNote => ({
              id: r.id,
              label: r.label,
              body: r.body,
              linkedTagIds: r.linkedTagIds,
            }),
          ),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken, noteApi, session.sessionId, session.updateNotes]);

  const sessionList = useSessionList();
  const emptyListBootstrapAttemptedRef = useRef(false);
  const sessionBootstrapTokenRef = useRef<string | null>(null);
  const loadedServerSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session.sessionId.trim()) {
      loadedServerSessionRef.current = null;
    }
  }, [session.sessionId]);

  useEffect(() => {
    if (!accessToken || !user?.id) {
      emptyListBootstrapAttemptedRef.current = false;
      sessionBootstrapTokenRef.current = null;
      loadedServerSessionRef.current = null;
      return;
    }

    if (sessionBootstrapTokenRef.current !== accessToken) {
      sessionBootstrapTokenRef.current = accessToken;
      emptyListBootstrapAttemptedRef.current = false;
      loadedServerSessionRef.current = null;
    }

    if (sessionList.loading || !sessionList.listLoadSucceeded) {
      return;
    }

    const list = sessionList.sessions;
    if (list.length > 0) {
      const staleSessionId = session.sessionId.trim();
      if (staleSessionId && !list.some((s) => s.id === staleSessionId)) {
        session.setSessionId("");
        loadedServerSessionRef.current = null;
        if (user?.id) {
          try {
            window.localStorage.removeItem(lastSessionStorageKey(user.id));
          } catch {
            /* noop */
          }
        }
        return;
      }
    }

    if (list.length === 0) {
      if (emptyListBootstrapAttemptedRef.current) {
        return;
      }
      emptyListBootstrapAttemptedRef.current = true;
      const payload = {
        title: "Untitled Session",
        facilitator: session.metadata.facilitator,
        audience: session.metadata.audience,
        role: session.metadata.role,
      };
      singleFlightByKey(`hud:auto-session:${accessToken}`, () =>
        sessionList.createSession(payload),
      )
        .then(async (created) => {
          if (!created?.id) return;
          const snapshot = await sessionList.fetchSessionSnapshot(created.id);
          if (snapshot) {
            loadedServerSessionRef.current = created.id;
            session.applyServerHudSnapshot(snapshot);
          } else {
            session.setSessionId(created.id);
            session.updateMetadata({
              title: created.title || "Untitled Session",
            });
            session.setSessionStatus("active");
          }
        })
        .catch(() => {
          emptyListBootstrapAttemptedRef.current = false;
        });
      return;
    }

    emptyListBootstrapAttemptedRef.current = false;
    const storedSessionId = window.localStorage.getItem(
      lastSessionStorageKey(user.id),
    );
    const preferred =
      (storedSessionId
        ? list.find((s) => s.id === storedSessionId)
        : undefined) ??
      (sessionList.lastActiveSessionId
        ? list.find((s) => s.id === sessionList.lastActiveSessionId)
        : undefined) ??
      pickPreferredServerSession(list);

    if (!preferred || loadedServerSessionRef.current === preferred.id) return;

    loadedServerSessionRef.current = preferred.id;
    sessionList
      .fetchSessionSnapshot(preferred.id)
      .then((snapshot) => {
        if (snapshot) {
          session.applyServerHudSnapshot(snapshot);
        } else {
          loadedServerSessionRef.current = null;
          session.setSessionId("");
          if (user?.id) {
            try {
              window.localStorage.removeItem(lastSessionStorageKey(user.id));
            } catch {
              /* noop */
            }
          }
        }
      })
      .catch(() => {
        loadedServerSessionRef.current = null;
      });
  }, [
    accessToken,
    user?.id,
    session.sessionId,
    sessionList.loading,
    sessionList.listLoadSucceeded,
    sessionList.sessions,
    sessionList.lastActiveSessionId,
    sessionList.fetchSessionSnapshot,
    session.metadata.title,
    session.metadata.facilitator,
    session.metadata.audience,
    session.metadata.role,
    sessionList.createSession,
    session.applyServerHudSnapshot,
    session.setSessionId,
    session.updateMetadata,
    session.setSessionStatus,
  ]);

  useEffect(() => {
    if (!accessToken || !session.sessionId) return;
    if (loadedServerSessionRef.current === session.sessionId) return;
    const sessionId = session.sessionId;
    loadedServerSessionRef.current = sessionId;
    sessionList
      .fetchSessionSnapshot(sessionId)
      .then((snapshot) => {
        if (snapshot) {
          session.applyServerHudSnapshot(snapshot);
        } else {
          loadedServerSessionRef.current = null;
          session.setSessionId("");
          if (user?.id) {
            try {
              window.localStorage.removeItem(lastSessionStorageKey(user.id));
            } catch {
              /* noop */
            }
          }
        }
      })
      .catch(() => {
        if (loadedServerSessionRef.current === sessionId) {
          loadedServerSessionRef.current = null;
        }
      });
  }, [
    accessToken,
    user?.id,
    session.sessionId,
    sessionList.fetchSessionSnapshot,
    session.applyServerHudSnapshot,
    session.setSessionId,
  ]);

  useEffect(() => {
    if (!transcript.items.length) return;
    if (!session.selectedTranscriptId) {
      session.selectTranscript(transcript.items.at(-1)?.id);
    }
  }, [
    session.selectTranscript,
    session.selectedTranscriptId,
    transcript.items,
  ]);

  useEffect(() => {
    setHudSocketStatus(transcript.status);
    setHudSocketError(
      transcript.status === "error" ? transcript.errorMessage : undefined,
    );
  }, [
    transcript.status,
    transcript.errorMessage,
    setHudSocketStatus,
    setHudSocketError,
  ]);

  useEffect(() => {
    return () => {
      setHudSocketStatus("disconnected");
      setHudSocketError(undefined);
    };
  }, [setHudSocketStatus, setHudSocketError]);

  const lastToastedSocketError = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (transcript.status !== "error" || !transcript.errorMessage) return;
    if (lastToastedSocketError.current === transcript.errorMessage) return;
    lastToastedSocketError.current = transcript.errorMessage;
    toast({ message: transcript.errorMessage, severity: "error" });
  }, [transcript.status, transcript.errorMessage, toast]);

  const isConnected = transcript.status === "connected";

  const transcriptLive = isPipMode ? pipConnected : isConnected;
  const sessionDisplayName =
    session.metadata.title?.trim() || session.sessionId || "Session";

  useEffect(() => {
    if (!isPipMode || accessToken || !user) return;
    void refreshAccessToken();
  }, [isPipMode, accessToken, user, refreshAccessToken]);

  const voice = useBrowserFirstVoice({
    mic,
    onDictatedText: handleBrowserDictatedText,
    disabled: !transcriptLive,
    getSpeakerId: () => speakerIdRef.current,
    transcribeFallbackRef: voiceTranscribeFallbackRef,
  });

  if (isPipMode) {
    return (
      <FloatingPulseHudPanel
        visible
        layout="pip"
        helpText=""
        showPipLaunch={false}
        transcriptPreview={pipBridge.items.slice(-30)}
        transcriptStatus={pipBridge.status}
        prompts={promptSuggestions.prompts}
        acceptedMessages={pipAcceptedMessages}
        dismissedPromptIds={pipDismissedPromptIds}
        onHudPromptAccept={pipHandleHudPromptAccept}
        onHudPromptDismissId={pipHandleHudPromptDismissId}
        quickTags={session.availableTags.slice(0, 8)}
        tagShortcutPalette={session.availableTags}
        quickTagAnchorTranscriptId={session.selectedTranscriptId}
        onQuickTag={handleTagAttach}
        voiceActive={voice.isActive}
        onVoiceToggle={voice.toggle}
        onSendChunk={handleComposerSubmit}
        sendChunkDisabled={!pipConnected}
        getDefaultSpeakerId={() => speakerIdRef.current}
        composerLine={composerLine}
        onComposerLineChange={setComposerLine}
        onSpeakerChange={(id) => {
          speakerIdRef.current = id;
        }}
        sessionTitle={session.metadata.title}
        sessionId={session.sessionId}
        onClose={() => {
          void window.api?.stopInterview();
          window.close();
        }}
        notes={session.notes}
        availableTags={session.availableTags}
        transcriptTags={session.tags}
        onNotesChange={session.updateNotes}
        onNoteAdd={handleNoteAdd}
        onNoteDelete={handleNoteDelete}
        onNoteSave={handleNoteSave}
        onNoteCommit={handleNoteCommit}
        onNoteTagAdd={handleNoteTagAdd}
        onNoteTagRemove={handleNoteTagRemove}
      />
    );
  }

  return (
    <Box
      sx={{
        px: { xs: 1.5, md: 3 },
        py: { xs: 1.5, md: 3 },
        maxWidth: 1400,
        mx: "auto",
        width: "100%",
      }}
    >
      <Stack spacing={3}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: "flex-start", justifyContent: "space-between" }}
        >
          <Box>
            <Typography variant="h4" component="h1">
              {sessionDisplayName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Track live transcript, tag moments, monitor prompts, and keep
              study context in one flow.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          {!isConnected ? (
            <Chip
              size="small"
              label={transcript.status}
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
          ) : null}
          <Chip
            size="small"
            label={`${transcript.items.length} events`}
            variant="outlined"
            sx={{ fontWeight: 500 }}
          />
          <Chip
            size="small"
            label={session.sessionId}
            variant="outlined"
            sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
          />
        </Stack>

        <TimelinePanel
          activeItemId={selectedTranscript?.id}
          markers={timelineMarkers}
          onSelect={session.selectTranscript}
        />

        <Grid container spacing={{ xs: 1.5, lg: 2.5 }}>
          <Grid size={{ xs: 12, lg: 7.5 }}>
            <Stack spacing={{ xs: 1.5, lg: 2.5 }}>
              <TranscriptComposer
                disabled={!isConnected}
                mic={mic}
                voice={voice}
                voiceAutoSend={voiceAutoSend}
                onVoiceAutoSendChange={setVoiceAutoSend}
                lineDraft={composerLine}
                onLineDraftChange={setComposerLine}
                onSpeakerChange={(id) => {
                  speakerIdRef.current = id;
                }}
                onSubmit={handleComposerSubmit}
              />
              <TranscriptPanel
                activeItemId={session.selectedTranscriptId}
                errorMessage={transcript.errorMessage}
                items={transcript.items}
                signals={transcript.signals}
                status={transcript.status}
                onSelect={session.selectTranscript}
                transcriptTags={session.tags}
                availableTags={session.availableTags}
              />
              <ContextPanel
                metadata={session.metadata}
                notes={session.notes}
                availableTags={session.availableTags}
                transcriptTags={session.tags}
                onMetadataChange={session.updateMetadata}
                onNotesChange={session.updateNotes}
                onNoteAdd={handleNoteAdd}
                onNoteDelete={handleNoteDelete}
                onNoteSave={handleNoteSave}
                onNoteCommit={handleNoteCommit}
                onNoteTagAdd={handleNoteTagAdd}
                onNoteTagRemove={handleNoteTagRemove}
              />
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, lg: 4.5 }}>
            <Stack spacing={{ xs: 1.5, lg: 2.5 }}>
              <PromptSuggestionPanel
                prompts={promptSuggestions.prompts}
                onDismiss={handlePromptDismiss}
                onUse={handlePromptUse}
              />
              <TagPanel
                activeTagId={session.focusedTagId}
                selectedTranscript={selectedTranscript}
                tags={session.availableTags}
                transcriptTags={session.tags}
                onFocus={session.focusTag}
                onAttach={handleTagAttach}
              />
            </Stack>
          </Grid>
        </Grid>
      </Stack>

      <FloatingPulseHud
        transcriptPreview={transcript.items.slice(-30)}
        transcriptStatus={transcript.status}
        prompts={promptSuggestions.prompts}
        onPromptUse={handlePromptUse}
        onPromptDismiss={handlePromptDismiss}
        quickTags={session.availableTags.slice(0, 8)}
        tagShortcutPalette={session.availableTags}
        quickTagAnchorTranscriptId={session.selectedTranscriptId}
        onQuickTag={handleTagAttach}
        voiceActive={voice.isActive}
        onVoiceToggle={voice.toggle}
        onSendChunk={handleComposerSubmit}
        sendChunkDisabled={!isConnected}
        getDefaultSpeakerId={() => speakerIdRef.current}
        composerLine={composerLine}
        onComposerLineChange={setComposerLine}
        onSpeakerChange={(id) => {
          speakerIdRef.current = id;
        }}
        sessionTitle={session.metadata.title}
        sessionId={session.sessionId}
        onSystemAudioStart={handleSystemAudioStart}
        transcribing={transcript.transcribing}
        notes={session.notes}
        availableTags={session.availableTags}
        transcriptTags={session.tags}
        onNotesChange={session.updateNotes}
        onNoteAdd={handleNoteAdd}
        onNoteDelete={handleNoteDelete}
        onNoteSave={handleNoteSave}
        onNoteCommit={handleNoteCommit}
        onNoteTagAdd={handleNoteTagAdd}
        onNoteTagRemove={handleNoteTagRemove}
      />
    </Box>
  );
}
