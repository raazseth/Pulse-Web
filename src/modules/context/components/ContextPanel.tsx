import { ChangeEvent, KeyboardEvent } from "react";
import {
  alpha,
  Box,
  Chip,
  Grid,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { GlassPanel } from "@/shared/components/GlassPanel";
import { SectionHeader } from "@/shared/components/SectionHeader";
import { useEditableNotes } from "@/modules/context/hooks/useEditableNotes";
import { SessionMetadata, SessionNote } from "@/modules/context/types";
import { TagOption, TranscriptTag } from "@/modules/tagging/types";
import { tagChipOutlinedRestSx } from "@/modules/tagging/utils/tagChipStyles";

interface ContextPanelProps {
  metadata: SessionMetadata;
  notes: SessionNote[];
  availableTags?: TagOption[];
  transcriptTags?: TranscriptTag[];
  onMetadataChange: (patch: Partial<SessionMetadata>) => void;
  onNotesChange: (notes: SessionNote[]) => void;
  onNoteAdd?: () => void;
  onNoteDelete?: (noteId: string) => void;
  onNoteSave?: (note: SessionNote) => void;
  onNoteCommit?: (note: SessionNote) => void;
  onNoteTagAdd?: (noteId: string, tagId: string) => void;
  onNoteTagRemove?: (noteId: string, tagId: string) => void;
}

export function ContextPanel({
  metadata,
  notes,
  availableTags = [],
  transcriptTags = [],
  onMetadataChange,
  onNotesChange,
  onNoteAdd,
  onNoteDelete,
  onNoteSave,
  onNoteCommit,
  onNoteTagAdd,
  onNoteTagRemove,
}: ContextPanelProps) {
  const theme = useTheme();
  const rail = alpha(theme.palette.grey[500], 0.12);
  const editableNotes = useEditableNotes(notes);

  const wellSx = {
    borderRadius: "14px",
    border: `1px solid ${rail}`,
    bgcolor: alpha(theme.palette.grey[500], 0.04),
    p: { xs: 1.75, sm: 2 },
    minWidth: 0,
  };

  const fieldSx = {
    "& .MuiInputBase-root": { borderRadius: "10px" },
  };

  const handleNoteChange = (
    noteId: string,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
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
    if (currentlyLinked) {
      onNoteTagRemove?.(noteId, tagId);
    } else {
      onNoteTagAdd?.(noteId, tagId);
    }
  };

  const handleNoteKeyDown = (note: SessionNote, e: KeyboardEvent<HTMLDivElement>) => {
    if (note.editorLocked) return;
    if (e.key !== "Enter" || e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;
    if (!onNoteCommit) return;
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

  return (
    <GlassPanel
      sx={{
        overflow: "hidden",
        p: { xs: 2, sm: 2.5 },
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack sx={{ width: "100%", gap: { xs: 2.25, sm: 2.5 } }}>
        <SectionHeader
          eyebrow="Context"
          title="Session framing"
          subtitle="Title and study fields sync to the server. Session notes autosave while typing; press Enter to save immediately and lock the body (Shift+Enter adds a line). Only one new note from + can be open at a time until you save or delete it — then you can add more. Link notes to transcript tags you have already captured."
        />

        <Box sx={wellSx}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              display: "block",
              mb: 1.5,
              lineHeight: 1.4,
            }}
          >
            Metadata
          </Typography>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                label="Session title"
                value={metadata.title}
                onChange={(e) => onMetadataChange({ title: e.target.value })}
                sx={fieldSx}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                label="Facilitator"
                value={metadata.facilitator}
                onChange={(e) => onMetadataChange({ facilitator: e.target.value })}
                sx={fieldSx}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                label="Audience"
                value={metadata.audience}
                onChange={(e) => onMetadataChange({ audience: e.target.value })}
                sx={fieldSx}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                label="Participant role"
                placeholder="e.g. Product Manager"
                value={metadata.role}
                onChange={(e) => onMetadataChange({ role: e.target.value })}
                sx={fieldSx}
              />
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ ...wellSx, bgcolor: alpha(theme.palette.grey[500], 0.03) }}>
          <Stack
            direction="row"
            sx={{
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1.5,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                lineHeight: 1.4,
              }}
            >
              Notes
            </Typography>
            {onNoteAdd ? (
              <Tooltip
                title={
                  notes.some((n) => n.isDraft)
                    ? "Finish the note you started (Enter to save) or delete it before adding another."
                    : "Add session note"
                }
              >
                <span>
                  <IconButton
                    size="small"
                    onClick={onNoteAdd}
                    disabled={notes.some((n) => n.isDraft)}
                    aria-label="Add note"
                  >
                    <AddIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
          </Stack>

          <Stack sx={{ gap: 1.5 }}>
            {editableNotes.map((note) => {
              const linkedIds = note.linkedTagIds ?? [];

              return (
                <Box
                  key={note.id}
                  sx={{
                    p: 1.5,
                    borderRadius: "12px",
                    border: `1px solid ${alpha(theme.palette.grey[500], 0.14)}`,
                    bgcolor: alpha(theme.palette.background.paper, 0.65),
                    transition: "border-color 160ms ease, box-shadow 160ms ease",
                    "&:focus-within": {
                      borderColor: alpha(theme.palette.primary.main, 0.35),
                      boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.08)}`,
                    },
                  }}
                >
                  <Stack
                    direction="row"
                    sx={{
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                      mb: 0.75,
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
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
                            p: 0.25,
                            color: "text.disabled",
                            "&:hover": { color: "error.main" },
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 16 }} />
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
                    placeholder="Write context, hypotheses, or follow-ups…"
                    slotProps={{
                      input: {
                        disableUnderline: true,
                        readOnly: Boolean(note.editorLocked),
                      },
                    }}
                    sx={{
                      "& .MuiInputBase-input": {
                        fontSize: "0.875rem",
                        lineHeight: 1.6,
                        py: 0.5,
                        ...(note.editorLocked ? { cursor: "default" } : {}),
                      },
                    }}
                  />
                  {!note.editorLocked && onNoteCommit ? (
                    <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.75, fontWeight: 500 }}>
                      Enter — save and lock · Shift+Enter — new line
                    </Typography>
                  ) : note.editorLocked ? (
                    <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.75, fontWeight: 500 }}>
                      Saved and locked. Delete this note to edit again.
                    </Typography>
                  ) : null}

                  {uniqueTagOptions.length > 0 && (onNoteTagAdd || onNoteTagRemove) ? (
                    <Stack sx={{ mt: 1.25, gap: 0.5 }}>
                      <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 600 }}>
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
                                height: 24,
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                cursor: note.editorLocked ? "default" : "pointer",
                                ...(isLinked
                                  ? {}
                                  : tagChipOutlinedRestSx(theme, opt.color)),
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
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: "center", py: 2, lineHeight: 1.55 }}
              >
                No notes yet. Add session notes for hypotheses and framing; only one new note can be open at a time until you save with Enter.
              </Typography>
            ) : null}
          </Stack>
        </Box>
      </Stack>
    </GlassPanel>
  );
}
