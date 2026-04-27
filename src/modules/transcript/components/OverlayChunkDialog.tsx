import { FormEvent, useEffect, useState, useCallback } from "react";
import {
  alpha,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import type { PortalProps } from "@mui/material/Portal";
import RecordVoiceOverOutlinedIcon from "@mui/icons-material/RecordVoiceOverOutlined";
import { SPEAKER_PRESETS } from "@/modules/transcript/constants/speakerPresets";

export interface OverlayChunkDialogProps {
  open: boolean;
  onClose: () => void;
  disabled: boolean;
  onSendChunk: (payload: { text: string; speakerId: string }) => boolean;
  getDefaultSpeakerId?: () => string;
  /** Modal portal root (e.g. Document PiP `document.body`). Defaults to owner document. */
  container?: PortalProps["container"];
}

export function OverlayChunkDialog({
  open,
  onClose,
  disabled,
  onSendChunk,
  getDefaultSpeakerId,
  container,
}: OverlayChunkDialogProps) {
  const theme = useTheme();
  const [speakerId, setSpeakerId] = useState("interviewer");
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSpeakerId(getDefaultSpeakerId?.() ?? "interviewer");
    setText("");
    setSendError(null);
  }, [open, getDefaultSpeakerId]);

  const handleClose = useCallback(() => {
    setSendError(null);
    onClose();
  }, [onClose]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || disabled) return;
    setSendError(null);
    const ok = onSendChunk({ text: t, speakerId: speakerId.trim() || "interviewer" });
    if (ok) {
      setText("");
      handleClose();
    } else {
      setSendError("Could not send — wait until you are connected, then try again.");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      container={container}
      slotProps={{
        root: { sx: { zIndex: 11000 } },
        paper: {
          sx: { borderRadius: "14px" },
        },
      }}
    >
      <DialogTitle sx={{ pb: 0.5, fontWeight: 700 }}>Transcript composer</DialogTitle>
      <DialogContent>
        <Stack component="form" id="overlay-chunk-form" spacing={2.5} sx={{ pt: 1 }} onSubmit={handleSubmit}>
          {disabled ? (
            <Typography variant="body2" color="text.secondary">
              Connect to the live session first, then you can push text the same way as the main composer.
            </Typography>
          ) : null}
          <Stack spacing={1.25}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Speaker
            </Typography>
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: 1.5,
                alignItems: { xs: "stretch", sm: "center" },
              }}
            >
              <TextField
                size="small"
                label="ID or label"
                placeholder="e.g. interviewer"
                fullWidth
                value={speakerId}
                onChange={(ev) => setSpeakerId(ev.target.value)}
                disabled={disabled}
                sx={{
                  flex: { sm: "0 1 280px" },
                  maxWidth: { sm: 320 },
                  "& .MuiOutlinedInput-root": { borderRadius: "10px" },
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
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
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
            </Box>
          </Stack>
          <Stack spacing={0.75}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Line to send
            </Typography>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={4}
              value={text}
              onChange={(ev) => setText(ev.target.value)}
              disabled={disabled}
              placeholder="Type what was said…"
              aria-label="Transcript line to send"
              error={Boolean(sendError)}
              helperText={sendError ?? undefined}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={handleClose} sx={{ borderRadius: "10px" }}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="overlay-chunk-form"
          variant="contained"
          disabled={disabled || !text.trim()}
          sx={{ borderRadius: "10px" }}
        >
          Send
        </Button>
      </DialogActions>
    </Dialog>
  );
}
