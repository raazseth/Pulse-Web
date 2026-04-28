import { useState, useCallback } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, keyframes } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import NotesRoundedIcon from "@mui/icons-material/NotesRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/hooks/useAuthStore";
import { useSessionStore } from "@/modules/context/hooks/useSessionStore";
import { useSessionList, SessionSummary } from "@/modules/context/hooks/useSessionList";
import { SessionStatus, SessionNote } from "@/modules/context/types";
import { fetchWithAuth } from "@/shared/utils/fetchWithAuth";
import { getHudNotesUrl } from "@/shared/utils/hudApi";

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function fullDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const confirmIn = keyframes`
  from { opacity: 0; transform: translateX(8px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const STATUS_STYLE: Record<SessionStatus, { color: string; bg: string; border: string; dot: string; label: string }> = {
  active: { color: "#0A7554", bg: "rgba(20,159,119,0.10)", border: "rgba(20,159,119,0.24)", dot: "#149F77", label: "Live" },
  paused: { color: "#B76E00", bg: "rgba(255,171,0,0.10)", border: "rgba(255,171,0,0.24)", dot: "#FFAB00", label: "Paused" },
  ended: { color: "#637381", bg: "rgba(145,158,171,0.10)", border: "rgba(145,158,171,0.24)", dot: "#919EAB", label: "Ended" },
};

function StatusBadge({ status }: { status: SessionStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center", gap: 0.75,
      px: 1.25, py: 0.4, borderRadius: "20px",
      bgcolor: s.bg, border: `1px solid ${s.border}`,
    }}>
      <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: s.dot, flexShrink: 0 }} />
      <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: s.color, lineHeight: 1 }}>
        {s.label}
      </Typography>
    </Box>
  );
}

function SessionTableRow({
  session,
  isActive,
  activating,
  confirming,
  deleting,
  onSetActive,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  session: SessionSummary;
  isActive: boolean;
  activating: boolean;
  confirming: boolean;
  deleting: boolean;
  onSetActive: (s: SessionSummary) => void;
  onDeleteClick: (id: string) => void;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
}) {
  return (
    <TableRow
      onClick={() => !confirming && onSetActive(session)}
      sx={{
        cursor: confirming ? "default" : "pointer",
        transition: "background-color 200ms ease",
        bgcolor: confirming
          ? "rgba(239,68,68,0.04)"
          : isActive
            ? "rgba(20,159,119,0.06)"
            : "transparent",
        "&:hover": {
          bgcolor: confirming
            ? "rgba(239,68,68,0.06)"
            : isActive
              ? "rgba(20,159,119,0.10)"
              : alpha("#919EAB", 0.06),
        },
      }}
    >
      <TableCell sx={{ width: 110, pl: 3 }}>
        <StatusBadge status={session.status} />
      </TableCell>

      <TableCell>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          {isActive && (
            <Tooltip title="Currently active">
              <CheckCircleRoundedIcon sx={{ fontSize: "1rem", color: "#149F77", flexShrink: 0 }} />
            </Tooltip>
          )}
          <Typography sx={{
            fontSize: "0.9375rem",
            fontWeight: isActive ? 700 : 500,
            color: isActive ? "#149F77" : "#212B36",
          }}>
            {session.title || "Untitled session"}
          </Typography>
        </Stack>
      </TableCell>

      <TableCell sx={{ width: 220 }}>
        <Typography sx={{
          fontSize: "0.75rem",
          fontFamily: "monospace",
          color: "#637381",
          bgcolor: "#F4F6F8",
          px: 1, py: 0.4,
          borderRadius: "6px",
          display: "inline-block",
          letterSpacing: "0.01em",
          border: "1px solid #DFE3E8",
        }}>
          {session.id.slice(0, 20)}…
        </Typography>
      </TableCell>

      <TableCell sx={{ width: 150 }}>
        <Tooltip title={fullDate(session.createdAt)}>
          <Typography sx={{ fontSize: "0.8125rem", color: "#637381" }}>
            {relativeDate(session.createdAt)}
          </Typography>
        </Tooltip>
      </TableCell>

      <TableCell sx={{ width: 80 }}>
        {session.noteCount > 0 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <NotesRoundedIcon sx={{ fontSize: "0.875rem", color: "#919EAB" }} />
            <Typography sx={{ fontSize: "0.8125rem", color: "#637381", fontWeight: 500 }}>
              {session.noteCount}
            </Typography>
          </Box>
        )}
      </TableCell>

      <TableCell sx={{ width: 140, pr: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          {!confirming && (
            isActive ? (
              <Chip
                label="Active"
                size="small"
                sx={{
                  height: 26, fontSize: "0.75rem", fontWeight: 700,
                  bgcolor: "rgba(20,159,119,0.12)", color: "#0A7554",
                  border: "1px solid rgba(20,159,119,0.28)",
                }}
              />
            ) : (
              <Button
                size="small"
                variant="outlined"
                disabled={activating}
                startIcon={
                  activating
                    ? <Skeleton variant="circular" width={12} height={12} />
                    : <PlayArrowRoundedIcon sx={{ fontSize: "1rem" }} />
                }
                onClick={(e) => { e.stopPropagation(); onSetActive(session); }}
                sx={{
                  fontSize: "0.75rem", fontWeight: 600, height: 28, px: 1.25,
                  whiteSpace: "nowrap", minWidth: 0,
                  borderColor: alpha("#919EAB", 0.32), color: "#637381",
                  "&:hover": {
                    borderColor: "#149F77", color: "#149F77",
                    bgcolor: "rgba(20,159,119,0.06)",
                  },
                }}
              >
                Set Active
              </Button>
            )
          )}
        </Box>
      </TableCell>

      <TableCell sx={{ width: 56, pr: 2, pl: 0 }}>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          {confirming ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, animation: `${confirmIn} 180ms cubic-bezier(0.22,1,0.36,1) both` }}>
              <Button
                size="small"
                onClick={(e) => { e.stopPropagation(); onDeleteCancel(); }}
                sx={{ fontSize: "0.72rem", fontWeight: 600, height: 26, px: 1, color: "#637381", minWidth: 0, whiteSpace: "nowrap" }}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={deleting}
                startIcon={deleting ? <Skeleton variant="circular" width={11} height={11} /> : undefined}
                onClick={(e) => { e.stopPropagation(); onDeleteConfirm(session.id); }}
                sx={{ fontSize: "0.72rem", fontWeight: 700, height: 26, px: 1, whiteSpace: "nowrap", minWidth: 0, bgcolor: "#EF4444", "&:hover": { bgcolor: "#DC2626" } }}
              >
                Delete
              </Button>
            </Box>
          ) : (
            <Tooltip title="Delete session" placement="top">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onDeleteClick(session.id); }}
                sx={{ color: alpha("#919EAB", 0.4), "&:hover": { color: "#EF4444", bgcolor: "rgba(239,68,68,0.06)" } }}
              >
                <DeleteOutlineRoundedIcon sx={{ fontSize: "1.1rem" }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
}

type FilterTab = "all" | SessionStatus;

export function SessionsPage() {
  const navigate = useNavigate();
  const { accessToken, refreshAccessToken } = useAuth();
  const session = useSessionStore();
  const { sessions, loading, createSession, refetch, deleteSession, updateSessionStatus: updateStatus } = useSessionList();

  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const counts = {
    all: sessions.length,
    active: sessions.filter((s) => s.status === "active").length,
    paused: sessions.filter((s) => s.status === "paused").length,
    ended: sessions.filter((s) => s.status === "ended").length,
  };

  const visible = sessions.filter((s) => {
    if (filter !== "all" && s.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    }
    return true;
  });

  const handleSetActive = useCallback(async (s: SessionSummary) => {
    if (s.id === session.sessionId) { navigate("/"); return; }
    const prevId = session.sessionId;
    const prevStatus = session.sessionStatus;
    if (prevId && prevStatus === "active") {
      updateStatus(prevId, "paused").catch(() => { });
    }
    setActivatingId(s.id);
    session.setSessionId(s.id);
    session.setSessionStatus("active");
    session.updateMetadata({ title: s.title });
    updateStatus(s.id, "active").catch(() => { });
    try {
      const res = await fetchWithAuth(getHudNotesUrl(s.id), {}, () => accessToken, refreshAccessToken);
      if (res.ok) {
        const json = await res.json() as { data?: SessionNote[] };
        if (Array.isArray(json.data)) session.updateNotes(json.data);
      }
    } catch {
    } finally {
      setActivatingId(null);
      navigate("/");
    }
  }, [session, accessToken, refreshAccessToken, navigate, updateStatus]);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const created = await createSession({
        title: newTitle.trim(),
        facilitator: session.metadata.facilitator,
        audience: session.metadata.audience,
        role: session.metadata.role,
      });
      session.setSessionId(created.id);
      session.updateMetadata({ title: created.title });
      session.setSessionStatus("active");
      setDialogOpen(false);
      setNewTitle("");
      navigate("/");
    } catch {
    } finally {
      setCreating(false);
    }
  }, [newTitle, createSession, session, navigate]);

  const handleDeleteConfirm = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      await deleteSession(id);
      if (id === session.sessionId) {
        session.setSessionId("");
        session.setSessionStatus("ended");
      }
      setConfirmingDeleteId(null);
      await refetch();
    } catch {
    } finally {
      setDeletingId(null);
    }
  }, [deleteSession, refetch, session]);

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 }, maxWidth: 1100, mx: "auto" }}>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: { sm: "flex-end" }, mb: 3 }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#212B36", letterSpacing: "-0.02em", mb: 0.5 }}>
            Sessions
          </Typography>
          <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
            <Typography variant="body2" sx={{ color: "#637381", fontWeight: 500 }}>
              {counts.all} total
            </Typography>
            <Typography variant="body2" sx={{ color: "#0A7554", fontWeight: 600 }}>
              {counts.active} live
            </Typography>
            <Typography variant="body2" sx={{ color: "#B76E00", fontWeight: 600 }}>
              {counts.paused} paused
            </Typography>
            <Typography variant="body2" sx={{ color: "#919EAB", fontWeight: 500 }}>
              {counts.ended} ended
            </Typography>
          </Stack>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshRoundedIcon sx={{ fontSize: "1rem" }} />}
            onClick={() => refetch().catch(() => { })}
            disabled={loading}
            sx={{
              height: 36, borderRadius: "8px",
              borderColor: alpha("#919EAB", 0.32), color: "#637381",
              "&:hover": { borderColor: alpha("#919EAB", 0.56), bgcolor: alpha("#919EAB", 0.04) },
            }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{
              height: 36, px: 2.5, borderRadius: "8px",
              bgcolor: "#149F77", "&:hover": { bgcolor: "#0E7A5C" },
            }}
          >
            New Session
          </Button>
        </Stack>
      </Stack>

      <Box sx={{
        borderRadius: "14px",
        border: `1px solid ${alpha("#919EAB", 0.16)}`,
        bgcolor: "#FFFFFF",
        overflow: "hidden",
        boxShadow: `0 0 2px 0 ${alpha("#919EAB", 0.14)}, 0 8px 20px -4px ${alpha("#919EAB", 0.08)}`,
      }}>

        <Box sx={{
          px: 2.5, pt: 1.5, pb: 1,
          display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap",
          bgcolor: "#FFFFFF",
        }}>
          <Tabs
            value={filter}
            onChange={(_, v) => setFilter(v)}
            sx={{
              minHeight: 40,
              "& .MuiTab-root": {
                minHeight: 40, py: 0, px: 1.5,
                fontSize: "0.8125rem", fontWeight: 500,
                color: "#919EAB", textTransform: "none",
              },
              "& .Mui-selected": { color: "#212B36 !important", fontWeight: 700 },
              "& .MuiTabs-indicator": { bgcolor: "#149F77", height: 2, borderRadius: 2 },
            }}
          >
            <Tab value="all" label={`All (${counts.all})`} />
            <Tab value="active" label={`Live (${counts.active})`} />
            <Tab value="paused" label={`Paused (${counts.paused})`} />
            <Tab value="ended" label={`Ended (${counts.ended})`} />
          </Tabs>

          <Box sx={{ flex: 1 }} />

          <TextField
            size="small"
            placeholder="Search sessions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ fontSize: "1rem", color: "#919EAB" }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              width: 220,
              "& .MuiOutlinedInput-root": {
                borderRadius: "8px", fontSize: "0.8125rem", height: 36,
                "& fieldset": { borderColor: alpha("#919EAB", 0.32) },
                "&:hover fieldset": { borderColor: alpha("#919EAB", 0.56) },
                "&.Mui-focused fieldset": { borderColor: "#149F77" },
              },
            }}
          />
        </Box>

        <Divider />

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ pl: 3, width: 110 }}>Status</TableCell>
                <TableCell>Title</TableCell>
                <TableCell sx={{ width: 220 }}>Session ID</TableCell>
                <TableCell sx={{ width: 150 }}>Created</TableCell>
                <TableCell sx={{ width: 80 }}>Notes</TableCell>
                <TableCell sx={{ width: 140, pr: 1 }} />
                <TableCell sx={{ width: 56, pr: 2, pl: 0 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <>{[0, 1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ pl: 3, width: 110 }}>
                      <Skeleton variant="rounded" width={64} height={22} />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" width={`${40 + i * 10}%`} height={20} />
                    </TableCell>
                    <TableCell sx={{ width: 220 }}>
                      <Skeleton variant="rounded" width={160} height={20} />
                    </TableCell>
                    <TableCell sx={{ width: 150 }}>
                      <Skeleton variant="text" width={60} height={20} />
                    </TableCell>
                    <TableCell sx={{ width: 80 }} />
                    <TableCell sx={{ width: 140, pr: 1 }}>
                      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                        <Skeleton variant="rounded" width={84} height={28} />
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: 56, pr: 2, pl: 0 }}>
                      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                        <Skeleton variant="circular" width={28} height={28} />
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}</>
              )}

              {!loading && visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ border: 0 }}>
                    <Box sx={{ textAlign: "center", py: 8 }}>
                      <Typography sx={{ fontSize: "2.5rem", mb: 1.5, lineHeight: 1 }}>🗂️</Typography>
                      <Typography variant="subtitle1" sx={{ color: "#212B36", mb: 0.5 }}>
                        {search ? "No sessions match your search" : "No sessions yet"}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#637381" }}>
                        {search
                          ? "Try a different keyword or clear the filter."
                          : "Create your first session to get started."}
                      </Typography>
                      {!search && (
                        <Button
                          variant="contained"
                          startIcon={<AddRoundedIcon />}
                          onClick={() => setDialogOpen(true)}
                          sx={{ mt: 2.5, borderRadius: "8px", bgcolor: "#149F77", "&:hover": { bgcolor: "#0E7A5C" } }}
                        >
                          New Session
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              )}

              {!loading && visible.map((s) => (
                <SessionTableRow
                  key={s.id}
                  session={s}
                  isActive={s.id === session.sessionId}
                  activating={activatingId === s.id}
                  confirming={confirmingDeleteId === s.id}
                  deleting={deletingId === s.id}
                  onSetActive={handleSetActive}
                  onDeleteClick={(id) => setConfirmingDeleteId(id)}
                  onDeleteConfirm={handleDeleteConfirm}
                  onDeleteCancel={() => setConfirmingDeleteId(null)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {!loading && visible.length > 0 && (
          <Box sx={{
            px: 3, py: 1.5,
            borderTop: `1px solid ${alpha("#919EAB", 0.12)}`,
            bgcolor: "#FAFAFA",
          }}>
            <Typography variant="caption" sx={{ color: "#919EAB" }}>
              Showing {visible.length} of {sessions.length} session{sessions.length !== 1 ? "s" : ""}
            </Typography>
          </Box>
        )}
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: "14px" } } }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 700, color: "#212B36" }}>New Session</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              fullWidth
              size="small"
              label="Session title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
            <Typography variant="caption" color="text.secondary">
              Facilitator, audience, and role will be copied from the current metadata.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: "8px", color: "#637381" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!newTitle.trim() || creating}
            startIcon={creating ? <Skeleton variant="circular" width={14} height={14} /> : undefined}
            onClick={handleCreate}
            sx={{ borderRadius: "8px", bgcolor: "#149F77", "&:hover": { bgcolor: "#0E7A5C" } }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
