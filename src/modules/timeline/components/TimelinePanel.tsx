import { memo, useMemo, type KeyboardEvent } from "react";
import { alpha, Box, Stack, Typography, useTheme } from "@mui/material";
import { GlassPanel } from "@/shared/components/GlassPanel";
import { SectionHeader } from "@/shared/components/SectionHeader";
import type { TimelineMarker, TimelineMarkerKind } from "@/modules/timeline/types";
import { MARKER_COLORS } from "@/app/providers/theme";

interface TimelinePanelProps {
  activeItemId?: string;
  markers: TimelineMarker[];
  onSelect: (itemId?: string) => void;
}

const KIND_LABEL: Record<TimelineMarkerKind, string> = {
  transcript: "Transcript",
  tag: "Tag",
  prompt: "Prompt",
  signal: "Signal",
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

export const TimelinePanel = memo(function TimelinePanel({
  activeItemId,
  markers,
  onSelect,
}: TimelinePanelProps) {
  const theme = useTheme();

  const railBorder = alpha(theme.palette.grey[500], 0.12);

  const scrollRailSx = useMemo(
    () => ({
      boxSizing: "border-box" as const,
      overflowX: "auto" as const,
      overflowY: "hidden" as const,
      display: "flex",
      flexDirection: "row" as const,
      alignItems: "stretch",
      gap: theme.spacing(1.25),
      py: theme.spacing(1.5),
      px: theme.spacing(2),
      WebkitOverflowScrolling: "touch" as const,
      scrollbarWidth: "thin" as const,
      scrollbarColor: `${alpha(theme.palette.grey[600], 0.4)} ${alpha(theme.palette.grey[400], 0.2)}`,
      "&::-webkit-scrollbar": {
        height: 8,
      },
      "&::-webkit-scrollbar-track": {
        margin: 0,
        marginTop: theme.spacing(0.5),
        backgroundColor: alpha(theme.palette.grey[500], 0.08),
        borderRadius: 999,
      },
      "&::-webkit-scrollbar-thumb": {
        backgroundColor: alpha(theme.palette.grey[700], 0.35),
        borderRadius: 999,
        border: `2px solid ${alpha(theme.palette.grey[200], 0.98)}`,
      },
      "&::-webkit-scrollbar-thumb:hover": {
        backgroundColor: alpha(theme.palette.grey[800], 0.48),
      },
    }),
    [theme],
  );

  return (
    <GlassPanel sx={{ p: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <Stack spacing={0} sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}>
        <SectionHeader
          eyebrow="Timeline"
          title="Session signal rail"
          subtitle="Your session unfolds here in order, click or scroll this row left or right to hop between moments."
        />
      </Stack>

      <Box
        sx={{
          mx: 2.5,
          mb: 2.5,
          borderRadius: "12px",
          border: `1px solid ${railBorder}`,
          bgcolor: alpha(theme.palette.grey[500], 0.04),
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <Box sx={scrollRailSx}>
          {markers.length ? (
            markers.map((marker) => {
              const isActive = Boolean(marker.itemId && marker.itemId === activeItemId);
              const accent = MARKER_COLORS[marker.kind];
              return (
                <Box
                  key={marker.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive ? true : false}
                  onClick={() => onSelect(marker.itemId)}
                  onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(marker.itemId);
                    }
                  }}
                  sx={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 1.25,
                    flexShrink: 0,
                    minWidth: 196,
                    maxWidth: 300,
                    py: 1.125,
                    pl: 1.25,
                    pr: 1.5,
                    borderRadius: "22px",
                    cursor: "pointer",
                    outline: "none",
                    border: `1px solid ${
                      isActive
                        ? alpha(accent, 0.42)
                        : alpha(theme.palette.grey[500], 0.14)
                    }`,
                    bgcolor: isActive
                      ? alpha(accent, 0.1)
                      : alpha(theme.palette.common.white, 0.72),
                    boxShadow: isActive
                      ? `0 1px 2px ${alpha(theme.palette.common.black, 0.04)}, 0 0 0 2px ${alpha(accent, 0.18)}`
                      : `0 1px 2px ${alpha(theme.palette.common.black, 0.04)}`,
                    transition: theme.transitions.create(
                      ["background-color", "border-color", "box-shadow", "transform"],
                      { duration: theme.transitions.duration.shorter },
                    ),
                    "&:hover": {
                      bgcolor: alpha(accent, 0.07),
                      borderColor: alpha(accent, 0.28),
                      transform: "translateY(-1px)",
                    },
                    "&:focus-visible": {
                      boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.35)}`,
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 4,
                      alignSelf: "stretch",
                      minHeight: 36,
                      borderRadius: 999,
                      bgcolor: accent,
                      flexShrink: 0,
                      opacity: isActive ? 1 : 0.85,
                    }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        color: "text.secondary",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        fontSize: "0.5625rem",
                        lineHeight: 1.4,
                      }}
                    >
                      {KIND_LABEL[marker.kind]}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.primary"
                      noWrap
                      title={marker.label}
                      sx={{ fontWeight: 600, lineHeight: 1.35 }}
                    >
                      {marker.label}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      flexShrink: 0,
                      color: "text.disabled",
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                      fontSize: "0.6875rem",
                    }}
                  >
                    {formatTime(marker.timestamp)}
                  </Typography>
                </Box>
              );
            })
          ) : (
            <Box
              sx={{
                flex: 1,
                minHeight: 56,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 2,
                py: 1.5,
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                Markers appear here as the session unfolds.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </GlassPanel>
  );
});
