import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  getFloatingHudTokens,
} from "@/app/providers/theme";
import AddIcon from "@mui/icons-material/Add";
import PictureInPictureAltOutlinedIcon from "@mui/icons-material/PictureInPictureAltOutlined";
import type { TranscriptItem } from "@/modules/transcript/types";
import type { TranscriptStreamStatus } from "@/modules/transcript/types";
import type { PromptSuggestion } from "@/modules/prompts/types";
import type { TagOption, TranscriptTag } from "@/modules/tagging/types";
import type { SessionNote } from "@/modules/context/types";
import {
  formatCtrlShortcut,
  indexForPaletteDigit,
  paletteDigitForTag,
} from "@/modules/tagging/utils/paletteShortcut";
import { tagChipOutlinedRestSx } from "@/modules/tagging/utils/tagChipStyles";
import { formatClock } from "@/shared/utils/formatters";
import { isIntervieweeSpeaker } from "@/modules/transcript/utils/interviewRoles";
import {
  HudSuggestionsTab,
  type AcceptedMsg,
  type PendingMsg,
  type TimelineRow,
} from "./HudSuggestionsTab";
import { HudComposerBar } from "./HudComposerBar";
import { HudNotesTab } from "./HudNotesTab";
import {
  claimFloatingHudTagDigitShortcuts,
  releaseFloatingHudTagDigitShortcuts,
} from "./floatingHudDigitShortcutOwnership";
import { transcriptLineHasCatalogTag } from "@/modules/tagging/utils/transcriptTagDedupe";

export const FLOATING_HUD_WIDTH = 300;

const Z_FLOAT = 10050;
type HudLayout = "embed" | "pip";
type TabKey = "suggestions" | "capture" | "notes" | "speaker";

function resolveHudQuickTagTranscriptId(
  preview: TranscriptItem[],
  prompts: PromptSuggestion[],
): string | undefined {
  for (let i = preview.length - 1; i >= 0; i--) {
    if (isIntervieweeSpeaker(preview[i].speakerId)) return preview[i].id;
  }
  const prompt = prompts.length > 0 ? prompts[prompts.length - 1] : undefined;
  if (prompt) {
    const ids: string[] = [];
    const single = String(prompt.transcriptId ?? "").trim();
    if (single) ids.push(single);
    for (const raw of prompt.transcriptIds ?? []) {
      const id = String(raw ?? "").trim();
      if (id && !ids.includes(id)) ids.push(id);
    }
    const idxById = new Map(preview.map((t, j) => [t.id, j]));
    let bestId: string | undefined;
    let bestJ = -1;
    for (const id of ids) {
      const j = idxById.get(id);
      if (j !== undefined && j > bestJ) {
        bestJ = j;
        bestId = id;
      }
    }
    if (bestId) return bestId;
  }
  return preview.at(-1)?.id;
}

function resolveHudQuickTagTargetTranscriptId(
  activeTab: TabKey,
  preview: TranscriptItem[],
  prompts: PromptSuggestion[],
  anchorTranscriptId: string | null | undefined,
): string | undefined {
  if (activeTab === "suggestions") {
    return resolveHudQuickTagTranscriptId(preview, prompts);
  }
  const anchor = String(anchorTranscriptId ?? "").trim();
  if (anchor) return anchor;
  return resolveHudQuickTagTranscriptId(preview, prompts);
}

function isTextualFieldTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

function LiveSessionDot({ color }: { color: string }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        bgcolor: color,
        flexShrink: 0,
        boxShadow: `0 0 0 2px ${alpha(color, 0.28)}`,
        "@keyframes livePulse": {
          "0%, 100%": { opacity: 1, transform: "scale(1)" },
          "50%": { opacity: 0.55, transform: "scale(0.82)" },
        },
        animation: "livePulse 1.8s ease-in-out infinite",
      }}
    />
  );
}

export interface FloatingPulseHudPanelProps {
  visible: boolean;
  layout: HudLayout;
  helpText: string;
  showPipLaunch?: boolean;
  onRequestDocumentPip?: () => void;
  pipSupported?: boolean;
  onClose?: () => void;
  transcriptPreview: TranscriptItem[];
  transcriptStatus?: TranscriptStreamStatus;
  composerLine: string;
  onComposerLineChange: (value: string) => void;
  prompts: PromptSuggestion[];
  acceptedMessages: AcceptedMsg[];
  dismissedPromptIds: Set<string>;
  onHudPromptAccept: (prompt: PromptSuggestion) => void;
  onHudPromptDismissId: (promptId: string) => void;
  quickTags: TagOption[];
  tagShortcutPalette?: TagOption[];
  keyboardTargetWindow?: Window;
  quickTagAnchorTranscriptId?: string | null;
  onQuickTag?: (tagId: string, transcriptIdOverride?: string) => void;
  voiceActive?: boolean;
  onVoiceToggle?: () => void;
  onSendChunk?: (payload: { text: string; speakerId: string }) => boolean;
  sendChunkDisabled?: boolean;
  getDefaultSpeakerId?: () => string;
  onSpeakerChange?: (speakerId: string) => void;
  sessionTitle?: string;
  sessionId?: string;
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

export const FloatingPulseHudPanel = memo(function FloatingPulseHudPanel({
  visible,
  layout,
  helpText: _helpText,
  showPipLaunch,
  onRequestDocumentPip,
  pipSupported,
  onClose: _onClose,
  transcriptPreview,
  transcriptStatus,
  composerLine = "",
  onComposerLineChange,
  prompts,
  acceptedMessages,
  dismissedPromptIds,
  onHudPromptAccept,
  onHudPromptDismissId,
  quickTags,
  tagShortcutPalette,
  keyboardTargetWindow,
  quickTagAnchorTranscriptId,
  onQuickTag,
  voiceActive = false,
  onVoiceToggle,
  onSendChunk,
  sendChunkDisabled = true,
  getDefaultSpeakerId,
  onSpeakerChange,
  sessionTitle,
  sessionId,
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
}: FloatingPulseHudPanelProps) {
  const theme = useTheme();
  const hud = useMemo(() => getFloatingHudTokens(theme), [theme]);

  const [activeTab, setActiveTab] = useState<TabKey>("suggestions");
  const [rejectingIds, setRejectingIds] = useState<Set<string>>(() => new Set());
  const [pendingMessages, setPendingMessages] = useState<PendingMsg[]>([]);

  const suggestionsScrollRef = useRef<HTMLDivElement>(null);
  const speakerScrollRef = useRef<HTMLDivElement>(null);

  const scrollSpeakerFeedToBottom = useCallback(() => {
    const el = speakerScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const transcriptLoading =
    transcriptStatus === "connecting" || transcriptStatus === "reconnecting";
  const isPip = layout === "pip";

  const tagShortcutPaletteResolved = useMemo(
    () =>
      tagShortcutPalette && tagShortcutPalette.length > 0
        ? tagShortcutPalette
        : quickTags,
    [tagShortcutPalette, quickTags],
  );

  const captureFeedSorted = useMemo(() => {
    if (!transcriptTags.length) return [];
    return [...transcriptTags]
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 25);
  }, [transcriptTags]);

  useLayoutEffect(() => {
    if (!visible || !onQuickTag || !tagShortcutPaletteResolved.length) return;
    claimFloatingHudTagDigitShortcuts();
    return () => {
      releaseFloatingHudTagDigitShortcuts();
    };
  }, [visible, onQuickTag, tagShortcutPaletteResolved.length]);

  const sessionHeading = useMemo(() => {
    const title = sessionTitle?.trim();
    if (title) return title;
    const id = sessionId?.trim();
    return id ?? "";
  }, [sessionTitle, sessionId]);

  const sessionHeadingTooltip = useMemo(() => {
    const id = sessionId?.trim();
    const title = sessionTitle?.trim();
    if (title && id && title !== id) return `${title} · ${id}`;
    return sessionHeading;
  }, [sessionHeading, sessionTitle, sessionId]);

  const visiblePrompts = useMemo(
    () => prompts.filter((p) => !dismissedPromptIds.has(p.id)),
    [prompts, dismissedPromptIds],
  );

  const displayTranscriptPreview = useMemo(() => {
    const normalize = (text: string) =>
      text.trim().toLowerCase().replace(/\s+/g, " ");

    return transcriptPreview.filter((item) => {
      if (!String(item.id ?? "").startsWith("client-pending:")) return true;
      const text = normalize(String(item.text ?? ""));

      if (!text) return true;
      const speaker = normalize(String(item.speakerId ?? ""));
      const ts = Date.parse(item.timestamp);

      return !transcriptPreview.some((other) => {
        if (other.id === item.id) return false;
        if (String(other.id ?? "").startsWith("client-pending:")) return false;

        const otherText = normalize(String(other.text ?? ""));

        if (!otherText || otherText !== text) return false;

        const otherSpeaker = normalize(String(other.speakerId ?? ""));

        if (speaker && otherSpeaker && speaker !== otherSpeaker) return false;

        const otherTs = Date.parse(other.timestamp);

        if (Number.isNaN(ts) || Number.isNaN(otherTs)) return true;

        return Math.abs(otherTs - ts) <= 20_000;
      });
    });
  }, [transcriptPreview]);

  const transcriptScrollSig = useMemo(() => {
    const n = displayTranscriptPreview.length;
    const last = n ? displayTranscriptPreview[n - 1] : null;
    const tail = last
      ? `${last.id}:${last.timestamp}:${String(last.text ?? "")}`
      : "";
    return `${n}:${tail}`;
  }, [displayTranscriptPreview]);

  const suggestionsScrollSig = useMemo(
    () =>
      [
        transcriptScrollSig,
        String(acceptedMessages.length),
        String(pendingMessages.length),
        String(visiblePrompts.length),
        String(rejectingIds.size),
        visiblePrompts
          .map((p) => `${p.id}:${p.title?.length ?? 0}:${p.body?.length ?? 0}`)
          .join("|"),
        transcriptLoading ? "1" : "0",
      ].join("~"),
    [
      transcriptScrollSig,
      acceptedMessages.length,
      pendingMessages.length,
      visiblePrompts,
      rejectingIds.size,
      transcriptLoading,
    ],
  );

  useLayoutEffect(() => {
    if (activeTab !== "suggestions") return;
    const el = suggestionsScrollRef.current;
    if (!el) return;
    const scrollBottom = () => { el.scrollTop = el.scrollHeight; };
    scrollBottom();
    const id = requestAnimationFrame(scrollBottom);
    const t = window.setTimeout(scrollBottom, 40);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(t);
    };
  }, [activeTab, suggestionsScrollSig]);

  useLayoutEffect(() => {
    if (activeTab !== "speaker") return;
    scrollSpeakerFeedToBottom();
    const id = requestAnimationFrame(scrollSpeakerFeedToBottom);
    const t = window.setTimeout(scrollSpeakerFeedToBottom, 40);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(t);
    };
  }, [activeTab, transcriptScrollSig, scrollSpeakerFeedToBottom]);

  const handlePromptAccept = useCallback(
    (prompt: PromptSuggestion) => {
      onHudPromptAccept(prompt);
    },
    [onHudPromptAccept],
  );

  const handlePromptReject = useCallback(
    (id: string) => {
      setRejectingIds((prev) => new Set([...prev, id]));
      setTimeout(() => {
        onHudPromptDismissId(id);
        setRejectingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 210);
    },
    [onHudPromptDismissId],
  );

  useEffect(() => {
    if (!pendingMessages.length || !displayTranscriptPreview.length) return;
    setPendingMessages((prev) =>
      prev.filter((pending) => {
        const pText = String(pending.text ?? "").trim().toLowerCase();
        const pSpeaker = String(pending.speakerId ?? "").trim().toLowerCase();
        const pMs = Date.parse(pending.timestamp);
        return !displayTranscriptPreview.some((item) => {
          const iText = String(item.text ?? "").trim().toLowerCase();
          const iSpeaker = String(item.speakerId ?? "").trim().toLowerCase();
          if (!pText || !iText || pText !== iText) return false;
          if (pSpeaker && iSpeaker && pSpeaker !== iSpeaker) return false;
          const iMs = Date.parse(item.timestamp);
          if (Number.isNaN(pMs) || Number.isNaN(iMs)) return true;
          return Math.abs(iMs - pMs) <= 20_000;
        });
      }),
    );
  }, [pendingMessages.length, displayTranscriptPreview]);

  useEffect(() => {
    if (!pendingMessages.length) return;
    const now = Date.now();
    setPendingMessages((prev) =>
      prev.filter((pending) => {
        const ts = Date.parse(pending.timestamp);
        if (Number.isNaN(ts)) return false;
        return now - ts < 90_000;
      }),
    );
  }, [pendingMessages.length]);

  const canAddHudNote = useMemo(() => !notes.some((n) => n.isDraft), [notes]);

  const handleHudHeaderAddNote = useCallback(() => {
    setActiveTab("notes");
    if (!notes.some((n) => n.isDraft)) onNoteAdd?.();
  }, [notes, onNoteAdd]);

  const mergedConversationTimeline = useMemo(() => {
    const parseMs = (ts: string) => {
      const ms = Date.parse(ts);
      return Number.isNaN(ms) ? 0 : ms;
    };

    const orderedTx = [...displayTranscriptPreview].sort((a, b) => {
      const d = parseMs(a.timestamp) - parseMs(b.timestamp);
      if (d !== 0) return d;
      return a.id.localeCompare(b.id);
    });

    const rows: TimelineRow[] = [];
    const txIndexById = new Map<string, number>();
    orderedTx.forEach((t, i) => txIndexById.set(t.id, i));

    const acceptedByAnchor = new Map<string, AcceptedMsg[]>();
    const unanchoredAccepted: AcceptedMsg[] = [];

    for (const msg of acceptedMessages) {
      const ids: string[] = [];
      const single = String(msg.transcriptId ?? "").trim();
      if (single) ids.push(single);
      for (const raw of msg.transcriptIds ?? []) {
        const id = String(raw ?? "").trim();
        if (id && !ids.includes(id)) ids.push(id);
      }

      let anchorId: string | null = null;
      let anchorIdx = -1;
      for (const id of ids) {
        const idx = txIndexById.get(id);
        if (idx !== undefined && idx > anchorIdx) {
          anchorIdx = idx;
          anchorId = id;
        }
      }

      if (!anchorId) {
        unanchoredAccepted.push(msg);
        continue;
      }
      const batch = acceptedByAnchor.get(anchorId);
      if (batch) batch.push(msg);
      else acceptedByAnchor.set(anchorId, [msg]);
    }

    for (const item of orderedTx) {
      rows.push({ kind: "transcript", id: `tx-${item.id}`, item });
      const anchoredAccepted = [...(acceptedByAnchor.get(item.id) ?? [])].sort(
        (a, b) => {
          const d = parseMs(a.timestamp) - parseMs(b.timestamp);
          return d !== 0 ? d : a.id.localeCompare(b.id);
        },
      );
      for (const msg of anchoredAccepted) {
        rows.push({ kind: "accepted", id: msg.id, msg });
      }
    }

    const normalize = (text: string) =>
      text.trim().toLowerCase().replace(/\s+/g, " ");
    const pendingForTimeline = pendingMessages.filter((msg) => {
      const mText = normalize(String(msg.text ?? ""));
      if (!mText) return false;
      const mSpeaker = normalize(String(msg.speakerId ?? ""));
      const mTs = Date.parse(msg.timestamp);
      return !orderedTx.some((item) => {
        const iText = normalize(String(item.text ?? ""));
        if (!iText || iText !== mText) return false;
        const iSpeaker = normalize(String(item.speakerId ?? ""));
        if (mSpeaker && iSpeaker && mSpeaker !== iSpeaker) return false;
        const iTs = Date.parse(item.timestamp);
        if (Number.isNaN(mTs) || Number.isNaN(iTs)) return true;
        return Math.abs(iTs - mTs) <= 20_000;
      });
    });

    const extras: TimelineRow[] = [
      ...unanchoredAccepted.map((msg) => ({ kind: "accepted" as const, id: msg.id, msg })),
      ...pendingForTimeline.map((msg) => ({ kind: "pending" as const, id: msg.id, msg })),
    ].sort((a, b) => {
      const d =
        parseMs("msg" in a ? a.msg.timestamp : "") -
        parseMs("msg" in b ? b.msg.timestamp : "");
      return d !== 0 ? d : a.id.localeCompare(b.id);
    });

    const rowTime = (row: TimelineRow) => {
      if (row.kind === "transcript") return parseMs(row.item.timestamp);
      return parseMs(row.msg.timestamp);
    };

    for (const extra of extras) {
      const t = rowTime(extra);
      let insertAt = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rowTime(rows[i]) <= t) {
          insertAt = i + 1;
          break;
        }
      }
      rows.splice(insertAt, 0, extra);
    }

    return rows;
  }, [displayTranscriptPreview, acceptedMessages, pendingMessages]);

  const orderedSuggestions = useMemo(() => {
    const parseMs = (ts: string) => {
      const ms = Date.parse(ts);
      return Number.isNaN(ms) ? 0 : ms;
    };
    const txIndexById = new Map<string, number>();
    displayTranscriptPreview.forEach((t, i) => txIndexById.set(t.id, i));

    const anchorIndex = (prompt: PromptSuggestion) => {
      const ids: string[] = [];
      const single = String(prompt.transcriptId ?? "").trim();
      if (single) ids.push(single);
      for (const raw of prompt.transcriptIds ?? []) {
        const id = String(raw ?? "").trim();
        if (id && !ids.includes(id)) ids.push(id);
      }
      let best = Number.MAX_SAFE_INTEGER;
      for (const id of ids) {
        const idx = txIndexById.get(id);
        if (idx !== undefined && idx < best) best = idx;
      }
      return best;
    };

    return [...visiblePrompts].sort((a, b) => {
      const aIdx = anchorIndex(a);
      const bIdx = anchorIndex(b);
      if (aIdx !== bIdx) return aIdx - bIdx;
      const d = parseMs(a.timestamp) - parseMs(b.timestamp);
      return d !== 0 ? d : a.id.localeCompare(b.id);
    });
  }, [visiblePrompts, displayTranscriptPreview]);

  const latestMessageSuggestions = useMemo(() => {
    const latest = displayTranscriptPreview.at(-1);
    if (!latest) return orderedSuggestions;
    const anchored = orderedSuggestions.filter((prompt) => {
      const ids = new Set<string>();
      const single = String(prompt.transcriptId ?? "").trim();
      if (single) ids.add(single);
      for (const raw of prompt.transcriptIds ?? []) {
        const id = String(raw ?? "").trim();
        if (id) ids.add(id);
      }
      return ids.has(latest.id);
    });
    if (anchored.length) return anchored;
    const parseMs = (ts: string) => {
      const ms = Date.parse(ts);
      return Number.isNaN(ms) ? 0 : ms;
    };
    const latestPromptMs = orderedSuggestions.reduce(
      (acc, p) => Math.max(acc, parseMs(p.timestamp)),
      0,
    );
    return orderedSuggestions.filter(
      (p) => parseMs(p.timestamp) >= latestPromptMs,
    );
  }, [displayTranscriptPreview, orderedSuggestions]);

  const quickTagTargetTranscriptId = useMemo(
    () =>
      resolveHudQuickTagTargetTranscriptId(
        activeTab,
        displayTranscriptPreview,
        latestMessageSuggestions,
        quickTagAnchorTranscriptId,
      ),
    [
      activeTab,
      displayTranscriptPreview,
      latestMessageSuggestions,
      quickTagAnchorTranscriptId,
    ],
  );

  const suggestionsLoading = useMemo(() => {
    if (transcriptStatus !== "connected") return transcriptLoading;
    const tail = displayTranscriptPreview.at(-1);
    if (!tail) return false;

    const parseMs = (ts: string) => {
      const ms = Date.parse(ts);
      return Number.isNaN(ms) ? 0 : ms;
    };
    const tailMs = parseMs(tail.timestamp);

    // AI follow-ups are generated for interviewee (mic) lines; do not spin after interviewer-only tail.
    if (!isIntervieweeSpeaker(tail.speakerId)) {
      return transcriptLoading;
    }

    const idsForTranscriptRef = (single: string | undefined, list: string[] | undefined) => {
      const ids = new Set<string>();
      const one = String(single ?? "").trim();
      if (one) ids.add(one);
      for (const raw of list ?? []) {
        const id = String(raw ?? "").trim();
        if (id) ids.add(id);
      }
      return ids;
    };

    const promptRefsTail = (p: PromptSuggestion) =>
      idsForTranscriptRef(p.transcriptId, p.transcriptIds).has(tail.id);

    const acceptedRefsTail = (a: AcceptedMsg) =>
      idsForTranscriptRef(a.transcriptId, a.transcriptIds).has(tail.id);

    const anchoredToTail = prompts.filter((p) => promptRefsTail(p));
    if (!anchoredToTail.length) {
      return transcriptLoading;
    }

    let resolvedMs = 0;
    for (const p of visiblePrompts) {
      if (promptRefsTail(p)) resolvedMs = Math.max(resolvedMs, parseMs(p.timestamp));
    }
    for (const a of acceptedMessages) {
      if (acceptedRefsTail(a)) {
        // Accept dismisses the prompt; treat the line as handled even if prompt.timestamp < transcript (ordering skew).
        resolvedMs = Math.max(resolvedMs, parseMs(a.timestamp), tailMs);
      }
    }

    const allAnchoredHandled = anchoredToTail.every(
      (p) =>
        dismissedPromptIds.has(p.id) ||
        acceptedMessages.some((a) => a.id === `accepted-${p.id}`),
    );
    if (allAnchoredHandled && resolvedMs < tailMs) {
      resolvedMs = tailMs;
    }

    return transcriptLoading || resolvedMs < tailMs;
  }, [
    transcriptStatus,
    transcriptLoading,
    displayTranscriptPreview,
    visiblePrompts,
    acceptedMessages,
    prompts,
    dismissedPromptIds,
  ]);

  useEffect(() => {
    if (!visible || !onQuickTag) return;
    const tags = tagShortcutPaletteResolved;
    if (!tags.length) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.shiftKey || e.altKey || e.metaKey || e.repeat) return;
      const digit = e.key.length === 1 && /^[0-9]$/.test(e.key) ? e.key : null;
      if (!digit) return;
      const idx = indexForPaletteDigit(tags, digit);
      if (idx < 0) return;
      if (isTextualFieldTarget(e.target)) return;
      const tag = tags[idx];
      if (!tag) return;

      const previewSnap = displayTranscriptPreview;
      const promptsSnap = latestMessageSuggestions;
      const transcriptOverride = resolveHudQuickTagTargetTranscriptId(
        activeTab,
        previewSnap,
        promptsSnap,
        quickTagAnchorTranscriptId,
      );
      if (
        transcriptOverride &&
        transcriptLineHasCatalogTag(transcriptTags, transcriptOverride, tag.id)
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const runTag = () => {
        onQuickTag(tag.id, transcriptOverride);
      };

      if (activeTab !== "capture") {
        setActiveTab("capture");
        window.setTimeout(runTag, 0);
      } else {
        runTag();
      }
    };

    const hostWin =
      keyboardTargetWindow ??
      (typeof window !== "undefined" ? window : null);
    if (!hostWin) return;

    hostWin.addEventListener("keydown", onKeyDown, true);
    return () => hostWin.removeEventListener("keydown", onKeyDown, true);
  }, [
    visible,
    onQuickTag,
    tagShortcutPaletteResolved,
    keyboardTargetWindow,
    quickTagAnchorTranscriptId,
    activeTab,
    displayTranscriptPreview,
    latestMessageSuggestions,
  ]);

  const rootSx = isPip
    ? {
        position: "absolute" as const,
        inset: 0,
        width: "100%",
        height: "100%",
        minHeight: 0,
        zIndex: Z_FLOAT,
        pointerEvents: visible ? ("auto" as const) : ("none" as const),
        isolation: "isolate" as const,
      }
    : {
        position: "fixed" as const,
        right: { xs: 8, sm: 16 },
        bottom: "max(16px, env(safe-area-inset-bottom, 0px))",
        width: { xs: "calc(100vw - 16px)", sm: FLOATING_HUD_WIDTH },
        maxWidth: { xs: "100vw", sm: "calc(100vw - 24px)" },
        maxHeight: "min(640px, calc(100vh - 32px))",
        zIndex: Z_FLOAT,
        pointerEvents: visible ? ("auto" as const) : ("none" as const),
        isolation: "isolate" as const,
      };

  const glassBg = hud.glassBg;
  const glassBorder = hud.glassBorder;

  return (
    <Box
      role="region"
      aria-label="Pulse floating live HUD"
      aria-hidden={!visible}
      data-floating-hud="true"
      onClick={(e) => e.stopPropagation()}
      sx={rootSx}
    >
      <Box
        sx={{
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1) translateY(0)" : "scale(0.96) translateY(6px)",
          transition: "opacity 240ms ease, transform 240ms ease",
          borderRadius: isPip ? 0 : "16px",
          overflow: "hidden",
          bgcolor: glassBg,
          backgroundImage: isPip
            ? "none"
            : `linear-gradient(160deg, ${alpha(theme.palette.common.white, 0.055)} 0%, transparent 50%)`,
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          border: isPip ? "none" : `1px solid ${glassBorder}`,
          boxShadow: isPip ? "none" : hud.embedShadow,
          height: "100%",
          maxHeight: isPip ? "100%" : "min(640px, calc(100vh - 32px))",
          display: "flex",
          flexDirection: "column",
          fontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,
        }}
      >
        <Box
          sx={{
            flexShrink: 0,
            display: "flex",
            flexDirection: "row",
            alignItems: "stretch",
            borderBottom: `1px solid ${glassBorder}`,
            bgcolor: alpha(theme.palette.common.black, 0.2),
            minHeight: 42,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, v: TabKey) => setActiveTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 42,
              px: 0.5,
              "& .MuiTab-root": {
                minHeight: 42,
                py: 0.75,
                px: 1.25,
                fontSize: "0.72rem",
                textTransform: "none",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                color: hud.low,
                transition: "color 160ms ease, background-color 160ms ease",
                borderRadius: "10px",
                mx: 0.2,
                "&:hover": { color: hud.hi, bgcolor: alpha(theme.palette.common.white, 0.06), borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
                "&.Mui-selected": { color: hud.hi, fontWeight: 600 },
              },
              "& .MuiTabs-indicator": { bgcolor: hud.accentMain, height: 2, borderRadius: 2 },
              "& .MuiTabScrollButton-root": { color: hud.mid, "&.Mui-disabled": { opacity: 0.3 } },
            }}
          >
            <Tab
              value="suggestions"
              label={
                <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 0.5 }}>
                  Live feed
                  {visiblePrompts.length > 0 && (
                    <Box sx={{ minWidth: 16, height: 16, borderRadius: "999px", bgcolor: hud.accentMain, color: hud.contrastOnAccent, fontSize: "0.55rem", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", px: 0.5 }}>
                      {visiblePrompts.length}
                    </Box>
                  )}
                </Stack>
              }
            />
            <Tab value="capture" label="Capture" />
            <Tab
              value="notes"
              label={
                <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 0.5 }}>
                  Session notes
                  {notes.length > 0 && (
                    <Box sx={{ minWidth: 16, height: 16, borderRadius: "999px", bgcolor: alpha(theme.palette.common.white, 0.12), color: hud.hi, fontSize: "0.55rem", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", px: 0.5 }}>
                      {notes.length}
                    </Box>
                  )}
                </Stack>
              }
            />
            <Tab
              value="speaker"
              label="Speaker"
              onClick={() => {
                scrollSpeakerFeedToBottom();
                window.setTimeout(scrollSpeakerFeedToBottom, 0);
                window.setTimeout(scrollSpeakerFeedToBottom, 80);
              }}
            />
          </Tabs>

          {onNoteAdd ? (
            <Tooltip
              title={
                canAddHudNote
                  ? "Add session note (opens Session notes tab)"
                  : "Open Session notes — finish or delete the draft note before adding another."
              }
            >
              <IconButton
                size="small"
                onClick={handleHudHeaderAddNote}
                aria-label="Add session note"
                sx={{
                  alignSelf: "center",
                  mx: 0.25,
                  color: hud.mid,
                  "&:hover": { color: hud.hi, bgcolor: hud.hoverChrome },
                }}
              >
                <AddIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          ) : null}

          {sessionHeading ? (
            <Tooltip title={sessionHeadingTooltip} placement="bottom">
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  flexShrink: 0,
                  pl: 0.5,
                  pr: 0.5,
                  maxWidth: "min(200px, 38%)",
                  minWidth: 0,
                  alignSelf: "stretch",
                  borderLeft: `1px solid ${glassBorder}`,
                  backgroundImage: isPip ? "none" : `linear-gradient(158deg, ${alpha(theme.palette.common.white, 0.06)} 0%, transparent 55%)`,
                }}
              >
                <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 0.65, minWidth: 0, justifyContent: "flex-end" }}>
                  <LiveSessionDot color={theme.palette.success.main} />
                  <Typography component="span" variant="caption" sx={{ color: hud.hi, fontWeight: 600, fontSize: "0.68rem", letterSpacing: "-0.01em", lineHeight: 1.2, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {sessionHeading}
                  </Typography>
                </Stack>
              </Box>
            </Tooltip>
          ) : null}

          {showPipLaunch && pipSupported && onRequestDocumentPip ? (
            <Stack sx={{ flexDirection: "row", flexShrink: 0, alignItems: "center", alignSelf: "stretch", borderLeft: `1px solid ${glassBorder}`, pr: 0.25 }}>
              <Tooltip title="Always on top (Document Picture-in-Picture)" placement="bottom">
                <IconButton size="small" onClick={onRequestDocumentPip} aria-label="Open always-on-top window" sx={{ color: hud.mid, "&:hover": { color: hud.hi, bgcolor: hud.hoverChrome } }}>
                  <PictureInPictureAltOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ) : null}
        </Box>

        {activeTab === "suggestions" ? (
          <HudSuggestionsTab
            scrollRef={suggestionsScrollRef}
            mergedConversationTimeline={mergedConversationTimeline}
            latestMessageSuggestions={latestMessageSuggestions}
            suggestionsLoading={suggestionsLoading}
            rejectingIds={rejectingIds}
            onPromptAccept={handlePromptAccept}
            onPromptReject={handlePromptReject}
          />
        ) : null}

        {activeTab === "capture" ? (
          <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1.5, py: 1.5 }}>
            <Stack spacing={1.5}>
              <Typography variant="body2" sx={{ lineHeight: 1.55, color: hud.mid, fontSize: "0.8125rem" }}>
                Tap a tag or use Ctrl+1–9. Each capture stores the flag, transcript line time, a text snippet, and when you captured it. From Live feed, shortcuts follow mic → AI anchor → latest line; from other tabs they use the selected line in the main view when set, otherwise the same fallback.
              </Typography>
              {quickTags.length ? (
                <>
                  <Typography variant="caption" sx={{ display: "block", color: hud.faint, fontSize: "0.625rem", lineHeight: 1.5 }}>
                    Ctrl+1–9 from Capture or Live feed (switches to Capture). Chips use the same target line as shortcuts.
                  </Typography>
                  <Stack sx={{ flexDirection: "row", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
                    {quickTags.map((tag, idx) => {
                      const digitKey = paletteDigitForTag(tag, idx);
                      const shortcutText = digitKey ? formatCtrlShortcut(digitKey) : null;
                      const displayName = String(tag.label ?? "").trim() || tag.id;
                      const targetId = quickTagTargetTranscriptId;
                      const alreadyOnTargetLine =
                        Boolean(targetId) &&
                        transcriptLineHasCatalogTag(
                          transcriptTags,
                          targetId as string,
                          tag.id,
                        );
                      return (
                        <Tooltip
                          key={tag.id}
                          title={
                            alreadyOnTargetLine
                              ? `${displayName} — already on this line`
                              : shortcutText
                                ? `${displayName} (${shortcutText})`
                                : displayName
                          }
                        >
                          <Chip
                            label={
                              <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, py: 0.1 }}>
                                <Typography component="span" variant="body2" sx={{ fontWeight: 650, fontSize: "0.8rem", lineHeight: 1.3, color: "inherit" }}>
                                  {displayName}
                                </Typography>
                                {shortcutText ? (
                                  <Box component="kbd" sx={{ fontSize: "0.58rem", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontWeight: 600, px: 0.4, py: 0.05, borderRadius: 0.5, bgcolor: hud.chipMutedBg, border: `1px solid ${hud.border}`, color: hud.low, lineHeight: 1.25 }}>
                                    {shortcutText}
                                  </Box>
                                ) : null}
                              </Box>
                            }
                            size="small"
                            variant="outlined"
                            disabled={alreadyOnTargetLine}
                            onClick={() => {
                              if (alreadyOnTargetLine) return;
                              const tid = resolveHudQuickTagTargetTranscriptId(
                                activeTab,
                                displayTranscriptPreview,
                                latestMessageSuggestions,
                                quickTagAnchorTranscriptId,
                              );
                              onQuickTag?.(tag.id, tid);
                            }}
                            sx={{
                              height: "auto",
                              minHeight: 32,
                              py: 0.4,
                              fontWeight: 500,
                              cursor:
                                onQuickTag && !alreadyOnTargetLine ? "pointer" : "default",
                              opacity: alreadyOnTargetLine ? 0.45 : 1,
                              color: hud.hi,
                              borderColor: hud.border,
                              bgcolor: alpha(theme.palette.common.white, 0.05),
                              borderRadius: "999px",
                              transition: "background-color 160ms ease, border-color 160ms ease, transform 160ms ease",
                              "& .MuiChip-label": { px: 1.25, py: 0.35 },
                              "&:hover": onQuickTag ? { bgcolor: hud.fieldHover, borderColor: hud.borderStrong, transform: "translateY(-1px)" } : undefined,
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                  </Stack>
                </>
              ) : (
                <Typography variant="body2" sx={{ color: hud.low }}>
                  No quick tags configured.
                </Typography>
              )}

              <Typography variant="overline" sx={{ color: hud.faint, fontSize: "0.65rem", letterSpacing: "0.08em", lineHeight: 1.5, pt: 0.5 }}>
                Recent captures
              </Typography>
              {captureFeedSorted.length ? (
                <Stack spacing={1}>
                  {captureFeedSorted.map((ct) => {
                    const catalog = availableTags.find((o) => o.id === ct.tagId);
                    const flagLabel = String(catalog?.label ?? ct.tagId).trim() || ct.tagId;
                    const flagColor = (catalog?.color ?? "default") as TagOption["color"];
                    const lineAt = ct.transcriptLineAt?.trim();
                    const lineClock = lineAt ? formatClock(lineAt) : null;
                    const capClock = formatClock(ct.timestamp);
                    const fromPreview =
                      ct.transcriptId &&
                      displayTranscriptPreview.find((t) => t.id === ct.transcriptId)?.text;
                    const msg =
                      (ct.messagePreview?.trim() || String(fromPreview ?? "").trim()) || "";
                    const msgDisplay = msg || "—";
                    return (
                      <Box
                        key={ct.id}
                        sx={{
                          borderRadius: 1.25,
                          border: `1px solid ${hud.border}`,
                          bgcolor: alpha(theme.palette.common.white, 0.04),
                          p: 1,
                        }}
                      >
                        <Stack sx={{ flexDirection: "row", alignItems: "flex-start", gap: 1.25 }}>
                          <Chip
                            size="small"
                            label={flagLabel}
                            color={flagColor === "default" ? "default" : flagColor}
                            variant="outlined"
                            sx={{
                              flexShrink: 0,
                              fontWeight: 700,
                              fontSize: "0.7rem",
                              height: 28,
                              mt: "2px",
                              maxWidth: { xs: "min(120px, 36%)", sm: 132 },
                              "& .MuiChip-label": {
                                px: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                display: "block",
                              },
                              ...tagChipOutlinedRestSx(theme, flagColor),
                            }}
                          />
                          <Stack spacing={0.35} sx={{ minWidth: 0, flex: 1, pt: 0.125 }}>
                            <Typography variant="caption" sx={{ color: hud.faint, fontSize: "0.62rem", lineHeight: 1.35 }}>
                              {lineClock ? `Line ${lineClock}` : "Line —"}
                              {" · "}
                              Captured {capClock}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: hud.hi,
                                fontSize: "0.78rem",
                                lineHeight: 1.45,
                                wordBreak: "break-word",
                              }}
                            >
                              {msgDisplay}
                            </Typography>
                          </Stack>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Typography variant="body2" sx={{ color: hud.low }}>
                  No captures yet — use the tags above or Ctrl+1–9.
                </Typography>
              )}
            </Stack>
          </Box>
        ) : null}

        {activeTab === "notes" ? (
          <HudNotesTab
            hud={hud}
            notes={notes}
            availableTags={availableTags}
            transcriptTags={transcriptTags}
            onNotesChange={onNotesChange}
            onNoteAdd={onNoteAdd}
            onNoteDelete={onNoteDelete}
            onNoteSave={onNoteSave}
            onNoteCommit={onNoteCommit}
            onNoteTagAdd={onNoteTagAdd}
            onNoteTagRemove={onNoteTagRemove}
          />
        ) : null}

        {activeTab === "speaker" ? (
          <Box ref={speakerScrollRef} sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1.5, py: 1.5 }}>
            {displayTranscriptPreview.length ? (
              <Stack spacing={1.25}>
                {displayTranscriptPreview.map((item) => (
                  <Box
                    key={item.id}
                    sx={{
                      p: 1.5,
                      borderRadius: "10px",
                      border: `1px solid ${hud.border}`,
                      bgcolor: hud.card,
                      transition: "border-color 160ms ease, box-shadow 160ms ease",
                      "&:hover": { borderColor: hud.borderStrong, boxShadow: `0 4px 14px ${alpha(theme.palette.common.black, 0.12)}` },
                    }}
                  >
                    <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 1, mb: 0.75 }}>
                      <Chip label={item.speakerId} size="small" variant="outlined" sx={{ height: 22, fontSize: "0.625rem", fontWeight: 600, color: hud.mid, borderColor: hud.border, bgcolor: alpha(theme.palette.common.white, 0.04), borderRadius: "999px", textTransform: "capitalize" }} />
                      <Typography variant="caption" sx={{ fontVariantNumeric: "tabular-nums", color: hud.faint, ml: "auto", fontSize: "0.625rem" }}>
                        {item.formattedTime}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ lineHeight: 1.55, color: hud.hi, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.8125rem" }}>
                      {item.text}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: hud.low }}>
                Waiting for live lines from the socket.
              </Typography>
            )}
          </Box>
        ) : null}

        <HudComposerBar
          composerLine={composerLine}
          onComposerLineChange={onComposerLineChange}
          voiceActive={voiceActive}
          onVoiceToggle={onVoiceToggle}
          onSendChunk={onSendChunk}
          sendChunkDisabled={sendChunkDisabled}
          transcriptLoading={transcriptLoading}
          getDefaultSpeakerId={getDefaultSpeakerId}
          onSpeakerChange={onSpeakerChange}
        />
      </Box>
    </Box>
  );
});
