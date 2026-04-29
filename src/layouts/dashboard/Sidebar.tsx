import { useCallback, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import NotesRoundedIcon from "@mui/icons-material/NotesRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import { keyframes } from "@mui/system";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/modules/auth/hooks/useAuthStore";
import { useSessionStore } from "@/modules/context/hooks/useSessionStore";
import {
  useSessionList,
  SessionSummary,
} from "@/modules/context/hooks/useSessionList";
import { SessionNote, SessionStatus } from "@/modules/context/types";
import { fetchWithAuth } from "@/shared/utils/fetchWithAuth";
import { getHudNotesUrl } from "@/shared/utils/hudApi";

const livePulse = keyframes`
  0%   { box-shadow: 0 0 0 0   rgba(34,197,94,0.55); }
  70%  { box-shadow: 0 0 0 6px rgba(34,197,94,0);    }
  100% { box-shadow: 0 0 0 0   rgba(34,197,94,0);    }
`;

const BRAND = "#149F77";
const BORDER = "rgba(255,255,255,0.09)";
const T1 = "rgba(255,255,255,0.92)";
const T2 = "rgba(255,255,255,0.58)";
const T3 = "rgba(255,255,255,0.35)";
const CARD_BG = "rgba(0,0,0,0.18)";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function truncate(str: string | undefined, max: number) {
  if (!str) return "";
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const STATUS_CFG: Record<
  SessionStatus,
  { color: string; label: string; pulse: boolean }
> = {
  active: { color: "#22c55e", label: "Live", pulse: true },
  paused: { color: "#f59e0b", label: "Paused", pulse: false },
  ended: { color: "#6b7280", label: "Ended", pulse: false },
};

function StatusDot({ status }: { status: SessionStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <Box
      sx={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        bgcolor: cfg.color,
        flexShrink: 0,
        ...(cfg.pulse && {
          animation: `${livePulse} 1.8s ease-in-out infinite`,
        }),
      }}
    />
  );
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      <StatusDot status={status} />
      <Typography
        sx={{ fontSize: "0.6875rem", fontWeight: 600, color: cfg.color }}
      >
        {cfg.label}
      </Typography>
    </Box>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: "0.6875rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: T3,
        px: 1.5,
        mb: 0.5,
      }}
    >
      {children}
    </Typography>
  );
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        borderRadius: "10px",
        border: `1px solid ${BORDER}`,
        bgcolor: CARD_BG,
        overflow: "hidden",
      }}
    >
      {children}
    </Box>
  );
}

function InfoCardHeader({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        px: 1.5,
        py: 0.875,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${BORDER}`,
        bgcolor: "rgba(0,0,0,0.12)",
      }}
    >
      {children}
    </Box>
  );
}

function InfoCardBody({ children }: { children: React.ReactNode }) {
  return (
    <Stack spacing={1.25} sx={{ px: 1.5, py: 1.25 }}>
      {children}
    </Stack>
  );
}

function MetaRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
      <Box sx={{ color: T3, display: "flex", mt: "1px", flexShrink: 0 }}>
        {icon}
      </Box>
      <Typography sx={{ fontSize: "0.8125rem", color: T2, lineHeight: 1.45 }}>
        {text}
      </Typography>
    </Box>
  );
}

function FieldBlock({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: "0.625rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: T3,
          mb: 0.25,
        }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: "0.8125rem", color: T2, lineHeight: 1.45 }}>
        {value}
      </Typography>
    </Box>
  );
}

const SIDEBAR_TRANSITION_MS = 225;

const headerToggleFabSx = {
  flexShrink: 0,
  bgcolor: "rgba(0,0,0,0.22)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: T2,
  boxShadow: "0 6px 18px rgba(0,0,0,0.2)",
  "&:hover": {
    bgcolor: "rgba(20,159,119,0.22)",
    color: "#fff",
    borderColor: "rgba(20,159,119,0.35)",
  },
} as const;

function NavItem({
  icon,
  label,
  active,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string | number;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.5,
        py: 1,
        borderRadius: "8px",
        cursor: "pointer",
        position: "relative",
        transition: "background 140ms ease",
        background: active ? "rgba(20,159,119,0.14)" : "transparent",
        border: `1px solid ${active ? "rgba(20,159,119,0.22)" : "transparent"}`,
        "&:hover": {
          background: active
            ? "rgba(20,159,119,0.17)"
            : "rgba(255,255,255,0.06)",
        },
        ...(active && {
          "&::before": {
            content: '""',
            position: "absolute",
            left: 0,
            top: "18%",
            height: "64%",
            width: "3px",
            borderRadius: "0 3px 3px 0",
            bgcolor: BRAND,
          },
        }),
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexShrink: 0,
          fontSize: "1.1rem",
          color: active ? BRAND : T2,
        }}
      >
        {icon}
      </Box>
      <Typography
        sx={{
          fontSize: "0.875rem",
          fontWeight: active ? 600 : 400,
          color: active ? "#fff" : T2,
          flex: 1,
          lineHeight: 1,
        }}
      >
        {label}
      </Typography>
      {badge !== undefined && (
        <Chip
          label={badge}
          size="small"
          sx={{
            height: 18,
            fontSize: "0.5625rem",
            fontWeight: 700,
            letterSpacing: "0.04em",
            bgcolor: "rgba(255,255,255,0.08)",
            color: T3,
            border: `1px solid ${BORDER}`,
            "& .MuiChip-label": { px: 0.75 },
          }}
        />
      )}
    </Box>
  );
}

function SessionRow({
  s,
  isActive,
  noteCount,
  onClick,
}: {
  s: SessionSummary;
  isActive: boolean;
  noteCount?: number;
  onClick: () => void;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 1.5,
        py: 1,
        borderRadius: "8px",
        cursor: "pointer",
        border: `1px solid ${isActive ? "rgba(20,159,119,0.35)" : BORDER}`,
        bgcolor: isActive ? "rgba(20,159,119,0.10)" : CARD_BG,
        transition: "background 140ms ease, border-color 140ms ease",
        "&:hover": {
          bgcolor: isActive
            ? "rgba(20,159,119,0.14)"
            : "rgba(255,255,255,0.05)",
        },
      }}
    >
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 0.875, mb: 0.375 }}
      >
        <StatusDot status={s.status} />
        <Typography
          sx={{
            fontSize: "0.8125rem",
            fontWeight: isActive ? 700 : 500,
            color: isActive ? "#fff" : T1,
            flex: 1,
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {truncate(s.title, 26) || truncate(s.id, 20)}
        </Typography>
        {isActive && (
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: BRAND,
              flexShrink: 0,
            }}
          />
        )}
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography sx={{ fontSize: "0.6875rem", color: T3 }}>
          {relativeDate(s.createdAt)}
        </Typography>
        {noteCount !== undefined && noteCount > 0 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
            <NotesRoundedIcon sx={{ fontSize: "0.625rem", color: T3 }} />
            <Typography sx={{ fontSize: "0.6875rem", color: T3 }}>
              {noteCount}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function SidebarContent({
  topbarHeight,
  onClose,
  desktopShowCollapse,
  onDesktopCollapse,
}: {
  topbarHeight: number;
  onClose?: () => void;
  desktopShowCollapse?: boolean;
  onDesktopCollapse?: () => void;
}) {
  const { user, logout, accessToken, refreshAccessToken } = useAuth();
  const session = useSessionStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const {
    sessions,
    loading: sessionsLoading,
    updateSessionStatus,
  } = useSessionList();

  const handleSessionSelect = useCallback(
    async (s: SessionSummary) => {
      if (s.id === session.sessionId || switchingId) return;
      const prevId = session.sessionId;
      if (prevId && session.sessionStatus === "active") {
        updateSessionStatus(prevId, "paused").catch(() => {});
      }
      setSwitchingId(s.id);
      session.setSessionId(s.id);
      session.setSessionStatus("active");
      session.updateMetadata({ title: s.title });
      updateSessionStatus(s.id, "active").catch(() => {});
      try {
        const res = await fetchWithAuth(
          getHudNotesUrl(s.id),
          {},
          () => accessToken,
          refreshAccessToken,
        );
        if (res.ok) {
          const json = (await res.json()) as { data?: SessionNote[] };
          if (Array.isArray(json.data)) session.updateNotes(json.data);
        }
      } catch {
      } finally {
        setSwitchingId(null);
      }
    },
    [
      session,
      accessToken,
      refreshAccessToken,
      switchingId,
      updateSessionStatus,
    ],
  );

  const handleLogout = async () => {
    onClose?.();
    setConfirmingLogout(false);
    await logout();
    navigate("/login");
  };

  const activeNoteCount = session.notes.length;
  const recentSessions = sessions.slice(0, 3);

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "secondary.main",
        borderRight: `1px solid rgba(0,0,0,0.18)`,
      }}
    >
      <Box
        sx={{
          height: topbarHeight,
          px: 2.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          flexShrink: 0,
          borderBottom: `1px solid ${BORDER}`,
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            minWidth: 0,
            flex: 1,
          }}
        >
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: "10px",
              bgcolor: BRAND,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 12h3l3-8 4 16 3-10 2 2h3"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: "1rem",
                color: "#fff",
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
              }}
            >
              Pulse HUD
            </Typography>
            <Typography
              sx={{
                fontSize: "0.625rem",
                color: T3,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Research Assistant
            </Typography>
          </Box>
        </Box>
        {desktopShowCollapse && onDesktopCollapse && (
          <Tooltip title="Hide sidebar" placement="left" arrow>
            <IconButton
              size="small"
              onClick={onDesktopCollapse}
              aria-label="Hide sidebar"
              sx={{
                ...headerToggleFabSx,
                borderRadius: "999px",
                width: 40,
                height: 40,
                display: { xs: "none", lg: "inline-flex" },
              }}
            >
              <ChevronLeftRoundedIcon sx={{ fontSize: "1.35rem" }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          px: 1.5,
          py: 2,
          "&::-webkit-scrollbar": { width: 4 },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: "rgba(255,255,255,0.12)",
            borderRadius: 4,
          },
        }}
      >
        <Stack spacing={3}>
          <Box>
            <SectionLabel>Workspace</SectionLabel>
            <Stack spacing={0.25}>
              <Box onClick={() => navigate("/")} sx={{ cursor: "pointer" }}>
                <NavItem
                  icon={<DashboardRoundedIcon fontSize="inherit" />}
                  label="Session HUD"
                  active={pathname === "/"}
                />
              </Box>
              <Box
                onClick={() => navigate("/sessions")}
                sx={{ cursor: "pointer" }}
              >
                <NavItem
                  icon={<FolderOpenRoundedIcon fontSize="inherit" />}
                  label="Sessions"
                  active={pathname === "/sessions"}
                  badge={sessions.length || undefined}
                />
              </Box>
              <NavItem
                icon={<PeopleAltRoundedIcon fontSize="inherit" />}
                label="Participants"
                badge="Soon"
              />
            </Stack>
          </Box>

          <Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 1.5,
                mb: 0.5,
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: T3,
                }}
              >
                Recent Sessions
              </Typography>
              {!sessionsLoading && sessions.length > 3 && (
                <Typography
                  onClick={() => navigate("/sessions")}
                  sx={{
                    fontSize: "0.6875rem",
                    color: BRAND,
                    cursor: "pointer",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  View all
                </Typography>
              )}
            </Box>

            {sessionsLoading ? (
              <Stack spacing={0.5}>
                {[0, 1, 2].map((i) => (
                  <Box
                    key={i}
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderRadius: "8px",
                      border: `1px solid ${BORDER}`,
                      bgcolor: CARD_BG,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.875,
                        mb: 0.5,
                      }}
                    >
                      <Skeleton
                        variant="circular"
                        width={6}
                        height={6}
                        sx={{
                          bgcolor: "rgba(255,255,255,0.08)",
                          flexShrink: 0,
                        }}
                      />
                      <Skeleton
                        variant="text"
                        width={`${55 + i * 12}%`}
                        height={14}
                        sx={{ bgcolor: "rgba(255,255,255,0.08)" }}
                      />
                    </Box>
                    <Skeleton
                      variant="text"
                      width="35%"
                      height={11}
                      sx={{ bgcolor: "rgba(255,255,255,0.05)" }}
                    />
                  </Box>
                ))}
              </Stack>
            ) : recentSessions.length === 0 ? (
              <Typography
                sx={{ fontSize: "0.75rem", color: T3, px: 1.5, py: 1 }}
              >
                No sessions yet.
              </Typography>
            ) : (
              <Stack spacing={0.5}>
                {recentSessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    s={s}
                    isActive={s.id === session.sessionId}
                    noteCount={
                      s.id === session.sessionId ? activeNoteCount : s.noteCount
                    }
                    onClick={() => handleSessionSelect(s)}
                  />
                ))}
              </Stack>
            )}
          </Box>

          <Box>
            <SectionLabel>Active Session</SectionLabel>
            <InfoCard>
              <InfoCardHeader>
                <Typography
                  sx={{ fontSize: "0.6875rem", fontWeight: 600, color: T2 }}
                >
                  Session ID
                </Typography>
                <StatusBadge status={session.sessionStatus} />
              </InfoCardHeader>
              <InfoCardBody>
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    color: T1,
                    bgcolor: "rgba(0,0,0,0.20)",
                    border: `1px solid ${BORDER}`,
                    borderRadius: "6px",
                    px: 1.25,
                    py: 0.625,
                    wordBreak: "break-all",
                    lineHeight: 1.6,
                  }}
                >
                  {truncate(session.sessionId, 28)}
                </Typography>
                {session.metadata.title && (
                  <MetaRow
                    icon={<NotesRoundedIcon sx={{ fontSize: "0.875rem" }} />}
                    text={truncate(session.metadata.title, 32)}
                  />
                )}
                {session.metadata.facilitator && (
                  <MetaRow
                    icon={
                      <PeopleAltRoundedIcon sx={{ fontSize: "0.875rem" }} />
                    }
                    text={truncate(session.metadata.facilitator, 24)}
                  />
                )}
                {session.tags.length > 0 && (
                  <MetaRow
                    icon={
                      <LocalOfferRoundedIcon sx={{ fontSize: "0.875rem" }} />
                    }
                    text={`${session.tags.length} tag${session.tags.length === 1 ? "" : "s"} captured`}
                  />
                )}
              </InfoCardBody>
            </InfoCard>
          </Box>

          {(session.metadata.audience || session.metadata.role) && (
            <Box>
              <SectionLabel>Study Context</SectionLabel>
              <InfoCard>
                <InfoCardBody>
                  {session.metadata.audience && (
                    <FieldBlock
                      label="Audience"
                      value={truncate(session.metadata.audience, 30)}
                    />
                  )}
                  {session.metadata.role && (
                    <FieldBlock
                      label="Role"
                      value={truncate(session.metadata.role, 30)}
                    />
                  )}
                </InfoCardBody>
              </InfoCard>
            </Box>
          )}

          {session.notes.length > 0 && (
            <Box>
              <SectionLabel>Notes ({session.notes.length})</SectionLabel>
              <Stack spacing={0.5}>
                {session.notes.slice(0, 3).map((note) => {
                  const tagCount = note.linkedTagIds?.length ?? 0;
                  return (
                    <Box
                      key={note.id}
                      sx={{
                        px: 1.5,
                        py: 1,
                        borderRadius: "8px",
                        border: `1px solid ${BORDER}`,
                        bgcolor: CARD_BG,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          mb: 0.25,
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            color: T1,
                            lineHeight: 1.3,
                          }}
                        >
                          {note.label}
                        </Typography>
                        {tagCount > 0 && (
                          <Chip
                            label={tagCount}
                            size="small"
                            icon={
                              <LocalOfferRoundedIcon
                                style={{ fontSize: "0.625rem" }}
                              />
                            }
                            sx={{
                              height: 16,
                              fontSize: "0.5625rem",
                              fontWeight: 700,
                              bgcolor: "rgba(20,159,119,0.18)",
                              color: BRAND,
                              border: `1px solid rgba(20,159,119,0.3)`,
                              "& .MuiChip-label": { px: 0.5 },
                              "& .MuiChip-icon": { ml: 0.5, color: BRAND },
                            }}
                          />
                        )}
                      </Box>
                      <Typography
                        sx={{ fontSize: "0.75rem", color: T2, lineHeight: 1.5 }}
                      >
                        {truncate(note.body, 48)}
                      </Typography>
                    </Box>
                  );
                })}
                {session.notes.length > 3 && (
                  <Typography
                    sx={{
                      fontSize: "0.6875rem",
                      color: T3,
                      textAlign: "center",
                      pt: 0.25,
                    }}
                  >
                    +{session.notes.length - 3} more
                  </Typography>
                )}
              </Stack>
            </Box>
          )}
        </Stack>
      </Box>

      <Box
        sx={{ flexShrink: 0, borderTop: `1px solid ${BORDER}`, px: 2, py: 1.5 }}
      >
        {confirmingLogout ? (
          <Box>
            <Typography
              sx={{
                fontSize: "0.8125rem",
                color: T2,
                mb: 1.25,
                lineHeight: 1.5,
              }}
            >
              Sign out of Pulse HUD?
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                fullWidth
                variant="outlined"
                onClick={() => setConfirmingLogout(false)}
                sx={{
                  fontSize: "0.75rem",
                  color: T2,
                  border: `1px solid ${BORDER}`,
                  "&:hover": {
                    bgcolor: "rgba(255,255,255,0.06)",
                    border: `1px solid ${BORDER}`,
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                size="small"
                fullWidth
                variant="contained"
                onClick={handleLogout}
                sx={{
                  fontSize: "0.75rem",
                  bgcolor: "#ef4444",
                  color: "#fff",
                  "&:hover": { bgcolor: "#dc2626" },
                  boxShadow: "none",
                }}
              >
                Sign out
              </Button>
            </Stack>
          </Box>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Avatar
              sx={{
                width: 34,
                height: 34,
                bgcolor: BRAND,
                fontSize: "0.75rem",
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
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: T1,
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
                  color: T3,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user?.email ?? ""}
              </Typography>
            </Box>
            <Tooltip title="Sign out" placement="top">
              <IconButton
                size="small"
                onClick={() => setConfirmingLogout(true)}
                aria-label="sign out"
                sx={{
                  color: T3,
                  "&:hover": {
                    color: "#fff",
                    bgcolor: "rgba(255,255,255,0.08)",
                  },
                }}
              >
                <LogoutRoundedIcon sx={{ fontSize: "1.1rem" }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  );
}

interface SidebarProps {
  width: number;
  topbarHeight: number;
  open: boolean;
  onClose: () => void;
  desktopExpanded: boolean;
  onDesktopExpandedChange: (expanded: boolean) => void;
}

export function Sidebar({
  width,
  topbarHeight,
  open,
  onClose,
  desktopExpanded,
  onDesktopExpandedChange,
}: SidebarProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));

  const paperSx = {
    width,
    border: "none",
    backgroundImage: "none",
    bgcolor: "transparent",
  };

  if (isDesktop) {
    return (
      <>
        <Box
          sx={{
            width: desktopExpanded ? width : 0,
            flexShrink: 0,
            alignSelf: "flex-start",
            position: "sticky",
            top: 0,
            height: "100vh",
            maxHeight: "100vh",
            overflow: "hidden",
            transition: `width ${SIDEBAR_TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            willChange: "width",
          }}
        >
          <Box sx={{ width, height: "100%", minHeight: "100%" }}>
            <SidebarContent
              topbarHeight={topbarHeight}
              desktopShowCollapse={desktopExpanded}
              onDesktopCollapse={() => onDesktopExpandedChange(false)}
            />
          </Box>
        </Box>
      </>
    );
  }

  return (
    <Drawer
      variant="temporary"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      slotProps={{ paper: { sx: paperSx } }}
    >
      <SidebarContent topbarHeight={topbarHeight} onClose={onClose} />
    </Drawer>
  );
}
