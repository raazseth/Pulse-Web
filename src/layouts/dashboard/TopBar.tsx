import { useState } from "react";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DataObjectRoundedIcon from "@mui/icons-material/DataObjectRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import GridOnRoundedIcon from "@mui/icons-material/GridOnRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import { useAuth } from "@/modules/auth/hooks/useAuthStore";
import { useSessionStore } from "@/modules/context/hooks/useSessionStore";
import { useSessionList } from "@/modules/context/hooks/useSessionList";
import { LiveDot } from "@/shared/components/LiveDot";
import { useNavigate } from "react-router-dom";
import { useTranscriptHud } from "@/modules/transcript/context/TranscriptHudContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface TopBarProps {
  sidebarWidth: number;
  topbarHeight: number;
  onMenuClick: () => void;
  desktopSidebarCollapsed?: boolean;
  onExpandDesktopSidebar?: () => void;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function truncate(str: string, max: number) {
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

// ─── Settings drawer ──────────────────────────────────────────────────────────

function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const session = useSessionStore();
  const { getSession, updateSessionStatus } = useSessionList();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [joinId, setJoinId] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  const handleLogout = async () => {
    onClose();
    setConfirmingLogout(false);
    await logout();
    navigate("/login");
  };

  const handleDownloadJSON = () => {
    const payload = {
      sessionId: session.sessionId,
      status: session.sessionStatus,
      exportedAt: new Date().toISOString(),
      metadata: session.metadata,
      notes: session.notes,
      tags: session.tags,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${session.sessionId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["id", "label", "body", "linkedTags"].join(",");
    const rows = session.notes.map((n) =>
      [n.id, esc(n.label ?? ""), esc(n.body), esc((n.linkedTagIds ?? []).join(";"))].join(","),
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${session.sessionId.slice(0, 8)}-notes.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleJoin = async () => {
    const id = joinId.trim();
    if (!id) return;
    setJoining(true);
    setJoinError("");
    try {
      const found = await getSession(id);
      if (!found) { setJoinError("No session found with that ID."); return; }
      const prevId = session.sessionId;
      if (prevId && session.sessionStatus === "active") {
        updateSessionStatus(prevId, "paused").catch(() => {});
      }
      session.setSessionId(found.id);
      session.setSessionStatus("active");
      session.updateMetadata({ title: found.title });
      updateSessionStatus(found.id, "active").catch(() => {});
      setJoinId("");
      onClose();
      navigate("/");
    } catch {
      setJoinError("Failed to connect. Try again.");
    } finally {
      setJoining(false);
    }
  };

  const handleCopySessionId = () => {
    if (!session.sessionId) return;
    navigator.clipboard.writeText(session.sessionId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const metaRows = [
    session.metadata.title       && { label: "Title",       value: session.metadata.title },
    session.metadata.facilitator && { label: "Facilitator", value: session.metadata.facilitator },
    session.metadata.audience    && { label: "Audience",    value: session.metadata.audience },
    session.metadata.role        && { label: "Role",        value: session.metadata.role },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => { onClose(); setConfirmingLogout(false); }}
      sx={{ zIndex: (theme) => theme.zIndex.drawer + 2 }}
      slotProps={{
        paper: {
          sx: {
            width: 320,
            bgcolor: "background.paper",
            borderLeft: "1px solid",
            borderColor: "divider",
            boxShadow: "-8px 0 24px rgba(0,0,0,0.08)",
          },
        },
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>

        {/* Header */}
        <Box
          sx={{
            px: 2.5, py: 1.75,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: "1px solid", borderColor: "divider", flexShrink: 0,
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: "1rem", color: "text.primary" }}>
            Settings
          </Typography>
          <IconButton
            size="small"
            onClick={() => { onClose(); setConfirmingLogout(false); }}
            sx={{ color: "text.disabled", "&:hover": { color: "text.primary" } }}
          >
            <CloseRoundedIcon sx={{ fontSize: "1.1rem" }} />
          </IconButton>
        </Box>

        {/* Scrollable body */}
        <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2.5 }}>
          <Stack spacing={3}>

            {/* Account */}
            <Box>
              <Typography sx={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "text.disabled", mb: 1.5 }}>
                Account
              </Typography>
              <Box sx={{ borderRadius: "12px", border: "1px solid", borderColor: "divider", p: 2, display: "flex", alignItems: "center", gap: 1.5, bgcolor: "grey.100" }}>
                <Avatar sx={{ width: 44, height: 44, bgcolor: "#149F77", fontSize: "0.875rem", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {user ? initials(user.name) : "?"}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700, color: "text.primary", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {user?.name ?? "—"}
                  </Typography>
                  <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {user?.email ?? ""}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Divider />

            {/* Active session */}
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Typography sx={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "text.disabled" }}>
                  Active Session
                </Typography>
                <LiveDot />
              </Box>

              <Box sx={{ borderRadius: "12px", border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
                {/* Session ID block */}
                <Box sx={{ px: 2, py: 1.5, bgcolor: "grey.100", borderBottom: metaRows.length > 0 ? "1px solid" : "none", borderColor: "divider" }}>
                  <Typography sx={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "text.disabled", mb: 0.75 }}>
                    Session ID
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography sx={{ fontSize: "0.8125rem", fontFamily: "monospace", color: "text.primary", fontWeight: 500, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.5 }}>
                      {session.sessionId || "—"}
                    </Typography>
                    {session.sessionId && (
                      <Tooltip title={copied ? "Copied!" : "Copy"} placement="left">
                        <IconButton
                          size="small"
                          onClick={handleCopySessionId}
                          sx={{ color: copied ? "#149F77" : "text.disabled", flexShrink: 0, "&:hover": { color: "text.primary" } }}
                        >
                          {copied
                            ? <CheckRoundedIcon sx={{ fontSize: "1rem" }} />
                            : <ContentCopyRoundedIcon sx={{ fontSize: "1rem" }} />
                          }
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>

                {/* Metadata rows */}
                {metaRows.length > 0 && (() => {
                  const titleRow  = metaRows.find(r => r.label === "Title");
                  const otherRows = metaRows.filter(r => r.label !== "Title");
                  const cellLabel = (text: string) => (
                    <Typography sx={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "text.disabled", mb: 0.3 }}>
                      {text}
                    </Typography>
                  );
                  const cellValue = (text: string, max = 22) => (
                    <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {truncate(text, max)}
                    </Typography>
                  );
                  return (
                    <>
                      {titleRow && (
                        <Box sx={{ px: 1.75, py: 1.25, borderBottom: otherRows.length > 0 ? "1px solid" : "none", borderColor: "divider" }}>
                          {cellLabel(titleRow.label)}
                          {cellValue(titleRow.value, 34)}
                        </Box>
                      )}
                      {otherRows.length > 0 && (
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", "& > *:nth-of-type(odd)": { borderRight: "1px solid", borderColor: "divider" }, "& > *:not(:nth-last-of-type(-n+2))": { borderBottom: "1px solid", borderColor: "divider" } }}>
                          {otherRows.map((row) => (
                            <Box key={row.label} sx={{ px: 1.75, py: 1.25 }}>
                              {cellLabel(row.label)}
                              {cellValue(row.value)}
                            </Box>
                          ))}
                        </Box>
                      )}
                    </>
                  );
                })()}
              </Box>
            </Box>

            <Divider />

            {/* Export */}
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.5 }}>
                <DownloadRoundedIcon sx={{ fontSize: "0.875rem", color: "text.disabled" }} />
                <Typography sx={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "text.disabled" }}>
                  Export Session
                </Typography>
              </Box>
              <Box sx={{ borderRadius: "10px", border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
                <Box
                  onClick={handleDownloadJSON}
                  sx={{
                    display: "flex", alignItems: "center", gap: 1.5,
                    px: 1.75, py: 1.375,
                    cursor: "pointer", userSelect: "none",
                    borderBottom: "1px solid", borderColor: "divider",
                    transition: "background 140ms ease",
                    "&:hover": { bgcolor: "rgba(245,158,11,0.05)" },
                    "&:active": { bgcolor: "rgba(245,158,11,0.10)" },
                  }}
                >
                  <Box sx={{ width: 36, height: 36, borderRadius: "9px", bgcolor: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <DataObjectRoundedIcon sx={{ fontSize: "1.1rem", color: "#F59E0B", display: "block" }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: "text.primary", lineHeight: 1.25 }}>JSON</Typography>
                    <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", lineHeight: 1.4 }}>Metadata, notes &amp; tags</Typography>
                  </Box>
                  <DownloadRoundedIcon sx={{ fontSize: "1rem", color: "text.disabled", flexShrink: 0 }} />
                </Box>
                <Box
                  onClick={handleDownloadCSV}
                  sx={{
                    display: "flex", alignItems: "center", gap: 1.5,
                    px: 1.75, py: 1.375,
                    cursor: "pointer", userSelect: "none",
                    transition: "background 140ms ease",
                    "&:hover": { bgcolor: "rgba(139,92,246,0.05)" },
                    "&:active": { bgcolor: "rgba(139,92,246,0.10)" },
                  }}
                >
                  <Box sx={{ width: 36, height: 36, borderRadius: "9px", bgcolor: "rgba(139,92,246,0.10)", border: "1px solid rgba(139,92,246,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <GridOnRoundedIcon sx={{ fontSize: "1.1rem", color: "#8B5CF6", display: "block" }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: "text.primary", lineHeight: 1.25 }}>CSV</Typography>
                    <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", lineHeight: 1.4 }}>Notes spreadsheet export</Typography>
                  </Box>
                  <DownloadRoundedIcon sx={{ fontSize: "1rem", color: "text.disabled", flexShrink: 0 }} />
                </Box>
              </Box>
            </Box>

            <Divider />

            {/* Join Session */}
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.5 }}>
                <LoginRoundedIcon sx={{ fontSize: "0.875rem", color: "text.disabled" }} />
                <Typography sx={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "text.disabled" }}>
                  Join Session
                </Typography>
              </Box>
              <Stack spacing={1.25}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Paste session ID…"
                  value={joinId}
                  onChange={(e) => { setJoinId(e.target.value); if (joinError) setJoinError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
                  error={!!joinError}
                  helperText={joinError || undefined}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "8px",
                      fontSize: "0.8125rem",
                      "& fieldset": { borderColor: "divider" },
                      "&.Mui-focused fieldset": { borderColor: "#149F77", borderWidth: "1px" },
                    },
                    "& .MuiFormHelperText-root": { mx: 0, mt: 0.5, fontSize: "0.6875rem" },
                  }}
                />
                <Button
                  variant="contained"
                  fullWidth
                  disabled={!joinId.trim() || joining}
                  startIcon={joining ? <CircularProgress size={14} color="inherit" /> : <LoginRoundedIcon />}
                  onClick={handleJoin}
                  sx={{
                    height: 36, borderRadius: "8px",
                    fontSize: "0.875rem", fontWeight: 600,
                    textTransform: "none", boxShadow: "none",
                    bgcolor: "#149F77", "&:hover": { bgcolor: "#0E7A5C" },
                  }}
                >
                  {joining ? "Joining…" : "Join Session"}
                </Button>
              </Stack>
            </Box>

          </Stack>
        </Box>

        {/* Sign out — pinned to bottom */}
        <Box sx={{ flexShrink: 0, borderTop: "1px solid", borderColor: "divider", px: 2.5, py: 2 }}>
          {confirmingLogout ? (
            <Box>
              <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary", mb: 1.5, lineHeight: 1.5 }}>
                Are you sure you want to sign out?
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" size="small" fullWidth onClick={() => setConfirmingLogout(false)} sx={{ borderColor: "divider", color: "text.secondary", "&:hover": { borderColor: "text.secondary" } }}>
                  Cancel
                </Button>
                <Button variant="contained" size="small" fullWidth onClick={handleLogout} sx={{ bgcolor: "#ef4444", "&:hover": { bgcolor: "#dc2626" }, boxShadow: "none" }}>
                  Sign out
                </Button>
              </Stack>
            </Box>
          ) : (
            <Box
              onClick={() => setConfirmingLogout(true)}
              sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.75, py: 1.125, borderRadius: "10px", border: "1px solid", borderColor: "divider", cursor: "pointer", transition: "background 140ms ease", "&:hover": { bgcolor: "grey.100" } }}
            >
              <LogoutRoundedIcon sx={{ fontSize: "1.1rem", color: "text.secondary" }} />
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.primary" }}>
                Sign out
              </Typography>
            </Box>
          )}
        </Box>

      </Box>
    </Drawer>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

export function TopBar({
  sidebarWidth,
  topbarHeight,
  onMenuClick,
  desktopSidebarCollapsed,
  onExpandDesktopSidebar,
}: TopBarProps) {
  const session = useSessionStore();
  const { createSession, updateSessionStatus } = useSessionList();
  const navigate = useNavigate();
  const { hudSocketStatus } = useTranscriptHud();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!createTitle.trim()) return;
    setCreating(true);
    const prevId = session.sessionId;
    const prevStatus = session.sessionStatus;
    try {
      if (prevId && prevStatus === "active") {
        updateSessionStatus(prevId, "paused").catch(() => {});
      }
      const created = await createSession({
        title: createTitle.trim(),
        facilitator: session.metadata.facilitator,
        audience: session.metadata.audience,
        role: session.metadata.role,
      });
      if (created?.id) session.setSessionId(created.id);
      if (created?.title) session.updateMetadata({ title: created.title });
      session.setSessionStatus("active");
      setCreateOpen(false);
      setCreateTitle("");
      navigate("/");
    } catch {
      // server offline
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          // Stay below temporary Drawer (zIndex.drawer) so the mobile nav is not covered by the bar.
          zIndex: (theme) => theme.zIndex.appBar,
          width: { lg: `calc(100% - ${sidebarWidth}px)` },
          ml: { lg: `${sidebarWidth}px` },
          height: topbarHeight,
          transition: (theme) =>
            theme.transitions.create(["margin", "width"], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
        }}
      >
        <Toolbar sx={{ height: topbarHeight, minHeight: `${topbarHeight}px !important`, px: { xs: 2, lg: 3 } }}>
          <IconButton
            onClick={onMenuClick}
            edge="start"
            size="small"
            sx={{ mr: 1.5, display: { lg: "none" }, color: "text.secondary" }}
            aria-label="open navigation"
          >
            <MenuRoundedIcon />
          </IconButton>

          {desktopSidebarCollapsed && onExpandDesktopSidebar && (
            <Tooltip title="Show sidebar" placement="bottom">
              <IconButton
                onClick={onExpandDesktopSidebar}
                edge="start"
                size="small"
                aria-label="Show sidebar"
                sx={{
                  mr: 1.5,
                  display: { xs: "none", lg: "inline-flex" },
                  color: "text.secondary",
                  flexShrink: 0,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "grey.50",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  "&:hover": { bgcolor: "rgba(20,159,119,0.08)", color: "#149F77", borderColor: "rgba(20,159,119,0.25)" },
                }}
              >
                <ChevronRightRoundedIcon sx={{ fontSize: "1.25rem" }} />
              </IconButton>
            </Tooltip>
          )}

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: { xs: 0.75, lg: 1 },
              minWidth: 0,
              flex: 1,
              overflow: "hidden",
            }}
          >
            <Typography
              sx={{
                display: { xs: "none", lg: "inline" },
                fontSize: "0.75rem",
                color: "text.disabled",
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              Workspace
            </Typography>
            <Typography
              sx={{
                display: { xs: "none", lg: "inline" },
                fontSize: "0.75rem",
                color: "text.disabled",
                flexShrink: 0,
              }}
            >
              /
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: "0.8125rem", lg: "0.875rem" },
                fontWeight: 600,
                color: "text.primary",
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Session HUD
            </Typography>
            {hudSocketStatus === "connected" ? <LiveDot /> : null}
          </Box>

          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0 }}>
            <Tooltip title="New Session" placement="bottom">
              <IconButton
                size="small"
                onClick={() => setCreateOpen(true)}
                sx={{ color: "text.secondary", "&:hover": { color: "#149F77", bgcolor: "rgba(20,159,119,0.06)" } }}
              >
                <AddRoundedIcon sx={{ fontSize: "1.25rem" }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings" placement="bottom">
              <IconButton
                size="small"
                onClick={() => setSettingsOpen(true)}
                sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}
              >
                <SettingsRoundedIcon sx={{ fontSize: "1.2rem" }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* ── New Session Dialog ── */}
      <Dialog
        open={createOpen}
        onClose={() => { setCreateOpen(false); setCreateTitle(""); }}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: "14px" } } }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 700, color: "text.primary" }}>New Session</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              fullWidth
              size="small"
              label="Session title"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
            <Typography variant="caption" color="text.secondary">
              Facilitator, audience, and role will be copied from the current session metadata.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setCreateOpen(false); setCreateTitle(""); }} sx={{ color: "text.secondary" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!createTitle.trim() || creating}
            startIcon={creating ? <CircularProgress size={14} color="inherit" /> : undefined}
            onClick={handleCreate}
            sx={{ borderRadius: "8px", bgcolor: "#149F77", "&:hover": { bgcolor: "#0E7A5C" } }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
