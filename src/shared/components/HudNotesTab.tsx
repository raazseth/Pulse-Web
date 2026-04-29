import { ChangeEvent, KeyboardEvent, memo } from "react";
import {
  alpha,
  Box,
  Chip,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { FloatingHudTokens } from "@/app/providers/theme";
import { useEditableNotes } from "@/modules/context/hooks/useEditableNotes";
import type { SessionNote } from "@/modules/context/types";
import type { TagOption, TranscriptTag } from "@/modules/tagging/types";
import { tagChipOutlinedRestSx } from "@/modules/tagging/utils/tagChipStyles";

export interface HudNotesTabProps {
  hud: FloatingHudTokens;
  notes: SessionNote[];
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

export const HudNotesTab = memo(function HudNotesTab({
  hud,
  notes,
  availableTags = [],
  transcriptTags = [],
  onNotesChange,
  onNoteAdd,
  onNoteDelete,
  onNoteSave,
  onNoteCommit,
  onNoteTagAdd,
  onNoteTagRemove,
}: HudNotesTabProps) {
  const theme = useTheme();
  const editableNotes = useEditableNotes(notes);
  const canEdit = Boolean(onNotesChange && onNoteAdd);

  const handleNoteChange = (
    noteId: string,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (!onNotesChange) return;
    if (notes.some((n) => n.id === noteId && n.editorLocked)) return;
    const body = event.target.value;
    const updated = notes.map((note) =>
      note.id === noteId ? { ...note, body } : note,
    );
    onNotesChange(updated);
    const changed = updated.find((n) => n.id === noteId);
    if (changed) onNoteSave?.(changed);
  };

  const handleTagToggle = (noteId: string, tagId: string, currentlyLinked: boolean) => {
    if (notes.some((n) => n.id === noteId && n.editorLocked)) return;
    if (currentlyLinked) onNoteTagRemove?.(noteId, tagId);
    else onNoteTagAdd?.(noteId, tagId);
  };

  const handleNoteKeyDown = (note: SessionNote, e: KeyboardEvent<HTMLDivElement>) => {
    if (note.editorLocked) return;
    if (e.key !== "Enter" || e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;
    if (!onNotesChange || !onNoteCommit) return;
    e.preventDefault();
    const body = String(note.body ?? "");
    onNoteCommit({ ...note, body });
    onNotesChange(
      notes.map((n) =>
        n.id === note.id ? { ...n, body, editorLocked: true, isDraft: false } : n,
      ),
    );
  };

  const uniqueTagOptions = availableTags.filter((opt) =>
    transcriptTags.some((t) => t.tagId === opt.id),
  );

  if (!canEdit) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1.5, py: 1.5 }}>
        <Typography variant="body2" sx={{ lineHeight: 1.55, color: hud.mid, fontSize: "0.8125rem" }}>
          Session notes sync from the main Pulse tab. Open the dashboard there to add or edit notes with the API.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1.5, py: 1.15 }}>
        <Stack spacing={1.15}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: hud.faint,
              fontSize: "0.6rem",
              display: "block",
            }}
          >
            Session notes
          </Typography>
          {editableNotes.map((note) => {
            const linkedIds = note.linkedTagIds ?? [];
            return (
              <Box
                key={note.id}
                sx={{
                  p: 1.25,
                  borderRadius: "10px",
                  border: `1px solid ${hud.border}`,
                  bgcolor: hud.card,
                  transition: "border-color 160ms ease, box-shadow 160ms ease",
                  "&:focus-within": {
                    borderColor: hud.borderStrong,
                    boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
                  },
                }}
              >
                <Stack
                  direction="row"
                  sx={{
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    mb: 0.5,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: hud.faint,
                      fontSize: "0.58rem",
                    }}
                  >
                    {note.label}
                  </Typography>
                  {onNoteDelete ? (
                    <Tooltip title="Delete note">
                      <IconButton
                        size="small"
                        onClick={() => onNoteDelete(note.id)}
                        aria-label={`Delete ${note.label ?? "note"}`}
                        sx={{
                          p: 0.2,
                          color: hud.faint,
                          "&:hover": { color: theme.palette.error.light },
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </Stack>

                <TextField
                  fullWidth
                  size="small"
                  multiline
                  minRows={2}
                  value={note.body}
                  onChange={(e) => handleNoteChange(note.id, e)}
                  onKeyDown={(e) => handleNoteKeyDown(note, e)}
                  variant="standard"
                  placeholder="Hypotheses, follow-ups…"
                  slotProps={{
                    input: {
                      disableUnderline: true,
                      readOnly: Boolean(note.editorLocked),
                    },
                  }}
                  sx={{
                    "& .MuiInputBase-input": {
                      fontSize: "0.8125rem",
                      lineHeight: 1.55,
                      py: 0.35,
                      color: hud.hi,
                      ...(note.editorLocked ? { cursor: "default" } : {}),
                    },
                  }}
                />
                {!note.editorLocked ? (
                  <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: hud.faint, fontSize: "0.58rem", lineHeight: 1.45 }}>
                    Enter — save to server and lock · Shift+Enter — new line
                  </Typography>
                ) : (
                  <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: hud.faint, fontSize: "0.58rem", lineHeight: 1.45 }}>
                    Saved and locked. Delete this note to edit again.
                  </Typography>
                )}

                {uniqueTagOptions.length > 0 && (onNoteTagAdd || onNoteTagRemove) ? (
                  <Stack sx={{ mt: 1, gap: 0.35 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: hud.faint, fontSize: "0.58rem" }}>
                      Link to captured tags
                    </Typography>
                    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
                      {uniqueTagOptions.map((opt) => {
                        const matchingTag = transcriptTags.find((t) => t.tagId === opt.id);
                        if (!matchingTag) return null;
                        const isLinked = linkedIds.includes(matchingTag.id);
                        return (
                          <Chip
                            key={`${note.id}-${opt.id}`}
                            label={opt.label}
                            size="small"
                            color={opt.color}
                            variant={isLinked ? "filled" : "outlined"}
                            onClick={() => handleTagToggle(note.id, matchingTag.id, isLinked)}
                            disabled={Boolean(note.editorLocked)}
                            sx={{
                              height: 22,
                              fontSize: "0.65rem",
                              fontWeight: 600,
                              cursor: note.editorLocked ? "default" : "pointer",
                              ...(isLinked ? {} : tagChipOutlinedRestSx(theme, opt.color)),
                            }}
                          />
                        );
                      })}
                    </Stack>
                  </Stack>
                ) : null}
              </Box>
            );
          })}

          {editableNotes.length === 0 ? (
            <Typography variant="body2" sx={{ textAlign: "center", py: 2, lineHeight: 1.55, color: hud.low, fontSize: "0.8125rem" }}>
              No notes yet. Use + in the bar above to add a session note; only one new note can be open at a time. Press Enter to save and lock, then you can add more.
            </Typography>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
});
