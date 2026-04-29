import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import createCache, { type EmotionCache } from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import {
  Alert,
  alpha,
  Button,
  CircularProgress,
  CssBaseline,
  Snackbar,
  useTheme,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { FloatingPulseHudPanel } from "@/shared/components/FloatingPulseHudPanel";
import { useHudAcceptedPromptState } from "@/shared/hooks/useHudAcceptedPromptState";
import { useTabBackgrounded } from "@/shared/hooks/useTabBackgrounded";
import { seedPictureInPictureDocument } from "@/shared/utils/seedPictureInPictureDocument";
import type {
  TranscriptItem,
  TranscriptStreamStatus,
} from "@/modules/transcript/types";
import type { PromptSuggestion } from "@/modules/prompts/types";
import type { TagOption, TranscriptTag } from "@/modules/tagging/types";
import type { SessionNote } from "@/modules/context/types";

const HELP_PAGE =
  "In-page float: only while this Pulse tab is in the background (Page Visibility). For Meet/Teams, use “Always on top” (Chrome/Edge) or tile windows.";

const HELP_PIP =
  "Document Picture-in-Picture: OS-level always-on-top mini window (Chrome 116+ / Edge). Safari not supported.";

function isDocumentPiPSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "documentPictureInPicture" in window &&
    typeof (
      window as unknown as {
        documentPictureInPicture?: { requestWindow?: unknown };
      }
    ).documentPictureInPicture?.requestWindow === "function"
  );
}

function pipWindowDimensions(): { width: number; height: number } {
  if (typeof window === "undefined") return { width: 400, height: 720 };
  const width = Math.max(320, Math.min(window.innerWidth, 1920));
  const height = Math.max(400, Math.min(window.innerHeight, 1200));
  return { width, height };
}

export interface FloatingPulseHudProps {
  onClose?: () => void;
  transcriptPreview: TranscriptItem[];
  transcriptStatus?: TranscriptStreamStatus;
  prompts: PromptSuggestion[];
  onPromptUse?: (promptId: string) => void;
  onPromptDismiss?: (promptId: string) => void;
  quickTags: TagOption[];
  tagShortcutPalette?: TagOption[];
  quickTagAnchorTranscriptId?: string | null;
  onQuickTag?: (tagId: string, transcriptIdOverride?: string) => void;
  voiceActive?: boolean;
  onVoiceToggle?: () => void;
  onSendChunk?: (payload: { text: string; speakerId: string }) => boolean;
  sendChunkDisabled?: boolean;
  getDefaultSpeakerId?: () => string;
  composerLine: string;
  onComposerLineChange: (value: string) => void;
  onSpeakerChange?: (speakerId: string) => void;
  sessionTitle?: string;
  sessionId?: string;
  onSystemAudioStart?: () => Promise<void> | void;
  transcribing?: boolean;
  notes?: SessionNote[];
  availableTags?: TagOption[];
  transcriptTags?: TranscriptTag[];
  onNotesChange?: (notes: SessionNote[]) => void;
  onNoteAdd?: () => void;
  onNoteDelete?: (noteId: string) => void;
  onNoteSave?: (note: SessionNote) => void;
  onNoteCommit?: (note: SessionNote) => void;
  onNoteTagAdd?: (noteId: string, tagId: string) => void;
  onNoteTagRemove?: (noteId: string, tagId: string) => void;
}

export function FloatingPulseHud(props: FloatingPulseHudProps) {
  const {
    onClose,
    transcriptPreview,
    transcriptStatus,
    prompts,
    onPromptUse,
    onPromptDismiss,
    quickTags,
    tagShortcutPalette,
    quickTagAnchorTranscriptId,
    onQuickTag,
    voiceActive = false,
    onVoiceToggle,
    onSendChunk,
    sendChunkDisabled = true,
    getDefaultSpeakerId,
    composerLine,
    onComposerLineChange,
    onSpeakerChange,
    sessionTitle,
    sessionId,
    onSystemAudioStart,
    transcribing = false,
    notes = [],
    availableTags = [],
    transcriptTags = [],
    onNotesChange,
    onNoteAdd,
    onNoteDelete,
    onNoteSave,
    onNoteCommit,
    onNoteTagAdd,
    onNoteTagRemove,
  } = props;

  const theme = useTheme();
  const tabBackgrounded = useTabBackgrounded();
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [pipError, setPipError] = useState<string | null>(null);

  const pipRootRef = useRef<Root | null>(null);
  const pipCacheRef = useRef<EmotionCache | null>(null);
  const pipMountRef = useRef<HTMLDivElement | null>(null);
  const pipWinRef = useRef<Window | null>(null);
  const closePipRef = useRef<(() => void) | null>(null);

  const {
    acceptedMessages,
    dismissedPromptIds,
    handleHudPromptAccept,
    handleHudPromptDismissId,
  } = useHudAcceptedPromptState(sessionId, onPromptUse, onPromptDismiss);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    pipWinRef.current = pipWindow;
  }, [pipWindow]);

  useEffect(() => {
    if (!tabBackgrounded) {
      setDismissed(false);
    }
  }, [tabBackgrounded]);

  const closePip = useCallback(() => {
    try {
      pipRootRef.current?.unmount();
    } catch (err) {
      console.warn("[FloatingPulseHud] pipRoot unmount failed", err);
    }
    pipRootRef.current = null;
    pipCacheRef.current = null;
    if (pipMountRef.current?.isConnected) pipMountRef.current.remove();
    pipMountRef.current = null;
    try {
      pipWinRef.current?.close();
    } catch (err) {
      console.warn("[FloatingPulseHud] pip window close failed", err);
    }
    pipWinRef.current = null;
    setPipWindow(null);
  }, []);
  closePipRef.current = closePip;

  const handleDismiss = useCallback(() => {
    closePip();
    setDismissed(true);
    onClose?.();
  }, [closePip, onClose]);

  const openDocumentPip = useCallback(async () => {
    setPipError(null);
    const api = (
      window as unknown as {
        documentPictureInPicture?: {
          requestWindow: (o?: {
            width?: number;
            height?: number;
          }) => Promise<Window>;
        };
      }
    ).documentPictureInPicture;
    if (!api?.requestWindow) {
      setPipError(
        "Document Picture-in-Picture is not available in this browser.",
      );
      return;
    }
    try {
      const { width, height } = pipWindowDimensions();
      const win = await api.requestWindow({ width, height });
      seedPictureInPictureDocument(document, win.document);
      win.document.documentElement.style.height = "100%";
      win.document.body.style.margin = "0";
      win.document.body.style.minHeight = "100%";
      win.document.body.style.height = "100%";
      win.document.documentElement.style.backgroundColor =
        theme.palette.grey[900];
      win.document.body.style.backgroundColor = theme.palette.grey[900];
      setPipWindow(win);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        "[FloatingPulseHud] documentPictureInPicture.requestWindow failed",
        e,
      );
      setPipError(
        msg ||
          "Could not open Picture-in-Picture. Use Chrome/Edge over HTTPS, and try clicking the button directly (not through an extension menu).",
      );
    }
  }, [theme]);

  const panelCommon = useMemo(
    () => ({
      transcriptPreview,
      transcriptStatus,
      prompts,
      quickTags,
      tagShortcutPalette,
      quickTagAnchorTranscriptId,
      onQuickTag,
      voiceActive,
      onVoiceToggle,
      onSendChunk,
      sendChunkDisabled,
      getDefaultSpeakerId,
      composerLine,
      onComposerLineChange,
      onSpeakerChange,
      sessionTitle,
      sessionId,
      onClose: handleDismiss,
      notes,
      availableTags,
      transcriptTags,
      onNotesChange,
      onNoteAdd,
      onNoteDelete,
      onNoteSave,
      onNoteCommit,
      onNoteTagAdd,
      onNoteTagRemove,
      acceptedMessages,
      dismissedPromptIds,
      onHudPromptAccept: handleHudPromptAccept,
      onHudPromptDismissId: handleHudPromptDismissId,
    }),
    [
      transcriptPreview,
      transcriptStatus,
      prompts,
      quickTags,
      tagShortcutPalette,
      quickTagAnchorTranscriptId,
      onQuickTag,
      voiceActive,
      onVoiceToggle,
      onSendChunk,
      sendChunkDisabled,
      getDefaultSpeakerId,
      composerLine,
      onComposerLineChange,
      onSpeakerChange,
      sessionTitle,
      sessionId,
      handleDismiss,
      notes,
      availableTags,
      transcriptTags,
      onNotesChange,
      onNoteAdd,
      onNoteDelete,
      onNoteSave,
      onNoteCommit,
      onNoteTagAdd,
      onNoteTagRemove,
      acceptedMessages,
      dismissedPromptIds,
      handleHudPromptAccept,
      handleHudPromptDismissId,
    ],
  );

  useLayoutEffect(() => {
    if (!pipWindow) return undefined;

    const doc = pipWindow.document;
    pipCacheRef.current = createCache({
      key: "pulse-pip",
      prepend: true,
      container: doc.head,
    });
    const mount = doc.createElement("div");
    mount.id = "pulse-pip-root";
    mount.style.width = "100%";
    mount.style.height = "100%";
    mount.style.minHeight = "100%";
    doc.body.append(mount);
    pipMountRef.current = mount;
    pipRootRef.current = createRoot(mount);

    const onPageHide = () => closePipRef.current?.();
    pipWindow.addEventListener("pagehide", onPageHide);

    return () => {
      pipWindow.removeEventListener("pagehide", onPageHide);
      try {
        pipRootRef.current?.unmount();
      } catch (err) {
        console.warn("[FloatingPulseHud] pipRoot cleanup unmount failed", err);
      }
      pipRootRef.current = null;
      pipCacheRef.current = null;
      mount.remove();
      pipMountRef.current = null;
    };
  }, [pipWindow]);

  useLayoutEffect(() => {
    if (!pipWindow || !pipRootRef.current || !pipCacheRef.current) return;
    pipRootRef.current.render(
      <CacheProvider value={pipCacheRef.current}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <FloatingPulseHudPanel
            {...panelCommon}
            visible
            layout="pip"
            helpText={HELP_PIP}
            showPipLaunch={false}
            keyboardTargetWindow={pipWindow}
          />
        </ThemeProvider>
      </CacheProvider>,
    );
  }, [pipWindow, theme, panelCommon]);

  const [interviewStarting, setInterviewStarting] = useState(false);

  const pipOk = isDocumentPiPSupported();
  const isElectron = typeof window !== "undefined" && "api" in window;
  const showStartButton =
    mounted && !tabBackgrounded && !pipWindow && (pipOk || isElectron);

  const handleStartInterview = useCallback(async () => {
    setInterviewStarting(true);
    try {
      await onSystemAudioStart?.();
      if (isElectron) {
        void window.api?.startInterview();
      } else {
        await openDocumentPip();
      }
    } finally {
      setInterviewStarting(false);
    }
  }, [onSystemAudioStart, isElectron, openDocumentPip]);

  const mainFloatVisible =
    mounted && tabBackgrounded && !pipWindow && !dismissed;

  return createPortal(
    <>
      {mainFloatVisible ? (
        <FloatingPulseHudPanel
          {...panelCommon}
          visible
          layout="embed"
          helpText={HELP_PAGE}
          showPipLaunch
          pipSupported={pipOk}
          onRequestDocumentPip={() => void openDocumentPip()}
        />
      ) : null}

      {showStartButton ? (
        <Button
          variant="contained"
          size="medium"
          startIcon={
            interviewStarting || transcribing ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <PlayArrowRoundedIcon />
            )
          }
          disabled={interviewStarting}
          onClick={() => void handleStartInterview()}
          sx={{
            position: "fixed",
            right: 20,
            bottom: 20,
            zIndex: 1000,
            borderRadius: "100px",
            fontWeight: 700,
            textTransform: "none",
            fontSize: "0.9375rem",
            letterSpacing: "0.01em",
            cursor: interviewStarting ? "not-allowed" : "pointer",
            px: 3,
            py: 1.25,
            background: (t) =>
              `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.secondary.main} 100%)`,
            color: (t) => t.palette.primary.contrastText,
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: (t) =>
              `0 4px 24px ${alpha(t.palette.primary.main, 0.4)}, 0 1px 4px ${alpha(t.palette.common.black, 0.3)}`,
            transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
            "&:hover": {
              background: (t) =>
                `linear-gradient(135deg, ${t.palette.primary.dark} 0%, ${t.palette.secondary.dark} 100%)`,
              boxShadow: (t) =>
                `0 8px 32px ${alpha(t.palette.primary.main, 0.65)}, 0 2px 8px ${alpha(t.palette.common.black, 0.35)}`,
              transform: "translateY(-1px)",
            },
            "&:active": {
              transform: "translateY(0)",
              boxShadow: (t) =>
                `0 4px 16px ${alpha(t.palette.primary.main, 0.4)}`,
            },
          }}
        >
          {transcribing ? "Transcribing…" : "Start Interview"}
        </Button>
      ) : null}

      <Snackbar
        open={Boolean(pipError)}
        autoHideDuration={12_000}
        onClose={() => setPipError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="warning"
          variant="filled"
          onClose={() => setPipError(null)}
          sx={{ width: "100%", maxWidth: 480 }}
        >
          {pipError}
        </Alert>
      </Snackbar>
    </>,
    document.body,
  );
}
