import { memo, useCallback, useEffect, useMemo, useState, CSSProperties } from "react";
import { useTheme } from "@mui/material/styles";
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { getFloatingHudOvVariants, getFloatingHudTokens, type FloatingHudOvColors } from "@/app/providers/theme";
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

function isPresetSpeakerId(id: string): id is (typeof SPEAKER_PRESETS)[number] {
  return (SPEAKER_PRESETS as readonly string[]).includes(id);
}

const Z_FLOAT = 10050;

type HudLayout = "embed" | "pip";

const IconMicOn = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
  </svg>
);

const IconMicOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3 3 4.27l6.01 6.01V11c0 1.66 1.34 3 3 3 .23 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c.57-.08 1.12-.24 1.64-.46L19.73 21 21 19.73 4.27 3z" />
  </svg>
);

type BtnVariant = "teal" | "red" | "violet" | "ghost";

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
    transform: dim || !hovered ? "scale(1)" : "scale(1.12)",
    opacity: dim ? 0.55 : 1,
    pointerEvents: dim ? "none" : "auto",
  };

  return (
    <button
      type="button"
      style={style}
      onClick={() => {
        if (!dim) onClick();
      }}
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

type TabKey = "suggestions" | "capture" | "speaker";

function isTextualFieldTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
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
}

export const FloatingPulseHudPanel = memo(function FloatingPulseHudPanel({
  visible,
  layout,
  helpText: _helpText,
  showPipLaunch,
  onRequestDocumentPip,
  pipSupported,
  onClose,
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
}: FloatingPulseHudPanelProps) {
  const theme = useTheme();
  const hud = useMemo(() => getFloatingHudTokens(theme), [theme]);
  const ovVariants = useMemo(() => getFloatingHudOvVariants(theme), [theme]);
  const [activeTab, setActiveTab] = useState<TabKey>("suggestions");
  const [usedPromptIds, setUsedPromptIds] = useState<Set<string>>(() => new Set());
  const [dismissedPromptIds, setDismissedPromptIds] = useState<Set<string>>(() => new Set());
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

  const effectiveSpeakerId =
    speakerChip === SPEAKER_OTHER
      ? String(customSpeakerInput ?? "").trim() || "interviewer"
      : String(speakerChip ?? "interviewer").trim() || "interviewer";

  const transcriptLoading = transcriptStatus === "connecting" || transcriptStatus === "reconnecting";

  const visiblePrompts = useMemo(
    () => prompts.filter((p) => !dismissedPromptIds.has(p.id)),
    [prompts, dismissedPromptIds],
  );

  const handlePromptUse = useCallback(
    (id: string) => {
      setUsedPromptIds((prev) => new Set([...prev, id]));
      onPromptUse?.(id);
    },
    [onPromptUse],
  );

  const handlePromptDismiss = useCallback(
    (id: string) => {
      setDismissedPromptIds((prev) => new Set([...prev, id]));
      onPromptDismiss?.(id);
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
    const rawDefault = getDefaultSpeakerId?.();
    const fallback = typeof rawDefault === "string" && rawDefault.trim() ? rawDefault.trim() : "interviewer";
    const who = String(effectiveSpeakerId ?? "").trim() || fallback;
    if (!text) return;
    const ok = onSendChunk({ text, speakerId: who });
    if (ok) onComposerLineChange("");
  }, [onSendChunk, sendChunkDisabled, composerLine, effectiveSpeakerId, getDefaultSpeakerId, onComposerLineChange]);

  const glassBg = hud.glassBg;
  const glassBorder = hud.glassBorder;

  const isPip = layout === "pip";

  useEffect(() => {
    if (!visible || activeTab !== "capture" || !onQuickTag) return;
    const tags = quickTags;
    if (!tags.length) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return;
      if (e.repeat) return;

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
        right: 16,
        bottom: "max(16px, env(safe-area-inset-bottom, 0px))",
        width: FLOATING_HUD_WIDTH,
        maxWidth: "calc(100vw - 24px)",
        maxHeight: "min(640px, calc(100vh - 32px))",
        zIndex: Z_FLOAT,
        pointerEvents: visible ? ("auto" as const) : ("none" as const),
        isolation: "isolate" as const,
      };

  const tabPanel = (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        px: 1.5,
        py: 1.25,
        color: hud.hi,
      }}
    >
      {activeTab === "suggestions" ? (
        <>
          {visiblePrompts.length ? (
            <Stack spacing={1.25}>
              {visiblePrompts.map((prompt) => {
                const origin = prompt.suggestionOrigin ?? "local";
                const isModel = origin === "model";
                const timeLabel = prompt.transcriptTimeLabel ?? formatClock(prompt.timestamp);
                return (
                  <Box
                    key={prompt.id}
                    sx={{
                      p: 1.25,
                      borderRadius: 2,
                      bgcolor: hud.card,
                      border: `1px solid ${hud.border}`,
                      boxShadow: `inset 0 1px 0 ${hud.insetShine}`,
                    }}
                  >
                    <Stack sx={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 0.5 }}>
                      <Stack sx={{ flex: 1, minWidth: 0, gap: 0.65 }}>
                        <Typography variant="subtitle2" sx={{ fontSize: "0.82rem", lineHeight: 1.35, color: hud.hi, fontWeight: 650 }}>
                          {prompt.title}
                        </Typography>
                        <Stack sx={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 0.5 }}>
                          <Chip
                            size="small"
                            variant="outlined"
                            icon={isModel ? <AutoAwesomeRoundedIcon sx={{ "&&": { fontSize: 14, color: hud.accentMain } }} /> : <RuleRoundedIcon sx={{ "&&": { fontSize: 14, color: hud.mid } }} />}
                            label={isModel ? "AI" : "Rules"}
                            sx={{
                              height: 22,
                              fontSize: "0.62rem",
                              color: hud.mid,
                              borderColor: hud.border,
                              bgcolor: hud.chipMutedBg,
                              "& .MuiChip-icon": { color: "inherit" },
                            }}
                          />
                          <Chip
                            label={timeLabel}
                            size="small"
                            variant="outlined"
                            sx={{ height: 22, fontSize: "0.62rem", color: hud.low, borderColor: hud.border, bgcolor: hud.chipMutedBg }}
                          />
                        </Stack>
                        <Typography
                          variant="caption"
                          sx={{
                            color: hud.low,
                            display: "-webkit-box",
                            WebkitLineClamp: 4,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            lineHeight: 1.45,
                          }}
                        >
                          {prompt.body}
                        </Typography>
                      </Stack>
                      <Stack sx={{ flexDirection: "row", flexShrink: 0 }}>
                        <Tooltip title="Mark used">
                          <IconButton
                            size="small"
                            disabled={usedPromptIds.has(prompt.id)}
                            onClick={() => handlePromptUse(prompt.id)}
                            aria-label="Mark prompt used"
                            sx={{ color: hud.mid, "&:hover": { bgcolor: hud.hoverWash } }}
                          >
                            <CheckRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Dismiss">
                          <IconButton size="small" onClick={() => handlePromptDismiss(prompt.id)} aria-label="Dismiss prompt" sx={{ color: hud.mid, "&:hover": { bgcolor: hud.hoverWash } }}>
                            <CloseRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: hud.low }}>
              Suggestions appear as patterns show up in the feed.
            </Typography>
          )}
        </>
      ) : null}

      {activeTab === "capture" ? (
        <Stack spacing={1.5}>
          <Typography variant="body2" sx={{ lineHeight: 1.55, color: hud.low }}>
            Tap a tag to attach it to the currently selected transcript line in the main Pulse tab.
          </Typography>
          {quickTags.length ? (
            <Typography variant="caption" sx={{ display: "block", lineHeight: 1.45, color: hud.faint }}>
              Each tag shows its keyboard shortcut (digits match the tag palette, including any custom shortcutDigit on
              a tag). Shortcuts apply while this tab is open and do not run while focus is in any text field. In a normal
              browser tab, Ctrl+1–8 may switch tabs instead; Document PiP avoids that.
            </Typography>
          ) : null}
          {quickTags.length ? (
            <Stack sx={{ flexDirection: "row", flexWrap: "wrap", gap: 0.85 }}>
              {quickTags.map((tag, idx) => {
                const digitKey = paletteDigitForTag(tag, idx);
                const shortcutText = digitKey ? formatCtrlShortcut(digitKey) : null;
                const displayName = String(tag.label ?? "").trim() || tag.id;
                const tooltipTitle = shortcutText ? `${displayName} (${shortcutText})` : displayName;
                return (
                  <Tooltip key={tag.id} title={tooltipTitle}>
                    <Chip
                      label={
                        <Box
                          component="span"
                          sx={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: 0.65, py: 0.15 }}
                        >
                          <Typography
                            component="span"
                            variant="body2"
                            sx={{ fontWeight: 650, fontSize: "0.8rem", lineHeight: 1.3, color: "inherit" }}
                          >
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
                        minHeight: 30,
                        py: 0.35,
                        fontWeight: 600,
                        cursor: onQuickTag ? "pointer" : "default",
                        color: hud.hi,
                        borderColor: hud.border,
                        bgcolor: hud.field,
                        borderRadius: "10px",
                        letterSpacing: "0.02em",
                        "& .MuiChip-label": { px: 1, py: 0.25 },
                        "&:hover": onQuickTag ? { bgcolor: hud.fieldHover, borderColor: hud.borderStrong } : undefined,
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: hud.low }}>
              No quick tags configured for this session.
            </Typography>
          )}
        </Stack>
      ) : null}

      {activeTab === "speaker" ? (
        <>
          {transcriptPreview.length ? (
            <Stack spacing={1}>
              {transcriptPreview.map((item) => (
                <Box key={item.id} sx={{ minWidth: 0, py: 0.5, borderBottom: `1px solid ${hud.lineDivider}`, "&:last-of-type": { borderBottom: "none" } }}>
                  <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 0.75, mb: 0.45 }}>
                    <Chip
                      label={item.speakerId}
                      size="small"
                      variant="outlined"
                      sx={{ height: 22, fontSize: "0.65rem", fontWeight: 600, color: hud.mid, borderColor: hud.border, bgcolor: hud.chipMutedBg }}
                    />
                    <Typography variant="caption" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: hud.accent }}>
                      {item.formattedTime}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ lineHeight: 1.55, color: hud.hi, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
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
        </>
      ) : null}
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
          transform: visible ? "scale(1) translateY(0)" : "scale(0.96) translateY(4px)",
          transition: "opacity 240ms ease, transform 240ms ease",
          borderRadius: isPip ? 0 : 2.5,
          overflow: "hidden",
          bgcolor: glassBg,
          backdropFilter: "blur(22px) saturate(160%)",
          WebkitBackdropFilter: "blur(22px) saturate(160%)",
          border: isPip ? "none" : `1px solid ${glassBorder}`,
          boxShadow: isPip ? "none" : hud.embedShadow,
          height: "100%",
          maxHeight: isPip ? "100%" : "min(640px, calc(100vh - 32px))",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            flexShrink: 0,
            display: "flex",
            alignItems: "stretch",
            borderBottom: `1px solid ${glassBorder}`,
            bgcolor: hud.chrome,
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
              minHeight: 40,
              "& .MuiTab-root": {
                minHeight: 40,
                py: 0.75,
                px: 1.1,
                fontSize: "0.7rem",
                textTransform: "none",
                fontWeight: 600,
                color: hud.low,
                "&.Mui-selected": { color: hud.hi },
              },
              "& .MuiTabs-indicator": { bgcolor: hud.accentMain, height: 3, borderRadius: "3px 3px 0 0" },
              "& .MuiTabScrollButton-root": { color: hud.mid, "&.Mui-disabled": { opacity: 0.3 } },
            }}
          >
            <Tab value="suggestions" label="Live suggestions" />
            <Tab value="capture" label="Capture moment" />
            <Tab value="speaker" label="Live speaker" />
          </Tabs>
          {showPipLaunch && pipSupported && onRequestDocumentPip ? (
            <Stack direction="row" sx={{ flexShrink: 0, alignItems: "center", borderLeft: `1px solid ${glassBorder}`, pr: 0.25 }}>
              <Tooltip title="Always on top (Chrome Document Picture-in-Picture)" placement="bottom">
                <IconButton size="small" onClick={onRequestDocumentPip} aria-label="Open always-on-top window" sx={{ color: hud.mid, "&:hover": { color: hud.hi, bgcolor: hud.hoverChrome } }}>
                  <PictureInPictureAltOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ) : null}
        </Box>

        {tabPanel}

        <Box sx={{ flexShrink: 0, px: 1.25, pt: 1, pb: 1.25, borderTop: `1px solid ${glassBorder}`, bgcolor: hud.chromeSoft }}>
          {transcriptLoading ? (
            <LinearProgress
              sx={{
                mb: 1.25,
                borderRadius: 999,
                height: 3,
                bgcolor: hud.railBg,
                "& .MuiLinearProgress-bar": { bgcolor: hud.accentMain },
              }}
            />
          ) : null}
          <Stack direction="row" sx={{ gap: 0.75, alignItems: "center" }}>
            <Box sx={{ position: "relative", flex: 1, minWidth: 0 }}>
              <TextField
                fullWidth
                multiline={false}
                size="small"
                placeholder={transcriptLoading ? "Connecting…" : "Type or dictate!"}
                value={composerLine}
                onChange={(e) => onComposerLineChange(e.target.value)}
                disabled={sendChunkDisabled}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                slotProps={{
                  input: {
                    startAdornment: transcriptLoading ? (
                      <InputAdornment position="start" sx={{ alignSelf: "center", m: 0, mr: 0.5, height: 32, maxHeight: 32 }}>
                        <CircularProgress size={14} thickness={5} sx={{ color: hud.accentMain }} />
                      </InputAdornment>
                    ) : undefined,
                  },
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    height: 36,
                    minHeight: 36,
                    maxHeight: 36,
                    py: 2,
                    pr: "44px",
                    boxSizing: "border-box",
                    alignItems: "center",
                    borderRadius: 1.5,
                    bgcolor: hud.field,
                    color: hud.hi,
                    transition: "background-color 160ms ease, border-color 160ms ease",
                    "&:hover": { bgcolor: hud.fieldHover },
                    "& fieldset": { borderColor: hud.border },
                    "&:hover fieldset": { borderColor: hud.borderStrong },
                    "&.Mui-focused fieldset": { borderColor: `${hud.accentMain} !important`, borderWidth: "1px !important" },
                  },
                  "& .MuiInputBase-input": {
                    fontSize: "0.8125rem",
                    lineHeight: "34px",
                    height: 34,
                    py: 0,
                    px: 1.25,
                    margin: 0,
                    boxSizing: "border-box",
                    userSelect: "text",
                    WebkitUserSelect: "text",
                    "&::placeholder": { color: hud.faint, opacity: 1, lineHeight: "34px" },
                  },
                  "& .MuiInputBase-input.Mui-disabled": { WebkitTextFillColor: hud.faint },
                }}
              />
              <Tooltip title={voiceActive ? "Stop voice input" : "Start voice input"}>
                <Box
                  sx={{
                    position: "absolute",
                    right: 6,
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 1,
                    pointerEvents: "auto",
                  }}
                >
                  <OvBtn
                    variant={voiceActive ? "red" : "teal"}
                    ariaLabel={voiceActive ? "Stop voice input" : "Start voice input"}
                    onClick={() => onVoiceToggle?.()}
                    size={32}
                    disabled={Boolean(sendChunkDisabled && !voiceActive)}
                    ovVariants={ovVariants}
                    dimTrack={hud.dimTrack}
                    dimTextMuted={hud.dimTextMuted}
                  >
                    {voiceActive ? <IconMicOff /> : <IconMicOn />}
                  </OvBtn>
                </Box>
              </Tooltip>
            </Box>
            <Tooltip title="Send line">
              <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                <IconButton
                  onClick={handleSend}
                  disabled={sendChunkDisabled || !String(composerLine ?? "").trim()}
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1.5,
                    color: hud.hi,
                    bgcolor: hud.sendBg,
                    border: `1px solid ${hud.sendBorder}`,
                    "&:hover": { bgcolor: hud.sendBgHover },
                    "&.Mui-disabled": { color: hud.faint, borderColor: hud.border, bgcolor: hud.chipMutedBg },
                  }}
                  aria-label="Send transcript line"
                >
                  <SendRoundedIcon />
                </IconButton>
              </Box>
            </Tooltip>
          </Stack>
        </Box>

        <Stack
          sx={{
            flexShrink: 0,
            px: 1.25,
            py: 1.1,
            gap: 0.85,
            borderTop: `1px solid ${glassBorder}`,
            bgcolor: hud.chromeDeep,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: hud.low, fontSize: "0.65rem" }}>
            Speaker
          </Typography>
          <Stack
            sx={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 0.75,
              alignItems: "center",
              overflowX: "auto",
              pb: 0.25,
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
                    height: 30,
                    fontWeight: 650,
                    cursor: "pointer",
                    textTransform: "capitalize",
                    borderRadius: "10px",
                    flexShrink: 0,
                    ...(on
                      ? {
                          color: hud.contrastOnAccent,
                          bgcolor: hud.accentMain,
                          border: "none",
                          "&:hover": { bgcolor: hud.chipFilledHover },
                        }
                      : {
                          color: hud.mid,
                          borderColor: hud.border,
                          bgcolor: hud.field,
                          "&:hover": { bgcolor: hud.fieldHover, borderColor: hud.borderStrong, color: hud.hi },
                        }),
                  }}
                />
              );
            })}
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 0.75,
                flexShrink: 0,
                minWidth: 0,
                ...(speakerChip === SPEAKER_OTHER ? { flex: "1 1 140px", maxWidth: "100%" } : {}),
              }}
            >
              <Chip
                label="Other"
                size="small"
                variant={speakerChip === SPEAKER_OTHER ? "filled" : "outlined"}
                onClick={() => selectOtherChip()}
                sx={{
                  height: 30,
                  fontWeight: 650,
                  cursor: "pointer",
                  borderRadius: "10px",
                  flexShrink: 0,
                  ...(speakerChip === SPEAKER_OTHER
                    ? {
                        color: hud.contrastOnAccent,
                        bgcolor: hud.accentMain,
                        border: "none",
                        "&:hover": { bgcolor: hud.chipFilledHover },
                      }
                    : {
                        color: hud.mid,
                        borderColor: hud.border,
                        bgcolor: hud.field,
                        "&:hover": { bgcolor: hud.fieldHover, borderColor: hud.borderStrong, color: hud.hi },
                      }),
                }}
              />
              {speakerChip === SPEAKER_OTHER ? (
                <TextField
                  multiline={false}
                  size="small"
                  placeholder="Speaker id or label"
                  value={customSpeakerInput ?? ""}
                  onChange={(e) => handleCustomSpeakerChange(e.target.value)}
                  disabled={sendChunkDisabled}
                  sx={{
                    flex: "1 1 96px",
                    minWidth: 96,
                    maxWidth: 200,
                    "& .MuiOutlinedInput-root": {
                      height: 30,
                      minHeight: 30,
                      maxHeight: 30,
                      py: 0,
                      px: 0,
                      borderRadius: "10px",
                      boxSizing: "border-box",
                      alignItems: "center",
                      bgcolor: hud.field,
                      color: hud.hi,
                      "&:hover": { bgcolor: hud.fieldHover },
                      "& fieldset": { borderColor: hud.border },
                      "&:hover fieldset": { borderColor: hud.borderStrong },
                      "&.Mui-focused fieldset": { borderColor: `${hud.accentMain} !important`, borderWidth: "1px !important" },
                    },
                    "& .MuiInputBase-input": {
                      fontSize: "0.78rem",
                      lineHeight: "28px",
                      height: 28,
                      py: 0,
                      px: 1,
                      margin: 0,
                      boxSizing: "border-box",
                      "&::placeholder": { color: hud.faint, opacity: 1, lineHeight: "28px" },
                    },
                    "& .MuiInputBase-input.Mui-disabled": { WebkitTextFillColor: hud.faint },
                  }}
                />
              ) : null}
            </Box>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
});
