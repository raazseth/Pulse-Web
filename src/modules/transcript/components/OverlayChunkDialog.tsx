import { FormEvent, useEffect, useState, useCallback } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

export interface OverlayChunkDialogProps {
  open: boolean;
  onClose: () => void;
  disabled: boolean;
  onSendChunk: (payload: { text: string; speakerId: string }) => boolean;
  getDefaultSpeakerId?: () => string;
}

export function OverlayChunkDialog({
  open,
  onClose,
  disabled,
  onSendChunk,
  getDefaultSpeakerId,
}: OverlayChunkDialogProps) {
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
      slotProps={{
        root: { sx: { zIndex: 11000 } },
        paper: {
          sx: { borderRadius: "14px" },
        },
      }}
    >
      <DialogTitle sx={{ pb: 0.5, fontWeight: 700 }}>Send transcript chunk</DialogTitle>
      <DialogContent>
        <Stack component="form" id="overlay-chunk-form" spacing={2} sx={{ pt: 1 }} onSubmit={handleSubmit}>
          {disabled ? (
            <Typography variant="body2" color="text.secondary">
              Connect to the live session first, then you can push text the same way as the main composer.
            </Typography>
          ) : null}
          <TextField
            label="Speaker"
            size="small"
            fullWidth
            value={speakerId}
            onChange={(ev) => setSpeakerId(ev.target.value)}
            disabled={disabled}
          />
          <TextField
            label="Transcript text"
            size="small"
            fullWidth
            multiline
            minRows={4}
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            disabled={disabled}
            placeholder="Type what was said…"
            error={Boolean(sendError)}
            helperText={sendError ?? undefined}
          />
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
          Send chunk
        </Button>
      </DialogActions>
    </Dialog>
  );
}
