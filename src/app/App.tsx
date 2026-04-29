import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { ContextPanel } from "@/modules/context/components/ContextPanel";
import { useSessionStore } from "@/modules/context/hooks/useSessionStore";
import { useHudContextApi } from "@/modules/context/hooks/useHudContextApi";
import { useNoteApi } from "@/modules/context/hooks/useNoteApi";
import { useNoteTagApi } from "@/modules/context/hooks/useNoteTagApi";
import { useSessionList, type SessionSummary } from "@/modules/context/hooks/useSessionList";
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
import { useTranscriptMainBridge, useTranscriptPipBridge } from "@/modules/transcript/hooks/useTranscriptBridge";
import { useMicCapture } from "@/modules/transcript/hooks/useMicCapture";
import { useBrowserFirstVoice } from "@/modules/transcript/hooks/useBrowserFirstVoice";
import { useSystemAudioCapture } from "@/modules/transcript/hooks/useSystemAudioCapture";
import { getHudPromptUrl, getHudSessionStartUrl, getHudSessionStopUrl } from "@/shared/utils/hudApi";
import { getRuntimeApiConfig } from "@/shared/utils/hudApiBaseUrl";
import { fetchWithAuth } from "@/shared/utils/fetchWithAuth";
import { DESKTOP_SENTINEL } from "@/shared/constants/auth";
import { useAuth } from "@/modules/auth/hooks/useAuthStore";
import { defaultTagOptions } from "@/modules/tagging/services/taggingStorage";
import { transcriptLineHasCatalogTag } from "@/modules/tagging/utils/transcriptTagDedupe";
import { FloatingPulseHud } from "@/shared/components/FloatingPulseHud";
import { singleFlightByKey } from "@/shared/utils/singleFlightByKey";
import { SessionNote } from "@/modules/context/types";
import { TranscriptSocketTag } from "@/modules/transcript/types";
import { TranscriptSessionState } from "@/modules/transcript/types";

function pickPreferredServerSession(list: SessionSummary[]): SessionSummary {
  return list.find((s) => s.status === "active") ?? list[0];
}

function mapRemoteTag(tag: {
  id: string;
  transcriptId?: string;
  label: string;
  createdAt: string;
  metadata?: Record<string, string>;
}) {
  const catalogId =
    tag.metadata?.tagKey ??
    defaultTagOptions.find((o) => o.label === tag.label)?.id ??
    tag.label;
  return {
    id: tag.id,
    tagId: catalogId,
    transcriptId: tag.transcriptId,
    timestamp: tag.createdAt,
  };
}

export function App() {
  const isPipMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("pip");
  const { accessToken, refreshAccessToken } = useAuth();
  const { setHudSocketStatus } = useTranscriptHud();
  const speakerIdRef = useRef("interviewer");
  const sendChunkRef = useRef<(payload: { text: string; speakerId?: string; timestamp?: string; context?: Record<string, string> }) => boolean>(() => false);
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
    disabled: isPipMode,
    onSessionState: useCallback((state: TranscriptSessionState) => {
      session.setTags(state.tags.map(mapRemoteTag));
    }, [session.setTags]),
    onTagCreated: useCallback((tag: TranscriptSocketTag) => {
      session.upsertTag(mapRemoteTag(tag));
    }, [session.upsertTag]),
  });

  // Bridge: main window broadcasts transcript state to pip; pip relays sends back.
  // Both hooks are always called (React rules); `enabled` flag controls active side.
  useTranscriptMainBridge(
    !isPipMode,
    transcript.items,
    transcript.prompts,
    transcript.signals,
    transcript.status,
    transcript.sendChunk,
  );
  const pipBridge = useTranscriptPipBridge(isPipMode);

  // Route sendChunk through the active source before any callbacks are defined.
  sendChunkRef.current = isPipMode ? pipBridge.sendChunk : transcript.sendChunk;

  const effectiveItems = isPipMode ? pipBridge.items : transcript.items;
  const effectivePrompts = isPipMode ? pipBridge.prompts : transcript.prompts;

  const promptSuggestions = usePromptSuggestions(
    effectiveItems,
    effectivePrompts,
  );

  const timelineMarkers = useTimelineMarkers({
    prompts: promptSuggestions.prompts,
    tags: session.tags,
    transcripts: transcript.items,
    signals: transcript.signals,
  });

  const selectedTag = useMemo(
    () => session.availableTags.find((tag) => tag.id === session.focusedTagId),
    [session.availableTags, session.focusedTagId],
  );

  const selectedTranscript = useMemo(
    () =>
      transcript.items.find((item) => item.id === session.selectedTranscriptId) ??
      transcript.items.at(-1),
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

  const sendFocusedTag = useCallback(() => {
    if (!selectedTranscript || !selectedTag) return;
    if (
      transcriptLineHasCatalogTag(session.tags, selectedTranscript.id, selectedTag.id)
    ) {
      return;
    }
    transcript.createTag({
      label: selectedTag.label,
      transcriptId: selectedTranscript.id,
      metadata: { tagKey: selectedTag.id },
    });
  }, [selectedTranscript, selectedTag, session.tags, transcript.createTag]);

  const handleTagAttach = useCallback(
    (catalogTagId: string) => {
      const tag = session.availableTags.find((item) => item.id === catalogTagId);
      if (!selectedTranscript || !tag) return;
      if (transcriptLineHasCatalogTag(session.tags, selectedTranscript.id, tag.id)) {
        return;
      }
      transcript.createTag({
        label: tag.label,
        transcriptId: selectedTranscript.id,
        metadata: { tagKey: tag.id },
      });
    },
    [session.availableTags, session.tags, selectedTranscript, transcript.createTag],
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

  const applyVoiceToComposerLine = useCallback((chunk: string, replace: boolean) => {
    const t = chunk.trim();
    if (!t) return;
    setComposerLine((prev) => {
      if (replace) return t;
      const p = prev.trimEnd();
      if (!p) return t;
      return `${p} ${t}`;
    });
  }, []);

  const handleMicChunk = useCallback((text: string) => {
    const speakerId = speakerIdRef.current;
    console.log("[server-transcript]", { text, speakerId });
    applyVoiceToComposerLine(text, voiceAutoSend);
    if (!voiceAutoSend) return;
    const sent = handleComposerSubmit({ text, speakerId, transcriptSource: "server-transcribe" });
    if (sent) setComposerLine("");
  }, [voiceAutoSend, applyVoiceToComposerLine, handleComposerSubmit]);

  const handleBrowserDictatedText = useCallback((text: string) => {
    const speakerId = speakerIdRef.current;
    applyVoiceToComposerLine(text, voiceAutoSend);
    if (!voiceAutoSend) return;
    const sent = handleComposerSubmit({ text, speakerId, transcriptSource: "browser-speech" });
    if (sent) setComposerLine("");
  }, [voiceAutoSend, applyVoiceToComposerLine, handleComposerSubmit]);

  const voiceTranscribeFallbackRef = useRef<(() => void) | null>(null);

  const mic = useMicCapture({
    accessToken,
    refreshAccessToken,
    onChunk: handleMicChunk,
    onVoiceBackendError: () => voiceTranscribeFallbackRef.current?.(),
  });

  const handleSystemAudioChunk = useCallback((text: string) => {
    const speakerId = speakerIdRef.current;
    applyVoiceToComposerLine(text, voiceAutoSend);
    if (!voiceAutoSend) return;
    const sent = handleComposerSubmit({ text, speakerId, transcriptSource: "server-transcribe" });
    if (sent) setComposerLine("");
  }, [voiceAutoSend, applyVoiceToComposerLine, handleComposerSubmit]);

  const systemAudio = useSystemAudioCapture({
    accessToken,
    refreshAccessToken,
    onChunk: handleSystemAudioChunk,
    sendAudioChunk: isPipMode ? undefined : (audio, mimeType) =>
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
    if (accessToken && accessToken !== DESKTOP_SENTINEL) {
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
    if (accessToken && accessToken !== DESKTOP_SENTINEL) {
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

  const handleNoteSave = useCallback((note: SessionNote) => {
    const timers = noteSyncTimers.current;
    const existing = timers.get(note.id);
    if (existing) window.clearTimeout(existing);
    const id = window.setTimeout(() => {
      noteApi.updateNote(note.id, note.body).catch(() => { });
      timers.delete(note.id);
    }, 1000);
    timers.set(note.id, id);
  }, [noteApi]);

  const handleNoteAdd = useCallback(async () => {
    try {
      const created = await noteApi.createNote("");
      session.addNote({
        id: created.id,
        label: "New note",
        body: created.body,
        linkedTagIds: [],
      });
    } catch {
    }
  }, [session.addNote, noteApi]);

  const handleNoteDelete = useCallback((noteId: string) => {
    session.removeNote(noteId);
    noteApi.deleteNote(noteId).catch(() => { });
  }, [session.removeNote, noteApi]);


  const handlePromptDismiss = useCallback((promptId: string) => {
    fetchWithAuth(
      getHudPromptUrl(session.sessionId, promptId),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      },
      () => accessToken,
      refreshAccessToken,
    ).catch(() => { });
  }, [session.sessionId, accessToken, refreshAccessToken]);

  const handlePromptUse = useCallback((promptId: string) => {
    fetchWithAuth(
      getHudPromptUrl(session.sessionId, promptId),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ used: true }),
      },
      () => accessToken,
      refreshAccessToken,
    ).catch(() => { });
  }, [session.sessionId, accessToken, refreshAccessToken]);


  const noteTagApi = useNoteTagApi({
    sessionId: session.sessionId,
    accessToken,
    refreshAccessToken,
  });

  const handleNoteTagAdd = useCallback((noteId: string, tagId: string) => {
    session.updateNoteTags(noteId, tagId, true);
    noteTagApi.addTagToNote(noteId, tagId).catch(() => { });
  }, [session.updateNoteTags, noteTagApi]);

  const handleNoteTagRemove = useCallback((noteId: string, tagId: string) => {
    session.updateNoteTags(noteId, tagId, false);
    noteTagApi.removeTagFromNote(noteId, tagId).catch(() => { });
  }, [session.updateNoteTags, noteTagApi]);

  const { patchContext } = useHudContextApi({
    sessionId: session.sessionId,
    accessToken,
    refreshAccessToken,
  });

  const contextSyncTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!accessToken || accessToken === DESKTOP_SENTINEL) return;
    if (contextSyncTimer.current) window.clearTimeout(contextSyncTimer.current);
    contextSyncTimer.current = window.setTimeout(() => {
      contextSyncTimer.current = null;
      patchContext({
        title: session.metadata.title,
        facilitator: session.metadata.facilitator,
        audience: session.metadata.audience,
        role: session.metadata.role,
      }).catch(() => { });
    }, 700);
    return () => {
      if (contextSyncTimer.current) window.clearTimeout(contextSyncTimer.current);
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
    if (!accessToken || accessToken === DESKTOP_SENTINEL) return;
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
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [accessToken, noteApi, session.sessionId, session.updateNotes]);


  const sessionList = useSessionList();
  const listPrevLoadingRef = useRef<boolean | undefined>(undefined);
  const emptyListBootstrapAttemptedRef = useRef(false);
  const sessionBootstrapTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!accessToken || accessToken === DESKTOP_SENTINEL) {
      listPrevLoadingRef.current = undefined;
      emptyListBootstrapAttemptedRef.current = false;
      sessionBootstrapTokenRef.current = null;
      return;
    }

    if (sessionBootstrapTokenRef.current !== accessToken) {
      sessionBootstrapTokenRef.current = accessToken;
      listPrevLoadingRef.current = undefined;
      emptyListBootstrapAttemptedRef.current = false;
    }

    const prevLoading = listPrevLoadingRef.current;
    listPrevLoadingRef.current = sessionList.loading;

    if (prevLoading === undefined) {
      return;
    }

    const fetchJustFinished = prevLoading === true && sessionList.loading === false;
    if (!fetchJustFinished) {
      return;
    }

    const list = sessionList.sessions;
    if (!sessionList.listLoadSucceeded) {
      return;
    }

    if (list.length === 0) {
      if (emptyListBootstrapAttemptedRef.current) {
        return;
      }
      emptyListBootstrapAttemptedRef.current = true;
      const payload = {
        title: session.metadata.title,
        facilitator: session.metadata.facilitator,
        audience: session.metadata.audience,
        role: session.metadata.role,
      };
      singleFlightByKey(`hud:auto-session:${accessToken}`, () => sessionList.createSession(payload))
        .then((created) => {
          if (created?.id) session.setSessionId(created.id);
          if (created?.title) session.updateMetadata({ title: created.title });
          session.setSessionStatus("active");
        })
        .catch(() => {
          emptyListBootstrapAttemptedRef.current = false;
        });
      return;
    }

    emptyListBootstrapAttemptedRef.current = false;
    const current = list.find((s) => s.id === session.sessionId);
    if (!current) {
      const preferred = pickPreferredServerSession(list);
      session.setSessionId(preferred.id);
      session.updateMetadata({ title: preferred.title });
      session.setSessionStatus(preferred.status);
    } else {
      session.setSessionStatus(current.status);
    }
  }, [
    accessToken,
    sessionList.loading,
    sessionList.listLoadSucceeded,
    sessionList.sessions,
    session.sessionId,
    session.metadata.title,
    session.metadata.facilitator,
    session.metadata.audience,
    session.metadata.role,
    sessionList.createSession,
    session.setSessionId,
    session.updateMetadata,
    session.setSessionStatus,
  ]);

  useEffect(() => {
    if (!transcript.items.length) return;
    if (!session.selectedTranscriptId) {
      session.selectTranscript(transcript.items.at(-1)?.id);
    }
  }, [session.selectTranscript, session.selectedTranscriptId, transcript.items]);

  useEffect(() => {
    setHudSocketStatus(transcript.status);
    return () => setHudSocketStatus("disconnected");
  }, [transcript.status, setHudSocketStatus]);

  const isConnected = transcript.status === "connected";
  const sessionDisplayName =
    session.metadata.title?.trim() || session.sessionId || "Session";

  const voice = useBrowserFirstVoice({
    mic,
    onDictatedText: handleBrowserDictatedText,
    disabled: !isConnected,
    getSpeakerId: () => speakerIdRef.current,
    transcribeFallbackRef: voiceTranscribeFallbackRef,
  });

  const pipConnected = pipBridge.status === "connected";

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
        onPromptUse={handlePromptUse}
        onPromptDismiss={handlePromptDismiss}
        quickTags={session.availableTags.slice(0, 8)}
        onQuickTag={handleTagAttach}
        voiceActive={voice.isActive}
        onVoiceToggle={voice.toggle}
        onSendChunk={handleComposerSubmit}
        sendChunkDisabled={!pipConnected}
        getDefaultSpeakerId={() => speakerIdRef.current}
        composerLine={composerLine}
        onComposerLineChange={setComposerLine}
        onSpeakerChange={(id) => { speakerIdRef.current = id; }}
        sessionTitle={session.metadata.title}
        sessionId={session.sessionId}
        onClose={() => { void window.api?.stopInterview(); window.close(); }}
      />
    );
  }

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto", width: "100%" }}>
      <Stack spacing={3}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h4" component="h1">
              {sessionDisplayName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Track live transcript, tag moments, monitor prompts, and keep study context in one flow.
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

        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 7.5 }}>
            <Stack spacing={2.5}>
              <TranscriptComposer
                disabled={!isConnected}
                mic={mic}
                voice={voice}
                voiceAutoSend={voiceAutoSend}
                onVoiceAutoSendChange={setVoiceAutoSend}
                lineDraft={composerLine}
                onLineDraftChange={setComposerLine}
                onSpeakerChange={(id) => { speakerIdRef.current = id; }}
                onSubmit={handleComposerSubmit}
              />
              <TranscriptPanel
                activeItemId={session.selectedTranscriptId}
                errorMessage={transcript.errorMessage}
                items={transcript.items}
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
                onNoteTagAdd={handleNoteTagAdd}
                onNoteTagRemove={handleNoteTagRemove}
              />
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, lg: 4.5 }}>
            <Stack spacing={2.5}>
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
      />
    </Box>
  );
}
