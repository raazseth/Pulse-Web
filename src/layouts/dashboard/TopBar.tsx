import { useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { useSessionStore } from "@/modules/context/hooks/useSessionStore";
import { useSessionList } from "@/modules/context/hooks/useSessionList";
import { LiveDot } from "@/shared/components/LiveDot";
import { useNavigate } from "react-router-dom";
import { useTranscriptHud } from "@/modules/transcript/context/TranscriptHudContext";
import { SettingsDrawer } from "./SettingsDrawer";

interface TopBarProps {
  sidebarWidth: number;
  topbarHeight: number;
  onMenuClick: () => void;
  desktopSidebarCollapsed?: boolean;
  onExpandDesktopSidebar?: () => void;
}

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
  const { hudSocketStatus, hudSocketError } = useTranscriptHud();

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
        updateSessionStatus(prevId, "paused").catch(() => { });
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
            {hudSocketStatus === "connected" ? (
              <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexShrink: 0 }}>
                <LiveDot />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Live
                </Typography>
              </Stack>
            ) : (
              <Chip
                size="small"
                variant="outlined"
                label={
                  hudSocketStatus === "error" && hudSocketError
                    ? `${hudSocketStatus} · ${hudSocketError.slice(0, 56)}`
                    : hudSocketStatus
                }
                color={hudSocketStatus === "error" ? "error" : "default"}
                sx={{
                  maxWidth: { xs: 140, sm: 280 },
                  height: 22,
                  "& .MuiChip-label": { px: 1, overflow: "hidden", textOverflow: "ellipsis" },
                }}
                title={hudSocketError ?? hudSocketStatus}
              />
            )}
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
