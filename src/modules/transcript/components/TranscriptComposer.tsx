import { FormEvent, useEffect, useState } from "react";
import {
  alpha,
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import RecordVoiceOverOutlinedIcon from "@mui/icons-material/RecordVoiceOverOutlined";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { GlassPanel } from "@/shared/components/GlassPanel";
import { SectionHeader } from "@/shared/components/SectionHeader";
import type { useMicCapture } from "@/modules/transcript/hooks/useMicCapture";
import type { BrowserFirstVoiceControls } from "@/modules/transcript/hooks/useBrowserFirstVoice";
import { isBrowserSpeechRecognitionSupported } from "@/modules/transcript/utils/browserSpeechRecognition";
import { SPEAKER_PRESETS } from "@/modules/transcript/constants/speakerPresets";

const SECTION_LABEL_SX = {
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  display: "block",
  mb: 1.25,
  lineHeight: 1.4,
};

const CONTROL_H = 44;
const INPUT_MIN_HEIGHT = 132;

interface TranscriptComposerProps {
  disabled?: boolean;
  mic: ReturnType<typeof useMicCapture>;
  voice: BrowserFirstVoiceControls;
  onSpeakerChange?: (speakerId: string) => void;
  lineDraft: string;
  onLineDraftChange: (value: string) => void;
  onSubmit: (payload: { text: string; speakerId: string }) => boolean;
  voiceAutoSend?: boolean;
  onVoiceAutoSendChange?: (value: boolean) => void;
}

export function TranscriptComposer({
  disabled,
  mic,
  voice,
  onSpeakerChange,
  lineDraft,
  onLineDraftChange,
  onSubmit,
  voiceAutoSend = true,
  onVoiceAutoSendChange,
}: TranscriptComposerProps) {
  const theme = useTheme();
  const [speakerId, setSpeakerId] = useState("interviewer");

  useEffect(() => {
    onSpeakerChange?.(speakerId);
  }, [speakerId, onSpeakerChange]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = lineDraft.trim();
    const who = speakerId.trim() || "interviewer";
    if (!body) return;
    const didSend = onSubmit({ text: body, speakerId: who });
    if (didSend) {
      onLineDraftChange("");
    }
  };

  const rail = alpha(theme.palette.grey[500], 0.12);

  return (
    <GlassPanel
      sx={{
        overflow: "hidden",
        p: { xs: 2, sm: 2.5 },
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack
        component="form"
        onSubmit={handleSubmit}
        sx={{ width: "100%", gap: { xs: 2.5, sm: 3 } }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{
            gap: { xs: 1.5, sm: 2 },
            alignItems: { xs: "stretch", sm: "flex-start" },
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0, pr: { sm: 1 } }}>
            <SectionHeader
              eyebrow="Input"
              title="Transcript composer"
              subtitle="When supported, browser speech (webkitSpeechRecognition) runs first. Server mic transcription is used if the browser API isn’t available. You can always type and send."
            />
          </Box>
          {disabled ? (
            <Chip
              label="Waiting for connection"
              size="small"
              color="warning"
              variant="outlined"
              sx={{
                flexShrink: 0,
                alignSelf: { xs: "flex-start", sm: "center" },
                height: 32,
                fontWeight: 600,
              }}
            />
          ) : null}
        </Stack>

        <Stack
          sx={{
            borderRadius: "14px",
            border: `1px solid ${rail}`,
            bgcolor: alpha(theme.palette.grey[500], 0.04),
            p: { xs: 2, sm: 2.5 },
            gap: { xs: 2.5, sm: 3 },
            minWidth: 0,
          }}
        >
          <Stack sx={{ gap: 1.25 }}>
            <Typography variant="caption" color="text.secondary" sx={SECTION_LABEL_SX}>
              Speaker
            </Typography>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              sx={{
                gap: { xs: 1.5, lg: 2 },
                alignItems: { xs: "stretch", lg: "center" },
              }}
            >
              <TextField
                size="small"
                label="ID or label"
                placeholder="e.g. interviewer"
                value={speakerId}
                onChange={(event) => setSpeakerId(event.target.value)}
                disabled={disabled}
                fullWidth
                sx={{
                  flex: { lg: "0 1 280px" },
                  maxWidth: { lg: 320 },
                  minWidth: 0,
                  "& .MuiOutlinedInput-root": {
                    minHeight: 40,
                    borderRadius: "10px",
                  },
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <RecordVoiceOverOutlinedIcon sx={{ fontSize: "1.2rem", color: "text.disabled" }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  alignContent: "center",
                  gap: 1,
                  minHeight: 40,
                  flex: { lg: 1 },
                  minWidth: 0,
                }}
              >
                {SPEAKER_PRESETS.map((preset) => {
                  const selected = speakerId.trim().toLowerCase() === preset;
                  return (
                    <Chip
                      key={preset}
                      label={preset}
                      size="small"
                      disabled={disabled}
                      onClick={() => setSpeakerId(preset)}
                      variant={selected ? "filled" : "outlined"}
                      color={selected ? "primary" : "default"}
                      sx={{
                        height: 32,
                        textTransform: "capitalize",
                        fontWeight: 600,
                        ...(!selected && {
                          borderColor: alpha(theme.palette.grey[500], 0.28),
                          bgcolor: alpha(theme.palette.common.white, 0.55),
                        }),
                      }}
                    />
                  );
                })}
              </Box>
            </Stack>
          </Stack>

          <Stack sx={{ gap: 1.25 }}>
            <Typography variant="caption" color="text.secondary" sx={SECTION_LABEL_SX}>
              Line to send
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={4}
              maxRows={14}
              aria-label="Transcript line to send"
              placeholder="Type what was said, or use Voice (browser speech first, server mic if needed)…"
              value={lineDraft}
              onChange={(event) => onLineDraftChange(event.target.value)}
              disabled={disabled}
              variant="outlined"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                  minHeight: INPUT_MIN_HEIGHT,
                  alignItems: "flex-start",
                  py: 1.25,
                  bgcolor: alpha(theme.palette.common.white, 0.92),
                  transition: theme.transitions.create(["background-color", "box-shadow"], {
                    duration: theme.transitions.duration.shorter,
                  }),
                  "&:hover": { bgcolor: theme.palette.common.white },
                  "&.Mui-focused": {
                    bgcolor: theme.palette.common.white,
                    boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`,
                  },
                },
              }}
            />
          </Stack>

          <Stack
            direction="row"
            sx={{
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 2,
              minHeight: CONTROL_H,
              rowGap: 1.5,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1,
                minHeight: CONTROL_H,
                flexShrink: 0,
                minWidth: 0,
              }}
            >
              {voice.supported ? (
                <>
                  <Tooltip
                    title={
                      voice.isActive
                        ? "Stop voice input"
                        : isBrowserSpeechRecognitionSupported()
                          ? "Dictate with browser speech first (server mic if the browser API isn’t available)"
                          : mic.isSupported
                            ? "Record and send audio to the server for transcription"
                            : "Voice input"
                    }
                  >
                    <Box
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        height: CONTROL_H,
                        borderRadius: "12px",
                        px: 0.25,
                        border: `1px solid ${voice.isActive
                          ? alpha(theme.palette.error.main, 0.45)
                          : alpha(theme.palette.primary.main, 0.28)
                          }`,
                        bgcolor: voice.isActive
                          ? alpha(theme.palette.error.main, 0.08)
                          : alpha(theme.palette.primary.main, 0.06),
                        transition: theme.transitions.create(["border-color", "background-color"], {
                          duration: theme.transitions.duration.shorter,
                        }),
                      }}
                    >
                      <IconButton
                        aria-label={voice.isActive ? "Stop voice input" : "Start voice input"}
                        color={voice.isActive ? "error" : "primary"}
                        disabled={disabled}
                        onClick={voice.toggle}
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "10px",
                        }}
                      >
                        {voice.isActive ? <MicOffIcon /> : <MicIcon />}
                      </IconButton>
                      <Typography
                        variant="caption"
                        sx={{
                          pr: 1.75,
                          pl: 0.5,
                          color: voice.isActive ? "error.dark" : "text.secondary",
                          fontWeight: 600,
                          lineHeight: 1.2,
                          display: { xs: "none", sm: "block" },
                          whiteSpace: "nowrap",
                        }}
                      >
                        {voice.speechListening
                          ? "Browser speech…"
                          : mic.isListening
                            ? "Server transcribe…"
                            : "Voice"}
                      </Typography>
                    </Box>
                  </Tooltip>
                  {onVoiceAutoSendChange ? (
                    <Tooltip
                      title={
                        voiceAutoSend
                          ? "Each phrase fills the line and is sent to the feed; the line shows the latest recognition"
                          : "Phrases append in the line only; use Send to feed when ready (nothing auto-posts)"
                      }
                    >
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={voiceAutoSend}
                            onChange={(_, v) => onVoiceAutoSendChange(v)}
                            disabled={disabled}
                            slotProps={{
                              input: { "aria-label": "Auto-fill line and send to feed" },
                            }}
                          />
                        }
                        label={
                          <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                            Auto-Fill
                          </Typography>
                        }
                        sx={{ m: 0, ml: 0.5, gap: 0.5 }}
                      />
                    </Tooltip>
                  ) : null}
                </>
              ) : (
                <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1.5 }}>
                  Voice not available (no browser speech API and no media recorder).
                </Typography>
              )}
            </Box>

            <Button
              type="submit"
              variant="contained"
              disabled={disabled || !lineDraft.trim()}
              endIcon={<SendRoundedIcon />}
              sx={{
                height: CONTROL_H,
                minWidth: { xs: "100%", sm: 168 },
                flex: { xs: "1 1 100%", sm: "0 0 auto" },
                px: 2.75,
                borderRadius: "12px",
                fontWeight: 700,
                textTransform: "none",
                fontSize: "0.9375rem",
                boxShadow: "none",
                alignSelf: { xs: "stretch", sm: "center" },
                "&:hover": {
                  boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.35)}`,
                },
              }}
            >
              Send to feed
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </GlassPanel>
  );
}
