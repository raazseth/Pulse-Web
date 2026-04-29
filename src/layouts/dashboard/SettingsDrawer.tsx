import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloudDownloadRoundedIcon from "@mui/icons-material/CloudDownloadRounded";
import DesktopWindowsRoundedIcon from "@mui/icons-material/DesktopWindowsRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/hooks/useAuthStore";
import { useSessionStore } from "@/modules/context/hooks/useSessionStore";
import { useSessionList } from "@/modules/context/hooks/useSessionList";
import { LiveDot } from "@/shared/components/LiveDot";
import { useToast } from "@/shared/components/Toast";
import { getHudExportUrl } from "@/shared/utils/hudApi";
import { fetchWithAuth } from "@/shared/utils/fetchWithAuth";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function truncate(str: string, max: number) {
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const { user, logout, accessToken, refreshAccessToken } = useAuth();
  const { toast } = useToast();
  const session = useSessionStore();
  const { getSession, updateSessionStatus } = useSessionList();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [joinId, setJoinId] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [displaySources, setDisplaySources] = useState<Array<{ id: string; name: string }>>([]);
  const [displaySourceId, setDisplaySourceId] = useState("");
  const [displaySourcesLoading, setDisplaySourcesLoading] = useState(false);
  const [displaySourcesError, setDisplaySourcesError] = useState("");
  const [serverExporting, setServerExporting] = useState<null | "json" | "csv">(null);

  const downloadServerExport = useCallback(
    async (format: "json" | "csv") => {
      const id = session.sessionId;
      if (!id) {
        toast({ message: "Select a session to export.", severity: "warning" });
        return;
      }
      if (!accessToken) {
        toast({ message: "Sign in to download server exports.", severity: "warning" });
        return;
      }
      setServerExporting(format);
      try {
        const res = await fetchWithAuth(
          getHudExportUrl(id, format),
          { method: "GET" },
          () => accessToken,
          refreshAccessToken,
        );
        if (!res.ok) throw new Error((await res.text()).slice(0, 240));
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `hud-session-${id.slice(0, 8)}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        toast({
          message: e instanceof Error ? e.message : "Server export failed",
          severity: "error",
        });
      } finally {
        setServerExporting(null);
      }
    },
    [session.sessionId, accessToken, refreshAccessToken, toast],
  );

  useEffect(() => {
    if (!open) return;
    const api = typeof window !== "undefined" ? window.api : undefined;
    if (!api?.listDisplaySources) return;
    setDisplaySourcesLoading(true);
    setDisplaySourcesError("");
    api
      .listDisplaySources()
      .then((rows) => {
        setDisplaySources(rows);
        setDisplaySourceId((prev) => prev || rows[0]?.id || "");
      })
      .catch(() => setDisplaySourcesError("Could not list capture sources."))
      .finally(() => setDisplaySourcesLoading(false));
  }, [open]);

  const handleLogout = async () => {
    onClose();
    setConfirmingLogout(false);
    await logout();
    navigate("/login");
  };

  const handleJoin = async () => {
    const id = joinId.trim();
    if (!id) return;
    setJoining(true);
    setJoinError("");
    try {
      const found = await getSession(id);
      if (!found) {
        setJoinError("No session found with that ID.");
        return;
      }
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
    session.metadata.title && { label: "Title", value: session.metadata.title },
    session.metadata.facilitator && {
      label: "Facilitator",
      value: session.metadata.facilitator,
    },
    session.metadata.audience && {
      label: "Audience",
      value: session.metadata.audience,
    },
    session.metadata.role && { label: "Role", value: session.metadata.role },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => {
        onClose();
        setConfirmingLogout(false);
      }}
      sx={{ zIndex: (theme) => theme.zIndex.modal + 50 }}
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
        <Box
          sx={{
            px: 2.5,
            py: 1.75,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid",
            borderColor: "divider",
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{ fontWeight: 700, fontSize: "1rem", color: "text.primary" }}
          >
            Settings
          </Typography>
          <IconButton
            size="small"
            onClick={() => {
              onClose();
              setConfirmingLogout(false);
            }}
            sx={{
              color: "text.disabled",
              "&:hover": { color: "text.primary" },
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: "1.1rem" }} />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2.5 }}>
          <Stack spacing={3}>
            <Box>
              <Typography
                sx={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "text.disabled",
                  mb: 1.5,
                }}
              >
                Account
              </Typography>
              <Box
                sx={{
                  borderRadius: "12px",
                  border: "1px solid",
                  borderColor: "divider",
                  p: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  bgcolor: "grey.100",
                }}
              >
                <Avatar
                  sx={{
                    width: 44,
                    height: 44,
                    bgcolor: "#149F77",
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {user ? initials(user.name) : "?"}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: "0.9375rem",
                      fontWeight: 700,
                      color: "text.primary",
                      lineHeight: 1.25,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {user?.name ?? "—"}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.75rem",
                      color: "text.secondary",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {user?.email ?? ""}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Divider />

            <Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 1.5,
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "text.disabled",
                  }}
                >
                  Active Session
                </Typography>
                <LiveDot />
              </Box>

              <Box
                sx={{
                  borderRadius: "12px",
                  border: "1px solid",
                  borderColor: "divider",
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    px: 2,
                    py: 1.5,
                    bgcolor: "grey.100",
                    borderBottom: metaRows.length > 0 ? "1px solid" : "none",
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "0.5625rem",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "text.disabled",
                      mb: 0.75,
                    }}
                  >
                    Session ID
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography
                      sx={{
                        fontSize: "0.8125rem",
                        fontFamily: "monospace",
                        color: "text.primary",
                        fontWeight: 500,
                        flex: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        lineHeight: 1.5,
                      }}
                    >
                      {session.sessionId || "—"}
                    </Typography>
                    {session.sessionId && (
                      <Tooltip
                        title={copied ? "Copied!" : "Copy"}
                        placement="left"
                      >
                        <IconButton
                          size="small"
                          onClick={handleCopySessionId}
                          sx={{
                            color: copied ? "#149F77" : "text.disabled",
                            flexShrink: 0,
                            "&:hover": { color: "text.primary" },
                          }}
                        >
                          {copied ? (
                            <CheckRoundedIcon sx={{ fontSize: "1rem" }} />
                          ) : (
                            <ContentCopyRoundedIcon sx={{ fontSize: "1rem" }} />
                          )}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>

                {metaRows.length > 0 &&
                  (() => {
                    const titleRow = metaRows.find((r) => r.label === "Title");
                    const otherRows = metaRows.filter(
                      (r) => r.label !== "Title",
                    );
                    const cellLabel = (text: string) => (
                      <Typography
                        sx={{
                          fontSize: "0.5625rem",
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "text.disabled",
                          mb: 0.3,
                        }}
                      >
                        {text}
                      </Typography>
                    );
                    const cellValue = (text: string, max = 22) => (
                      <Typography
                        sx={{
                          fontSize: "0.8125rem",
                          color: "text.secondary",
                          lineHeight: 1.4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {truncate(text, max)}
                      </Typography>
                    );
                    return (
                      <>
                        {titleRow && (
                          <Box
                            sx={{
                              px: 1.75,
                              py: 1.25,
                              borderBottom:
                                otherRows.length > 0 ? "1px solid" : "none",
                              borderColor: "divider",
                            }}
                          >
                            {cellLabel(titleRow.label)}
                            {cellValue(titleRow.value, 34)}
                          </Box>
                        )}
                        {otherRows.length > 0 && (
                          <Box
                            sx={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              "& > *:nth-of-type(odd)": {
                                borderRight: "1px solid",
                                borderColor: "divider",
                              },
                              "& > *:not(:nth-last-of-type(-n+2))": {
                                borderBottom: "1px solid",
                                borderColor: "divider",
                              },
                            }}
                          >
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

            <Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  mb: 1.5,
                }}
              >
                <CloudDownloadRoundedIcon
                  sx={{ fontSize: "0.875rem", color: "text.disabled" }}
                />
                <Typography
                  sx={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "text.disabled",
                  }}
                >
                  Export session
                </Typography>
              </Box>
              <Box
                sx={{
                  borderRadius: "10px",
                  border: "1px solid",
                  borderColor: "divider",
                  overflow: "hidden",
                }}
              >
                <Box
                  onClick={() => {
                    if (serverExporting) return;
                    void downloadServerExport("json");
                  }}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 1.75,
                    py: 1.375,
                    cursor: serverExporting ? "default" : "pointer",
                    userSelect: "none",
                    transition: "background 140ms ease",
                    opacity: serverExporting && serverExporting !== "json" ? 0.5 : 1,
                    "&:hover": { bgcolor: serverExporting ? undefined : "rgba(14,165,233,0.05)" },
                    "&:active": { bgcolor: serverExporting ? undefined : "rgba(14,165,233,0.10)" },
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: "9px",
                      bgcolor: "rgba(14,165,233,0.10)",
                      border: "1px solid rgba(14,165,233,0.22)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <CloudDownloadRoundedIcon
                      sx={{
                        fontSize: "1.1rem",
                        color: "#0EA5E9",
                        display: "block",
                      }}
                    />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: "0.875rem",
                        fontWeight: 700,
                        color: "text.primary",
                        lineHeight: 1.25,
                      }}
                    >
                      JSON
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.75rem",
                        color: "text.secondary",
                        lineHeight: 1.4,
                      }}
                    >
                      Full HUD session from the API: transcript, prompts, tags, events.
                    </Typography>
                  </Box>
                  {serverExporting === "json" ? (
                    <CircularProgress size={18} sx={{ flexShrink: 0 }} />
                  ) : (
                    <CloudDownloadRoundedIcon
                      sx={{
                        fontSize: "1rem",
                        color: "text.disabled",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </Box>
                <Box
                  onClick={() => {
                    if (serverExporting) return;
                    void downloadServerExport("csv");
                  }}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 1.75,
                    py: 1.375,
                    cursor: serverExporting ? "default" : "pointer",
                    userSelect: "none",
                    borderTop: "1px solid",
                    borderColor: "divider",
                    transition: "background 140ms ease",
                    opacity: serverExporting && serverExporting !== "csv" ? 0.5 : 1,
                    "&:hover": { bgcolor: serverExporting ? undefined : "rgba(20,184,166,0.05)" },
                    "&:active": { bgcolor: serverExporting ? undefined : "rgba(20,184,166,0.10)" },
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: "9px",
                      bgcolor: "rgba(20,184,166,0.10)",
                      border: "1px solid rgba(20,184,166,0.22)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <CloudDownloadRoundedIcon
                      sx={{
                        fontSize: "1.1rem",
                        color: "#14B8A6",
                        display: "block",
                      }}
                    />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: "0.875rem",
                        fontWeight: 700,
                        color: "text.primary",
                        lineHeight: 1.25,
                      }}
                    >
                      CSV
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.75rem",
                        color: "text.secondary",
                        lineHeight: 1.4,
                      }}
                    >
                      Same session as CSV for spreadsheets (transcript, prompts, tags).
                    </Typography>
                  </Box>
                  {serverExporting === "csv" ? (
                    <CircularProgress size={18} sx={{ flexShrink: 0 }} />
                  ) : (
                    <CloudDownloadRoundedIcon
                      sx={{
                        fontSize: "1rem",
                        color: "text.disabled",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </Box>
              </Box>
            </Box>

            <Divider />

            {typeof window !== "undefined" && window.api?.listDisplaySources ? (
              <Box>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    mb: 1.5,
                  }}
                >
                  <DesktopWindowsRoundedIcon
                    sx={{ fontSize: "0.875rem", color: "text.disabled" }}
                  />
                  <Typography
                    sx={{
                      fontSize: "0.625rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "text.disabled",
                    }}
                  >
                    System audio capture
                  </Typography>
                </Box>
                <Stack spacing={1.25}>
                  <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", lineHeight: 1.45 }}>
                    Choose which screen or window Electron prefers when you start system-audio capture. You still
                    confirm in the OS picker; this sets the default video source (with loopback audio).
                  </Typography>
                  <Typography sx={{ fontSize: "0.7rem", color: "text.disabled", lineHeight: 1.45 }}>
                    Windows 11: Settings → System → Sound → allow app access. macOS Sequoia: System Settings → Privacy
                    and Security → Screen Recording and Microphone for Pulse HUD.
                  </Typography>
                  {displaySourcesError ? (
                    <Alert severity="warning">{displaySourcesError}</Alert>
                  ) : null}
                  <FormControl fullWidth size="small" disabled={displaySourcesLoading}>
                    <InputLabel id="pulse-display-source-label">Preferred source</InputLabel>
                    <Select
                      labelId="pulse-display-source-label"
                      label="Preferred source"
                      value={displaySourceId}
                      onChange={(e) => setDisplaySourceId(String(e.target.value))}
                    >
                      {displaySources.map((s) => (
                        <MenuItem key={s.id} value={s.id}>
                          {s.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={!displaySourceId || displaySourcesLoading}
                    onClick={() => window.api?.setDisplayCaptureSource?.(displaySourceId || null)}
                  >
                    Save preference
                  </Button>
                </Stack>
              </Box>
            ) : null}

            {typeof window !== "undefined" && window.api?.listDisplaySources ? <Divider /> : null}

            <Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  mb: 1.5,
                }}
              >
                <LoginRoundedIcon
                  sx={{ fontSize: "0.875rem", color: "text.disabled" }}
                />
                <Typography
                  sx={{
                    fontSize: "0.625rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "text.disabled",
                  }}
                >
                  Join Session
                </Typography>
              </Box>
              <Stack spacing={1.25}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Paste session ID…"
                  value={joinId}
                  onChange={(e) => {
                    setJoinId(e.target.value);
                    if (joinError) setJoinError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleJoin();
                  }}
                  error={!!joinError}
                  helperText={joinError || undefined}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "8px",
                      fontSize: "0.8125rem",
                      "& fieldset": { borderColor: "divider" },
                      "&.Mui-focused fieldset": {
                        borderColor: "#149F77",
                        borderWidth: "1px",
                      },
                    },
                    "& .MuiFormHelperText-root": {
                      mx: 0,
                      mt: 0.5,
                      fontSize: "0.6875rem",
                    },
                  }}
                />
                <Button
                  variant="contained"
                  fullWidth
                  disabled={!joinId.trim() || joining}
                  startIcon={
                    joining ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <LoginRoundedIcon />
                    )
                  }
                  onClick={handleJoin}
                  sx={{
                    height: 36,
                    borderRadius: "8px",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    textTransform: "none",
                    boxShadow: "none",
                    bgcolor: "#149F77",
                    "&:hover": { bgcolor: "#0E7A5C" },
                  }}
                >
                  {joining ? "Joining…" : "Join Session"}
                </Button>
              </Stack>
            </Box>
          </Stack>
        </Box>

        <Box
          sx={{
            flexShrink: 0,
            borderTop: "1px solid",
            borderColor: "divider",
            px: 2.5,
            py: 2,
          }}
        >
          {confirmingLogout ? (
            <Box>
              <Typography
                sx={{
                  fontSize: "0.8125rem",
                  color: "text.secondary",
                  mb: 1.5,
                  lineHeight: 1.5,
                }}
              >
                Are you sure you want to sign out?
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  fullWidth
                  onClick={() => setConfirmingLogout(false)}
                  sx={{
                    borderColor: "divider",
                    color: "text.secondary",
                    "&:hover": { borderColor: "text.secondary" },
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  fullWidth
                  onClick={handleLogout}
                  sx={{
                    bgcolor: "#ef4444",
                    "&:hover": { bgcolor: "#dc2626" },
                    boxShadow: "none",
                  }}
                >
                  Sign out
                </Button>
              </Stack>
            </Box>
          ) : (
            <Box
              onClick={() => setConfirmingLogout(true)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 1.75,
                py: 1.125,
                borderRadius: "10px",
                border: "1px solid",
                borderColor: "divider",
                cursor: "pointer",
                transition: "background 140ms ease",
                "&:hover": { bgcolor: "grey.100" },
              }}
            >
              <LogoutRoundedIcon
                sx={{ fontSize: "1.1rem", color: "text.secondary" }}
              />
              <Typography
                sx={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "text.primary",
                }}
              >
                Sign out
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
