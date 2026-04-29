import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Box,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import {
  getFloatingHudTokens,
  getFloatingHudOvVariants,
  type FloatingHudOvColors,
} from "@/app/providers/theme";
import { SPEAKER_PRESETS } from "@/modules/transcript/constants/speakerPresets";

type BtnVariant = "teal" | "red" | "violet" | "ghost";

const SPEAKER_OTHER = "__other__" as const;

function isPresetSpeakerId(id: string): id is (typeof SPEAKER_PRESETS)[number] {
  return (SPEAKER_PRESETS as readonly string[]).includes(id);
}

const IconMicOn = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
  </svg>
);

const IconMicOff = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
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
    background: dim ? dimTrack : hovered || active ? v.bgH : v.bg,
    border: `2px solid ${dim ? "transparent" : focused || active ? v.ring : "transparent"}`,
    outline: "none",
    cursor: dim ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: dim ? dimTextMuted : hovered || active ? v.colorH : v.color,
    flexShrink: 0,
    transition:
      "background 150ms ease, color 150ms ease, transform 150ms ease, border-color 150ms ease",
    transform: dim || !hovered ? "scale(1)" : "scale(1.05)",
    opacity: dim ? 0.5 : 1,
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

export interface HudComposerBarProps {
  composerLine: string;
  onComposerLineChange: (value: string) => void;
  voiceActive: boolean;
  onVoiceToggle?: () => void;
  onSendChunk?: (payload: { text: string; speakerId: string }) => boolean;
  sendChunkDisabled: boolean;
  transcriptLoading: boolean;
  getDefaultSpeakerId?: () => string;
  onSpeakerChange?: (speakerId: string) => void;
}

export function HudComposerBar({
  composerLine,
  onComposerLineChange,
  voiceActive,
  onVoiceToggle,
  onSendChunk,
  sendChunkDisabled,
  transcriptLoading,
  getDefaultSpeakerId,
  onSpeakerChange,
}: HudComposerBarProps) {
  const theme = useTheme();
  const hud = useMemo(() => getFloatingHudTokens(theme), [theme]);
  const ovVariants = useMemo(() => getFloatingHudOvVariants(theme), [theme]);

  const [speakerChip, setSpeakerChip] = useState<string>(() => {
    const raw = getDefaultSpeakerId?.();
    const id =
      typeof raw === "string" && raw.trim() ? raw.trim() : "interviewee";
    return isPresetSpeakerId(id) ? id : SPEAKER_OTHER;
  });
  const [customSpeakerInput, setCustomSpeakerInput] = useState(() => {
    const raw = getDefaultSpeakerId?.();
    const id =
      typeof raw === "string" && raw.trim() ? raw.trim() : "interviewee";
    return isPresetSpeakerId(id) ? "" : id;
  });

  const effectiveSpeakerId =
    speakerChip === SPEAKER_OTHER
      ? String(customSpeakerInput ?? "").trim() || "interviewee"
      : String(speakerChip ?? "interviewee").trim() || "interviewee";

  const handleSend = useCallback(() => {
    if (!onSendChunk || sendChunkDisabled) return;
    const text = String(composerLine ?? "").trim();
    if (!text) return;
    const rawDefault = getDefaultSpeakerId?.();
    const fallback =
      typeof rawDefault === "string" && rawDefault.trim()
        ? rawDefault.trim()
        : "interviewee";
    const who = String(effectiveSpeakerId ?? "").trim() || fallback;
    const ok = onSendChunk({ text, speakerId: who });
    if (ok) {
      onComposerLineChange("");
    }
  }, [
    onSendChunk,
    sendChunkDisabled,
    composerLine,
    effectiveSpeakerId,
    getDefaultSpeakerId,
    onComposerLineChange,
  ]);

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
        onSpeakerChange?.(String(value ?? "").trim() || "interviewee");
      }
    },
    [speakerChip, onSpeakerChange],
  );

  const glassBorder = hud.glassBorder;

  return (
    <>
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
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
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
              "& .MuiInputBase-input.Mui-disabled": {
                WebkitTextFillColor: hud.faint,
              },
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
                disabled={
                  sendChunkDisabled || !String(composerLine ?? "").trim()
                }
                aria-label="Send transcript line"
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: "10px",
                  color: hud.contrastOnAccent,
                  bgcolor: hud.sendBg,
                  border: `1px solid ${hud.sendBorder}`,
                  transition:
                    "background-color 150ms ease, transform 150ms ease",
                  "&:hover": {
                    bgcolor: hud.sendBgHover,
                    transform: "scale(1.04)",
                  },
                  "&.Mui-disabled": {
                    color: hud.faint,
                    borderColor: hud.border,
                    bgcolor: hud.chipMutedBg,
                  },
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
          sx={{
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: hud.faint,
            fontSize: "0.6rem",
          }}
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
                  transition:
                    "background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease",
                  ...(on
                    ? {
                        color: hud.contrastOnAccent,
                        bgcolor: hud.accentMain,
                        border: "none",
                        "&:hover": {
                          bgcolor: hud.chipFilledHover,
                          transform: "translateY(-1px)",
                        },
                      }
                    : {
                        color: hud.mid,
                        borderColor: "transparent",
                        bgcolor: "transparent",
                        "&:hover": {
                          bgcolor: alpha(theme.palette.common.white, 0.08),
                          color: hud.hi,
                        },
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
              gap: 0.5,
              flexShrink: 0,
              minWidth: 0,
              ...(speakerChip === SPEAKER_OTHER
                ? { flex: "1 1 130px", maxWidth: "100%" }
                : {}),
            }}
          >
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
                transition:
                  "background-color 160ms ease, border-color 160ms ease, color 160ms ease",
                ...(speakerChip === SPEAKER_OTHER
                  ? {
                      color: hud.contrastOnAccent,
                      bgcolor: hud.accentMain,
                      border: "none",
                      "&:hover": { bgcolor: hud.chipFilledHover },
                    }
                  : {
                      color: hud.mid,
                      borderColor: "transparent",
                      bgcolor: "transparent",
                      "&:hover": {
                        bgcolor: alpha(theme.palette.common.white, 0.08),
                        color: hud.hi,
                      },
                    }),
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
                    "&.Mui-focused fieldset": {
                      borderColor: `${hud.accentMain} !important`,
                      borderWidth: "1px !important",
                    },
                  },
                  "& .MuiInputBase-input": {
                    fontSize: "0.72rem",
                    height: 24,
                    py: 0,
                    px: 1.25,
                    boxSizing: "border-box",
                    "&::placeholder": { color: hud.faint, opacity: 1 },
                  },
                  "& .MuiInputBase-input.Mui-disabled": {
                    WebkitTextFillColor: hud.faint,
                  },
                }}
              />
            ) : null}
          </Box>
        </Box>
      </Stack>
    </>
  );
}
