import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, CSSProperties } from "react";
import { alpha, useTheme, type Theme } from "@mui/material/styles";
import {
  Box,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  getFloatingHudOvVariants,
  getFloatingHudTokens,
  type FloatingHudOvColors,
  type FloatingHudTokens,
} from "@/app/providers/theme";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import RuleRoundedIcon from "@mui/icons-material/RuleRounded";
import PictureInPictureAltOutlinedIcon from "@mui/icons-material/PictureInPictureAltOutlined";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import type { TranscriptItem } from "@/modules/transcript/types";
import type { TranscriptStreamStatus } from "@/modules/transcript/types";
import type { PromptSuggestion } from "@/modules/prompts/types";
import type { TagOption } from "@/modules/tagging/types";
import { formatClock } from "@/shared/utils/formatters";
import { SPEAKER_PRESETS } from "@/modules/transcript/constants/speakerPresets";
import {
  formatCtrlShortcut,
  indexForPaletteDigit,
  paletteDigitForTag,
} from "@/modules/tagging/utils/paletteShortcut";

export const FLOATING_HUD_WIDTH = 300;

const SPEAKER_OTHER = "__other__" as const;
const Z_FLOAT = 10050;
type HudLayout = "embed" | "pip";
type TabKey = "suggestions" | "capture" | "speaker";
type BtnVariant = "teal" | "red" | "violet" | "ghost";

interface AcceptedMsg {
  id: string;
  text: string;
  title: string;
  timestamp: string;
  origin: "model" | "local";
  transcriptId?: string;
  transcriptIds?: string[];
}

interface PendingMsg {
  id: string;
  text: string;
  speakerId: string;
  timestamp: string;
}

function isPresetSpeakerId(id: string): id is (typeof SPEAKER_PRESETS)[number] {
  return (SPEAKER_PRESETS as readonly string[]).includes(id);
}

function isTextualFieldTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

const IconMicOn = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
  </svg>
);

const IconMicOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3 3 4.27l6.01 6.01V11c0 1.66 1.34 3 3 3 .23 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c.57-.08 1.12-.24 1.64-.46L19.73 21 21 19.73 4.27 3z" />
  </svg>
);

function OvBtn({
  children,
  onClick,
  ariaLabel,
  variant = "ghost",
  size = 40,
  active = false,
  disabled = false,
  ovVariants,
  dimTrack,
  dimTextMuted,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
  variant?: BtnVariant;
  size?: number;
  active?: boolean;
  disabled?: boolean;
  ovVariants: Record<BtnVariant, FloatingHudOvColors>;
  dimTrack: string;
  dimTextMuted: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const v = ovVariants[variant];
  const dim = disabled;

  const style: CSSProperties = {
    width: size,
    height: size,
    boxSizing: "border-box",
    borderRadius: "50%",
    background: dim ? dimTrack : (hovered || active) ? v.bgH : v.bg,
    border: `2px solid ${dim ? "transparent" : (focused || active) ? v.ring : "transparent"}`,
    outline: "none",
    cursor: dim ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: dim ? dimTextMuted : (hovered || active) ? v.colorH : v.color,
    flexShrink: 0,
    transition: "background 150ms ease, color 150ms ease, transform 150ms ease, border-color 150ms ease",
    transform: dim || !hovered ? "scale(1)" : "scale(1.05)",
    opacity: dim ? 0.5 : 1,
    pointerEvents: dim ? "none" : "auto",
  };

  return (
    <button
      type="button"
      style={style}
      onClick={() => { if (!dim) onClick(); }}
      aria-label={ariaLabel}
      aria-disabled={dim}
      disabled={dim}
      onMouseEnter={() => !dim && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => !dim && setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {children}
    </button>
  );
}

function TypingDots({ color }: { color: string }) {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        px: 1.5,
        py: 0.75,
        "& span": {
          width: 6,
          height: 6,
          borderRadius: "50%",
          bgcolor: color,
          display: "inline-block",
          "@keyframes blink": {
            "0%, 80%, 100%": { opacity: 0.2, transform: "scale(0.8)" },
            "40%": { opacity: 1, transform: "scale(1)" },
          },
          animation: "blink 1.2s ease-in-out infinite",
        },
        "& span:nth-of-type(2)": { animationDelay: "0.2s" },
        "& span:nth-of-type(3)": { animationDelay: "0.4s" },
      }}
    >
      <span /><span /><span />
    </Box>
  );
}

function SuggestionCard({
  prompt,
  isRejecting,
  onAccept,
  onReject,
  hud,
  theme,
}: {
  prompt: PromptSuggestion;
  isRejecting: boolean;
  onAccept: (p: PromptSuggestion) => void;
  onReject: (id: string) => void;
  hud: FloatingHudTokens;
  theme: Theme;
}) {
  const isModel = (prompt.suggestionOrigin ?? "local") === "model";
  const timeLabel = prompt.transcriptTimeLabel ?? formatClock(prompt.timestamp);

  return (
    <Box
      sx={{
        width: "100%",
        minWidth: 0,
        alignSelf: "stretch",
        "@keyframes slideIn": {
          from: { opacity: 0, transform: "translateY(8px) scale(0.97)" },
          to: { opacity: 1, transform: "translateY(0) scale(1)" },
        },
        "@keyframes slideOut": {
          from: { opacity: 1, transform: "translateY(0) scale(1)" },
          to: { opacity: 0, transform: "translateY(-6px) scale(0.95)" },
        },
        animation: isRejecting
          ? "slideOut 200ms ease forwards"
          : "slideIn 220ms ease forwards",
        borderRadius: "12px",
        border: `1px solid ${isModel ? alpha(hud.accentMain, 0.35) : hud.border}`,
        bgcolor: isModel ? alpha(hud.accentMain, 0.07) : hud.card,
        boxShadow: isModel
          ? `0 0 0 1px ${alpha(hud.accentMain, 0.12)}, 0 4px 16px ${alpha(theme.palette.common.black, 0.14)}`
          : `0 2px 8px ${alpha(theme.palette.common.black, 0.1)}`,
        overflow: "hidden",
        position: "relative",
        transition: "border-color 180ms ease, box-shadow 180ms ease",
        "&:hover": {
          borderColor: isModel ? alpha(hud.accentMain, 0.55) : hud.borderStrong,
          boxShadow: isModel
            ? `0 0 0 1px ${alpha(hud.accentMain, 0.2)}, 0 6px 20px ${alpha(theme.palette.common.black, 0.18)}`
            : `0 4px 14px ${alpha(theme.palette.common.black, 0.14)}`,
        },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          left: 0,
          top: 8,
          bottom: 8,
          width: 3,
          borderRadius: "0 3px 3px 0",
          bgcolor: isModel ? hud.accentMain : alpha(theme.palette.common.white, 0.18),
        }}
      />

      <Stack sx={{ p: 1.5, pl: 2.25, gap: 0.75, width: "100%", minWidth: 0, boxSizing: "border-box" }}>
        <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 0.75, flexWrap: "wrap", width: "100%", minWidth: 0 }}>
          <Box sx={{ color: isModel ? hud.accentMain : hud.mid, display: "flex", alignItems: "center" }}>
            {isModel ? <AutoAwesomeRoundedIcon sx={{ fontSize: 13 }} /> : <RuleRoundedIcon sx={{ fontSize: 13 }} />}
          </Box>
          <Typography
            variant="caption"
            sx={{
              fontSize: "0.625rem",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: isModel ? alpha(hud.accentMain, 0.85) : hud.low,
              fontWeight: 600,
            }}
          >
            {isModel ? "AI suggestion" : "Rule suggestion"}
          </Typography>
          <Typography variant="caption" sx={{ fontSize: "0.625rem", color: hud.faint, ml: "auto", fontVariantNumeric: "tabular-nums" }}>
            {timeLabel}
          </Typography>
        </Stack>

        <Box sx={{ width: "100%", minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              lineHeight: 1.35,
              color: hud.hi,
              letterSpacing: "-0.01em",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              overflowWrap: "anywhere",
            }}
          >
            {prompt.title}
          </Typography>
        </Box>

        {prompt.body ? (
          <Box sx={{ width: "100%", minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontSize: "0.75rem",
                color: hud.mid,
                lineHeight: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                overflowWrap: "anywhere",
              }}
            >
              {prompt.body}
            </Typography>
          </Box>
        ) : null}

        <Stack sx={{ flexDirection: "row", gap: 0.75, mt: 0.25, width: "100%", minWidth: 0 }}>
          <Box
            component="button"
            type="button"
            onClick={() => onAccept(prompt)}
            aria-label="Accept suggestion"
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.5,
              height: 30,
              borderRadius: "8px",
              border: `1px solid ${alpha(hud.accentMain, 0.4)}`,
              bgcolor: alpha(hud.accentMain, 0.14),
              color: hud.accent,
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 600,
              transition: "background-color 150ms ease, border-color 150ms ease, transform 150ms ease",
              "&:hover": {
                bgcolor: alpha(hud.accentMain, 0.26),
                borderColor: alpha(hud.accentMain, 0.6),
                transform: "translateY(-1px)",
              },
              "&:active": { transform: "scale(0.97)" },
            }}
          >
            <CheckRoundedIcon sx={{ fontSize: 14 }} />
            Accept
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => onReject(prompt.id)}
            aria-label="Reject suggestion"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              borderRadius: "8px",
              border: `1px solid ${hud.border}`,
              bgcolor: "transparent",
              color: hud.low,
              cursor: "pointer",
              transition: "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
              "&:hover": {
                bgcolor: alpha(theme.palette.error.main, 0.12),
                borderColor: alpha(theme.palette.error.main, 0.3),
                color: theme.palette.error.light,
              },
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: 14 }} />
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}

function TranscriptBubble({
  item,
  isMe,
  hud,
  theme,
}: {
  item: TranscriptItem;
  isMe: boolean;
  hud: FloatingHudTokens;
  theme: Theme;
}) {
  const speakerId = String(item.speakerId ?? "").trim();
  return (
    <Stack
      sx={{
        width: "100%",
        minWidth: 0,
        alignItems: isMe ? "flex-end" : "flex-start",
        "@keyframes bubbleIn": {
          from: { opacity: 0, transform: `translateX(${isMe ? "8px" : "-8px"})` },
          to: { opacity: 1, transform: "translateX(0)" },
        },
        animation: "bubbleIn 220ms ease forwards",
      }}
    >
      <Box
        sx={{
          maxWidth: "87%",
          px: 1.5,
          py: 1,
          borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          bgcolor: isMe
            ? alpha(theme.palette.primary.main, 0.8)
            : alpha(theme.palette.common.white, 0.06),
          border: isMe
            ? `1px solid ${alpha(theme.palette.primary.main, 0.4)}`
            : `1px solid ${hud.border}`,
          boxShadow: isMe
            ? `0 2px 10px ${alpha(theme.palette.primary.main, 0.2)}`
            : `0 1px 3px ${alpha(theme.palette.common.black, 0.1)}`,
          color: isMe ? alpha(theme.palette.common.white, 0.96) : hud.hi,
        }}
      >
        <Stack
          sx={{
            flexDirection: "row",
            alignItems: "center",
            gap: 0.5,
            mb: 0.4,
            justifyContent: isMe ? "flex-end" : "flex-start",
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontSize: "0.625rem",
              color: isMe ? alpha(theme.palette.common.white, 0.65) : hud.faint,
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {isMe ? "You" : speakerId || "Speaker"}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontSize: "0.625rem",
              color: isMe ? alpha(theme.palette.common.white, 0.45) : hud.faint,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {item.formattedTime || formatClock(item.timestamp)}
          </Typography>
        </Stack>
        <Typography
          variant="body2"
          sx={{
            fontSize: "0.8125rem",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            textAlign: isMe ? "right" : "left",
          }}
        >
          {item.text}
        </Typography>
      </Box>
    </Stack>
  );
}

function AcceptedMessageBubble({
  msg,
  hud,
  theme,
}: {
  msg: AcceptedMsg;
  hud: FloatingHudTokens;
  theme: Theme;
}) {
  return (
    <Stack
      sx={{
        width: "100%",
        minWidth: 0,
        alignItems: "flex-start",
        "@keyframes acceptedIn": {
          from: { opacity: 0, transform: "translateY(6px) scale(0.97)" },
          to: { opacity: 1, transform: "translateY(0) scale(1)" },
        },
        animation: "acceptedIn 250ms cubic-bezier(0.34,1.56,0.64,1) forwards",
      }}
    >
      <Box
        sx={{
          maxWidth: "87%",
          px: 1.5,
          py: 1,
          borderRadius: "14px 14px 14px 4px",
          bgcolor: alpha(hud.accentMain, 0.12),
          border: `1px solid ${alpha(hud.accentMain, 0.3)}`,
          boxShadow: `0 2px 10px ${alpha(hud.accentMain, 0.1)}`,
        }}
      >
        <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 0.5, mb: 0.4 }}>
          <AutoAwesomeRoundedIcon sx={{ fontSize: 11, color: hud.accent }} />
          <Typography variant="caption" sx={{ fontSize: "0.625rem", color: hud.accent, fontWeight: 600 }}>
            AI · accepted
          </Typography>
          <Typography variant="caption" sx={{ fontSize: "0.625rem", color: hud.faint, fontVariantNumeric: "tabular-nums" }}>
            {formatClock(msg.timestamp)}
          </Typography>
        </Stack>
        <Typography
          variant="body2"
          sx={{ fontSize: "0.8125rem", lineHeight: 1.5, color: hud.hi, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {msg.text || msg.title}
        </Typography>
      </Box>
    </Stack>
  );
}

function RecordingDot({ color }: { color: string }) {
  return (
    <Box
      sx={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        bgcolor: color,
        flexShrink: 0,
        "@keyframes pulse": {
          "0%, 100%": { opacity: 1, transform: "scale(1)" },
          "50%": { opacity: 0.5, transform: "scale(0.75)" },
        },
        animation: "pulse 1.4s ease-in-out infinite",
      }}
    />
  );
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
  onPromptUse?: (promptId: string) => void;
  onPromptDismiss?: (promptId: string) => void;
  quickTags: TagOption[];
  onQuickTag?: (tagId: string) => void;
  voiceActive?: boolean;
  onVoiceToggle?: () => void;
  onSendChunk?: (payload: { text: string; speakerId: string }) => boolean;
  sendChunkDisabled?: boolean;
  getDefaultSpeakerId?: () => string;
  onSpeakerChange?: (speakerId: string) => void;
  sessionTitle?: string;
  sessionId?: string;
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
  onPromptUse,
  onPromptDismiss,
  quickTags,
  onQuickTag,
  voiceActive = false,
  onVoiceToggle,
  onSendChunk,
  sendChunkDisabled = true,
  getDefaultSpeakerId,
  onSpeakerChange,
  sessionTitle,
  sessionId,
}: FloatingPulseHudPanelProps) {
  const theme = useTheme();
  const hud = useMemo(() => getFloatingHudTokens(theme), [theme]);
  const ovVariants = useMemo(() => getFloatingHudOvVariants(theme), [theme]);

  const [activeTab, setActiveTab] = useState<TabKey>("suggestions");
  const [dismissedPromptIds, setDismissedPromptIds] = useState<Set<string>>(() => new Set());
  const [rejectingIds, setRejectingIds] = useState<Set<string>>(() => new Set());
  const [acceptedMessages, setAcceptedMessages] = useState<AcceptedMsg[]>([]);
  const [pendingMessages, setPendingMessages] = useState<PendingMsg[]>([]);

  const [speakerChip, setSpeakerChip] = useState<string>(() => {
    const raw = getDefaultSpeakerId?.();
    const id = typeof raw === "string" && raw.trim() ? raw.trim() : "interviewer";
    return isPresetSpeakerId(id) ? id : SPEAKER_OTHER;
  });
  const [customSpeakerInput, setCustomSpeakerInput] = useState(() => {
    const raw = getDefaultSpeakerId?.();
    const id = typeof raw === "string" && raw.trim() ? raw.trim() : "interviewer";
    return isPresetSpeakerId(id) ? "" : id;
  });

  const suggestionsScrollRef = useRef<HTMLDivElement>(null);
  const speakerScrollRef = useRef<HTMLDivElement>(null);

  const scrollSpeakerFeedToBottom = useCallback(() => {
    const el = speakerScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const effectiveSpeakerId =
    speakerChip === SPEAKER_OTHER
      ? String(customSpeakerInput ?? "").trim() || "interviewer"
      : String(speakerChip ?? "interviewer").trim() || "interviewer";

  const transcriptLoading = transcriptStatus === "connecting" || transcriptStatus === "reconnecting";
  const isPip = layout === "pip";

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
    const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");
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
    const tail = last ? `${last.id}:${last.timestamp}:${String(last.text ?? "")}` : "";
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
        visiblePrompts.map((p) => `${p.id}:${p.title?.length ?? 0}:${p.body?.length ?? 0}`).join("|"),
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
    const scrollBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    scrollBottom();
    const id = requestAnimationFrame(() => {
      scrollBottom();
    });
    const t = window.setTimeout(scrollBottom, 40);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(t);
    };
  }, [activeTab, suggestionsScrollSig]);

  useLayoutEffect(() => {
    if (activeTab !== "speaker") return;
    scrollSpeakerFeedToBottom();
    const id = requestAnimationFrame(() => {
      scrollSpeakerFeedToBottom();
    });
    const t = window.setTimeout(scrollSpeakerFeedToBottom, 40);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(t);
    };
  }, [activeTab, transcriptScrollSig, scrollSpeakerFeedToBottom]);

  const timelineCurrentSpeaker = useMemo(() => {
    const raw = getDefaultSpeakerId?.();
    return (typeof raw === "string" && raw.trim() ? raw.trim() : "interviewer").toLowerCase();
  }, [getDefaultSpeakerId]);

  const handlePromptAccept = useCallback(
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

  const handlePromptReject = useCallback(
    (id: string) => {
      setRejectingIds((prev) => new Set([...prev, id]));
      setTimeout(() => {
        setDismissedPromptIds((prev) => new Set([...prev, id]));
        setRejectingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        onPromptDismiss?.(id);
      }, 210);
    },
    [onPromptDismiss],
  );

  const selectPresetChip = useCallback(
    (preset: (typeof SPEAKER_PRESETS)[number]) => {
      setSpeakerChip(preset);
      setCustomSpeakerInput("");
      onSpeakerChange?.(preset);
    },
    [onSpeakerChange],
  );

  const selectOtherChip = useCallback(() => {
    setSpeakerChip(SPEAKER_OTHER);
    const who = String(customSpeakerInput ?? "").trim() || "interviewer";
    onSpeakerChange?.(who);
  }, [customSpeakerInput, onSpeakerChange]);

  const handleCustomSpeakerChange = useCallback(
    (value: string) => {
      setCustomSpeakerInput(value);
      if (speakerChip === SPEAKER_OTHER) {
        onSpeakerChange?.(String(value ?? "").trim() || "interviewer");
      }
    },
    [speakerChip, onSpeakerChange],
  );

  const handleSend = useCallback(() => {
    if (!onSendChunk || sendChunkDisabled) return;
    const text = String(composerLine ?? "").trim();
    if (!text) return;
    const rawDefault = getDefaultSpeakerId?.();
    const fallback = typeof rawDefault === "string" && rawDefault.trim() ? rawDefault.trim() : "interviewer";
    const who = String(effectiveSpeakerId ?? "").trim() || fallback;
    const ok = onSendChunk({ text, speakerId: who });
    if (ok) {
      onComposerLineChange("");
    }
  }, [onSendChunk, sendChunkDisabled, composerLine, effectiveSpeakerId, getDefaultSpeakerId, onComposerLineChange]);

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

  useEffect(() => {
    if (!visible || activeTab !== "capture" || !onQuickTag) return;
    const tags = quickTags;
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
      e.preventDefault();
      e.stopPropagation();
      onQuickTag(tag.id);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [visible, activeTab, onQuickTag, quickTags]);

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

    type TimelineRow =
      | { kind: "transcript"; id: string; item: TranscriptItem }
      | { kind: "accepted"; id: string; msg: AcceptedMsg }
      | { kind: "pending"; id: string; msg: PendingMsg };

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
      const anchoredAccepted = [...(acceptedByAnchor.get(item.id) ?? [])].sort((a, b) => {
        const d = parseMs(a.timestamp) - parseMs(b.timestamp);
        return d !== 0 ? d : a.id.localeCompare(b.id);
      });
      for (const msg of anchoredAccepted) {
        rows.push({ kind: "accepted", id: msg.id, msg });
      }
    }

    const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");
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
      const d = parseMs("msg" in a ? a.msg.timestamp : "") - parseMs("msg" in b ? b.msg.timestamp : "");
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
    const latestPromptMs = orderedSuggestions.reduce((acc, p) => Math.max(acc, parseMs(p.timestamp)), 0);
    return orderedSuggestions.filter((p) => parseMs(p.timestamp) >= latestPromptMs);
  }, [displayTranscriptPreview, orderedSuggestions]);

  const suggestionsLoading = useMemo(() => {
    if (transcriptStatus !== "connected") return transcriptLoading;
    if (!displayTranscriptPreview.length) return false;
    const latestTranscriptMs = displayTranscriptPreview.reduce((acc, item) => {
      const ts = Date.parse(item.timestamp);
      return Number.isNaN(ts) ? acc : Math.max(acc, ts);
    }, 0);
    const latestPromptMs = latestMessageSuggestions.reduce((acc, p) => {
      const ts = Date.parse(p.timestamp);
      return Number.isNaN(ts) ? acc : Math.max(acc, ts);
    }, 0);
    return transcriptLoading || latestPromptMs < latestTranscriptMs;
  }, [transcriptStatus, transcriptLoading, displayTranscriptPreview, latestMessageSuggestions]);

  const rootSx = isPip
    ? { position: "absolute" as const, inset: 0, width: "100%", height: "100%", minHeight: 0, zIndex: Z_FLOAT, pointerEvents: visible ? ("auto" as const) : ("none" as const), isolation: "isolate" as const }
    : { position: "fixed" as const, right: 16, bottom: "max(16px, env(safe-area-inset-bottom, 0px))", width: FLOATING_HUD_WIDTH, maxWidth: "calc(100vw - 24px)", maxHeight: "min(640px, calc(100vh - 32px))", zIndex: Z_FLOAT, pointerEvents: visible ? ("auto" as const) : ("none" as const), isolation: "isolate" as const };

  const glassBg = hud.glassBg;
  const glassBorder = hud.glassBorder;

  const suggestionsTabContent = (
    <Box
      ref={suggestionsScrollRef}
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        px: 1.5,
        py: 1.5,
        color: hud.hi,
        scrollbarWidth: "thin",
        scrollbarColor: `${alpha(theme.palette.common.white, 0.12)} transparent`,
        "&::-webkit-scrollbar": { width: 4 },
        "&::-webkit-scrollbar-track": { background: "transparent" },
        "&::-webkit-scrollbar-thumb": { background: alpha(theme.palette.common.white, 0.12), borderRadius: 4 },
      }}
    >
      {mergedConversationTimeline.length || latestMessageSuggestions.length || suggestionsLoading ? (
        <Stack spacing={1.5} sx={{ width: "100%", minWidth: 0, alignItems: "stretch" }}>
          {mergedConversationTimeline.map((entry) => {
            if (entry.kind === "accepted") {
              return <AcceptedMessageBubble key={entry.id} msg={entry.msg} hud={hud} theme={theme} />;
            }

            if (entry.kind === "pending") {
              const pendingItem: TranscriptItem = {
                id: entry.msg.id,
                text: entry.msg.text,
                timestamp: entry.msg.timestamp,
                speakerId: entry.msg.speakerId,
                formattedTime: formatClock(entry.msg.timestamp),
              };
              return <TranscriptBubble key={entry.id} item={pendingItem} isMe hud={hud} theme={theme} />;
            }

            const item = entry.item;
            const speakerNorm = String(item.speakerId ?? "").trim().toLowerCase();
            const isMe = speakerNorm === timelineCurrentSpeaker || speakerNorm === "me" || speakerNorm === "self";
            return <TranscriptBubble key={entry.id} item={item} isMe={isMe} hud={hud} theme={theme} />;
          })}

          <Stack sx={{ gap: 1 }}>
            <Typography
              variant="caption"
              sx={{
                color: hud.faint,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 600,
                fontSize: "0.62rem",
              }}
            >
              Suggestions
            </Typography>
            {latestMessageSuggestions.map((prompt) => (
              <SuggestionCard
                key={`prompt-${prompt.id}`}
                prompt={prompt}
                isRejecting={rejectingIds.has(prompt.id)}
                onAccept={handlePromptAccept}
                onReject={handlePromptReject}
                hud={hud}
                theme={theme}
              />
            ))}
          </Stack>

          {suggestionsLoading && (
            <Stack sx={{ alignItems: "flex-start", pt: 0.25 }}>
              <Box
                sx={{
                  borderRadius: "14px 14px 14px 4px",
                  border: `1px solid ${hud.border}`,
                  bgcolor: alpha(theme.palette.common.white, 0.05),
                }}
              >
                <TypingDots color={hud.mid} />
              </Box>
              <Typography variant="caption" sx={{ color: hud.faint, mt: 0.5, ml: 0.25 }}>
                Generating suggestions...
              </Typography>
            </Stack>
          )}
        </Stack>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 1, py: 4 }}>
          <AutoAwesomeRoundedIcon sx={{ fontSize: 28, color: hud.faint }} />
          <Typography variant="body2" sx={{ color: hud.faint, fontSize: "0.8125rem", textAlign: "center", lineHeight: 1.5, maxWidth: "80%" }}>
            Suggestions appear as patterns show up in the feed.
          </Typography>
        </Box>
      )}
    </Box>
  );

  const captureTabContent = (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1.5, py: 1.5 }}>
      <Stack spacing={1.5}>
        <Typography variant="body2" sx={{ lineHeight: 1.55, color: hud.mid, fontSize: "0.8125rem" }}>
          Tap a tag to attach it to the currently selected transcript line.
        </Typography>
        {quickTags.length ? (
          <>
            <Typography variant="caption" sx={{ display: "block", color: hud.faint, fontSize: "0.625rem", lineHeight: 1.5 }}>
              Keyboard shortcuts apply while this tab is open and focus is not in a text field.
            </Typography>
            <Stack sx={{ flexDirection: "row", flexWrap: "wrap", gap: 1 }}>
              {quickTags.map((tag, idx) => {
                const digitKey = paletteDigitForTag(tag, idx);
                const shortcutText = digitKey ? formatCtrlShortcut(digitKey) : null;
                const displayName = String(tag.label ?? "").trim() || tag.id;
                return (
                  <Tooltip key={tag.id} title={shortcutText ? `${displayName} (${shortcutText})` : displayName}>
                    <Chip
                      label={
                        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, py: 0.1 }}>
                          <Typography component="span" variant="body2" sx={{ fontWeight: 650, fontSize: "0.8rem", lineHeight: 1.3, color: "inherit" }}>
                            {displayName}
                          </Typography>
                          {shortcutText ? (
                            <Box
                              component="kbd"
                              sx={{
                                fontSize: "0.58rem",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                fontWeight: 600,
                                px: 0.4,
                                py: 0.05,
                                borderRadius: 0.5,
                                bgcolor: hud.chipMutedBg,
                                border: `1px solid ${hud.border}`,
                                color: hud.low,
                                lineHeight: 1.25,
                              }}
                            >
                              {shortcutText}
                            </Box>
                          ) : null}
                        </Box>
                      }
                      size="small"
                      variant="outlined"
                      onClick={() => onQuickTag?.(tag.id)}
                      sx={{
                        height: "auto",
                        minHeight: 32,
                        py: 0.4,
                        fontWeight: 500,
                        cursor: onQuickTag ? "pointer" : "default",
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
          <Typography variant="body2" sx={{ color: hud.low }}>No quick tags configured.</Typography>
        )}
      </Stack>
    </Box>
  );

  const speakerTabContent = (
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
                <Chip
                  label={item.speakerId}
                  size="small"
                  variant="outlined"
                  sx={{ height: 22, fontSize: "0.625rem", fontWeight: 600, color: hud.mid, borderColor: hud.border, bgcolor: alpha(theme.palette.common.white, 0.04), borderRadius: "999px", textTransform: "capitalize" }}
                />
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
        <Typography variant="body2" sx={{ color: hud.low }}>Waiting for live lines from the socket.</Typography>
      )}
    </Box>
  );

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
          backgroundImage: isPip ? "none" : `linear-gradient(160deg, ${alpha(theme.palette.common.white, 0.055)} 0%, transparent 50%)`,
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
                "&:hover": {
                  color: hud.hi,
                  bgcolor: alpha(theme.palette.common.white, 0.06),
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                },
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
                    <Box
                      sx={{
                        minWidth: 16,
                        height: 16,
                        borderRadius: "999px",
                        bgcolor: hud.accentMain,
                        color: hud.contrastOnAccent,
                        fontSize: "0.55rem",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        px: 0.5,
                      }}
                    >
                      {visiblePrompts.length}
                    </Box>
                  )}
                </Stack>
              }
            />
            <Tab value="capture" label="Capture" />
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

          {sessionHeading ? (
            <Tooltip title={sessionHeadingTooltip} placement="bottom">
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  flexShrink: 0,
                  pl: 0.75,
                  pr: 0.5,
                  maxWidth: "min(200px, 38%)",
                  minWidth: 0,
                  alignSelf: "stretch",
                  borderLeft: `1px solid ${glassBorder}`,
                  backgroundImage: isPip
                    ? "none"
                    : `linear-gradient(158deg, ${alpha(theme.palette.common.white, 0.06)} 0%, transparent 55%)`,
                }}
              >
                <Stack
                  sx={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 0.65,
                    minWidth: 0,
                    justifyContent: "flex-end",
                  }}
                >
                  <LiveSessionDot color={theme.palette.success.main} />
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      color: hud.hi,
                      fontWeight: 600,
                      fontSize: "0.68rem",
                      letterSpacing: "-0.01em",
                      lineHeight: 1.2,
                      textAlign: "right",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sessionHeading}
                  </Typography>
                </Stack>
              </Box>
            </Tooltip>
          ) : null}

          {showPipLaunch && pipSupported && onRequestDocumentPip ? (
            <Stack
              sx={{
                flexDirection: "row",
                flexShrink: 0,
                alignItems: "center",
                alignSelf: "stretch",
                borderLeft: `1px solid ${glassBorder}`,
                pr: 0.25,
              }}
            >
              <Tooltip title="Always on top (Document Picture-in-Picture)" placement="bottom">
                <IconButton
                  size="small"
                  onClick={onRequestDocumentPip}
                  aria-label="Open always-on-top window"
                  sx={{ color: hud.mid, "&:hover": { color: hud.hi, bgcolor: hud.hoverChrome } }}
                >
                  <PictureInPictureAltOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ) : null}
        </Box>

        {activeTab === "suggestions" ? suggestionsTabContent : null}
        {activeTab === "capture" ? captureTabContent : null}
        {activeTab === "speaker" ? speakerTabContent : null}

        <Box
          sx={{
            flexShrink: 0,
            px: 1.5,
            pt: 1.25,
            pb: 1.5,
            borderTop: `1px solid ${glassBorder}`,
            bgcolor: alpha(theme.palette.common.black, 0.22),
          }}
        >
          {transcriptLoading ? (
            <LinearProgress
              sx={{
                mb: 1.25,
                borderRadius: 999,
                height: 2,
                bgcolor: hud.railBg,
                "& .MuiLinearProgress-bar": { bgcolor: hud.accentMain },
              }}
            />
          ) : null}

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              px: 0.5,
              py: "5px",
              borderRadius: "14px",
              border: `1px solid ${hud.border}`,
              bgcolor: alpha(theme.palette.common.white, 0.06),
              boxShadow: `inset 0 1px 0 ${hud.insetShine}`,
              transition: "border-color 180ms ease, box-shadow 180ms ease",
              "&:focus-within": {
                borderColor: alpha(hud.accentMain, 0.5),
                boxShadow: `0 0 0 3px ${alpha(hud.accentMain, 0.14)}, inset 0 1px 0 ${hud.insetShine}`,
              },
            }}
          >
            <Box sx={{ flexShrink: 0, pl: 0.25 }}>
              <OvBtn
                variant={voiceActive ? "red" : "teal"}
                ariaLabel={voiceActive ? "Stop voice input" : "Start voice input"}
                onClick={() => onVoiceToggle?.()}
                size={30}
                disabled={Boolean(sendChunkDisabled && !voiceActive)}
                ovVariants={ovVariants}
                dimTrack={hud.dimTrack}
                dimTextMuted={hud.dimTextMuted}
              >
                {voiceActive ? <IconMicOff /> : <IconMicOn />}
              </OvBtn>
            </Box>

            <TextField
              fullWidth
              multiline={false}
              size="small"
              placeholder={transcriptLoading ? "Connecting…" : "Type or dictate…"}
              value={composerLine}
              onChange={(e) => onComposerLineChange(e.target.value)}
              disabled={sendChunkDisabled}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleSend(); }
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  height: 34,
                  py: 0,
                  borderRadius: "10px",
                  bgcolor: "transparent",
                  color: hud.hi,
                  "& fieldset": { border: "none" },
                  "&:hover fieldset": { border: "none" },
                  "&.Mui-focused fieldset": { border: "none" },
                },
                "& .MuiInputBase-input": {
                  fontSize: "0.8125rem",
                  lineHeight: "34px",
                  height: 34,
                  py: 0,
                  px: 0.5,
                  boxSizing: "border-box",
                  "&::placeholder": { color: hud.faint, opacity: 1 },
                },
                "& .MuiInputBase-input.Mui-disabled": { WebkitTextFillColor: hud.faint },
              }}
            />

            {voiceActive && (
              <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                <RecordingDot color={theme.palette.error.light} />
              </Box>
            )}

            <Tooltip title="Send (Enter)">
              <Box sx={{ flexShrink: 0, pr: 0.25 }}>
                <IconButton
                  onClick={handleSend}
                  disabled={sendChunkDisabled || !String(composerLine ?? "").trim()}
                  aria-label="Send transcript line"
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: "10px",
                    color: hud.contrastOnAccent,
                    bgcolor: hud.sendBg,
                    border: `1px solid ${hud.sendBorder}`,
                    transition: "background-color 150ms ease, transform 150ms ease",
                    "&:hover": { bgcolor: hud.sendBgHover, transform: "scale(1.04)" },
                    "&.Mui-disabled": { color: hud.faint, borderColor: hud.border, bgcolor: hud.chipMutedBg },
                  }}
                >
                  <SendRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
            </Tooltip>
          </Box>
        </Box>

        <Stack
          sx={{
            flexShrink: 0,
            px: 1.5,
            py: 1.25,
            gap: 1,
            borderTop: `1px solid ${glassBorder}`,
            bgcolor: alpha(theme.palette.common.black, 0.3),
          }}
        >
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: hud.faint, fontSize: "0.6rem" }}
          >
            Speaker
          </Typography>
          <Box
            sx={{
              display: "inline-flex",
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 0.5,
              p: 0.5,
              maxWidth: "100%",
              borderRadius: "999px",
              border: `1px solid ${hud.border}`,
              bgcolor: alpha(theme.palette.common.white, 0.04),
              boxShadow: `inset 0 1px 0 ${hud.insetShine}`,
              overflowX: "auto",
            }}
          >
            {SPEAKER_PRESETS.map((preset) => {
              const on = speakerChip === preset;
              return (
                <Chip
                  key={preset}
                  label={preset}
                  size="small"
                  variant={on ? "filled" : "outlined"}
                  onClick={() => selectPresetChip(preset)}
                  sx={{
                    height: 26,
                    fontWeight: on ? 700 : 500,
                    fontSize: "0.7rem",
                    cursor: "pointer",
                    textTransform: "capitalize",
                    borderRadius: "999px",
                    flexShrink: 0,
                    transition: "background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease",
                    ...(on
                      ? { color: hud.contrastOnAccent, bgcolor: hud.accentMain, border: "none", "&:hover": { bgcolor: hud.chipFilledHover, transform: "translateY(-1px)" } }
                      : { color: hud.mid, borderColor: "transparent", bgcolor: "transparent", "&:hover": { bgcolor: alpha(theme.palette.common.white, 0.08), color: hud.hi } }),
                  }}
                />
              );
            })}
            <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 0.5, flexShrink: 0, minWidth: 0, ...(speakerChip === SPEAKER_OTHER ? { flex: "1 1 130px", maxWidth: "100%" } : {}) }}>
              <Chip
                label="Other"
                size="small"
                variant={speakerChip === SPEAKER_OTHER ? "filled" : "outlined"}
                onClick={() => selectOtherChip()}
                sx={{
                  height: 26,
                  fontWeight: speakerChip === SPEAKER_OTHER ? 700 : 500,
                  fontSize: "0.7rem",
                  cursor: "pointer",
                  borderRadius: "999px",
                  flexShrink: 0,
                  transition: "background-color 160ms ease, border-color 160ms ease, color 160ms ease",
                  ...(speakerChip === SPEAKER_OTHER
                    ? { color: hud.contrastOnAccent, bgcolor: hud.accentMain, border: "none", "&:hover": { bgcolor: hud.chipFilledHover } }
                    : { color: hud.mid, borderColor: "transparent", bgcolor: "transparent", "&:hover": { bgcolor: alpha(theme.palette.common.white, 0.08), color: hud.hi } }),
                }}
              />
              {speakerChip === SPEAKER_OTHER ? (
                <TextField
                  multiline={false}
                  size="small"
                  placeholder="Speaker id"
                  value={customSpeakerInput ?? ""}
                  onChange={(e) => handleCustomSpeakerChange(e.target.value)}
                  disabled={sendChunkDisabled}
                  sx={{
                    flex: "1 1 90px",
                    minWidth: 90,
                    maxWidth: 180,
                    "& .MuiOutlinedInput-root": {
                      height: 26,
                      minHeight: 26,
                      py: 0,
                      px: 0,
                      borderRadius: "999px",
                      boxSizing: "border-box",
                      bgcolor: alpha(theme.palette.common.white, 0.08),
                      color: hud.hi,
                      "& fieldset": { borderColor: hud.border },
                      "&:hover fieldset": { borderColor: hud.borderStrong },
                      "&.Mui-focused fieldset": { borderColor: `${hud.accentMain} !important`, borderWidth: "1px !important" },
                    },
                    "& .MuiInputBase-input": {
                      fontSize: "0.72rem",
                      height: 24,
                      py: 0,
                      px: 1.25,
                      boxSizing: "border-box",
                      "&::placeholder": { color: hud.faint, opacity: 1 },
                    },
                    "& .MuiInputBase-input.Mui-disabled": { WebkitTextFillColor: hud.faint },
                  }}
                />
              ) : null}
            </Box>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
});
