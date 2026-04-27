import { memo, useMemo } from "react";
import {
  alpha,
  Box,
  Chip,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { GlassPanel } from "@/shared/components/GlassPanel";
import { SectionHeader } from "@/shared/components/SectionHeader";
import { formatClock } from "@/shared/utils/formatters";
import { TranscriptItem } from "@/modules/transcript/types";
import { TagOption, TranscriptTag } from "@/modules/tagging/types";
import { formatCtrlShortcut, paletteDigitForTag } from "@/modules/tagging/utils/paletteShortcut";
import { tagChipOutlinedRestSx } from "@/modules/tagging/utils/tagChipStyles";

interface TagPanelProps {
  activeTagId: string;
  selectedTranscript?: TranscriptItem;
  tags: TagOption[];
  transcriptTags: TranscriptTag[];
  onFocus: (id: string) => void;
  onAttach: (tagId: string) => void;
}

function shortFromLabel(label: string) {
  const letters = label.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 1) return letters.slice(0, 3).toUpperCase();
  const alnum = label.replace(/[^a-zA-Z0-9]/g, "");
  return (alnum.slice(0, 3) || "TAG").toUpperCase();
}

function resolveTagDisplay(tag: TranscriptTag, catalog: TagOption[]) {
  const opt = catalog.find((o) => o.id === tag.tagId);
  const label = opt?.label ?? tag.tagId;
  const shortLabel = opt?.shortLabel ?? shortFromLabel(label);
  return {
    label,
    shortLabel,
    color: (opt?.color ?? "default") as TagOption["color"],
  };
}

const SECTION_LABEL_SX = {
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  display: "block",
  mb: 1,
  lineHeight: 1.4,
};

export const TagPanel = memo(function TagPanel({
  activeTagId,
  selectedTranscript,
  tags,
  transcriptTags,
  onAttach,
  onFocus,
}: TagPanelProps) {
  const theme = useTheme();
  const rail = alpha(theme.palette.grey[500], 0.12);

  const recentTags = useMemo(
    () => transcriptTags.slice(-8).reverse(),
    [transcriptTags],
  );

  const chipBaseSx = {
    height: 32,
    fontWeight: 600,
    fontSize: "0.8125rem",
    borderRadius: "10px",
    "&:focus-visible": {
      outline: `2px solid ${alpha(theme.palette.primary.main, 0.45)}`,
      outlineOffset: 2,
    },
  };

  const wellSx = {
    borderRadius: "14px",
    border: `1px solid ${rail}`,
    bgcolor: alpha(theme.palette.grey[500], 0.04),
    p: { xs: 1.75, sm: 2 },
    minWidth: 0,
  };

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
          eyebrow="Tagging"
          title="Capture moments fast"
          subtitle="Ctrl+1…Ctrl+9 focus that quick tag and attach it to the selected transcript line. Ctrl+T attaches whichever tag is already focused."
        />

        <Box sx={wellSx}>
          <Typography variant="caption" color="text.secondary" sx={SECTION_LABEL_SX}>
            Quick tags
          </Typography>
          <Stack
            direction="row"
            sx={{
              flexWrap: "wrap",
              alignItems: "center",
              alignContent: "flex-start",
              gap: 1,
              rowGap: 1,
            }}
          >
            {tags.map((tag, index) => {
              const digit = paletteDigitForTag(tag, index);
              const combo = digit ? formatCtrlShortcut(digit) : null;
              const short = tag.shortLabel ?? shortFromLabel(tag.label);
              return (
                <Chip
                  key={tag.id}
                  clickable
                  color={tag.color}
                  label={
                    <Stack
                      component="span"
                      direction="row"
                      sx={{
                        alignItems: "center",
                        gap: 0.75,
                        py: 0.125,
                        maxWidth: "100%",
                      }}
                    >
                      {combo ? (
                        <Box
                          component="span"
                          aria-hidden
                          sx={{
                            minWidth: 44,
                            height: 22,
                            px: 0.35,
                            borderRadius: "6px",
                            fontSize: "0.55rem",
                            fontWeight: 800,
                            lineHeight: 1,
                            letterSpacing: "-0.02em",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            bgcolor: alpha(theme.palette.common.black, 0.08),
                            color: "text.primary",
                            border: `1px solid ${alpha(theme.palette.grey[500], 0.2)}`,
                          }}
                        >
                          {combo}
                        </Box>
                      ) : null}
                      <Typography
                        component="span"
                        variant="inherit"
                        sx={{ fontWeight: 700, fontSize: "0.8125rem", lineHeight: 1.2 }}
                      >
                        {tag.label}
                      </Typography>
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.65rem",
                          letterSpacing: "0.04em",
                          color: "text.secondary",
                          opacity: 0.9,
                          flexShrink: 0,
                        }}
                      >
                        {short}
                      </Typography>
                    </Stack>
                  }
                  onClick={() => onFocus(tag.id)}
                  onDoubleClick={() => onAttach(tag.id)}
                  variant={tag.id === activeTagId ? "filled" : "outlined"}
                  aria-label={`${tag.label}, keyboard ${combo ?? "none"}, ${short}`}
                  sx={{
                    ...chipBaseSx,
                    height: "auto",
                    minHeight: 32,
                    py: 0.5,
                    "& .MuiChip-label": {
                      display: "flex",
                      alignItems: "center",
                      px: 0.75,
                      overflow: "hidden",
                    },
                    ...(tag.id !== activeTagId ? tagChipOutlinedRestSx(theme, tag.color) : {}),
                  }}
                />
              );
            })}
          </Stack>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 1.5, lineHeight: 1.5, opacity: 0.92 }}
          >
            Single-click to focus · double-click to attach.
          </Typography>
        </Box>

        <Box sx={wellSx}>
          <Typography variant="caption" color="text.secondary" sx={SECTION_LABEL_SX}>
            Selected transcript
          </Typography>
          {selectedTranscript ? (
            <Stack sx={{ gap: 0.75 }}>
              <Stack
                direction="row"
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                  flexWrap: "wrap",
                }}
              >
                <Chip
                  label={selectedTranscript.speakerId}
                  size="small"
                  variant="outlined"
                  sx={{
                    height: 24,
                    fontWeight: 600,
                    fontSize: "0.6875rem",
                    borderColor: alpha(theme.palette.grey[500], 0.35),
                  }}
                />
                <Typography
                  variant="caption"
                  color="primary.light"
                  sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
                >
                  {selectedTranscript.formattedTime}
                </Typography>
              </Stack>
              <Typography
                variant="body2"
                sx={{
                  lineHeight: 1.65,
                  color: "text.primary",
                  display: "-webkit-box",
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {selectedTranscript.text}
              </Typography>
            </Stack>
          ) : (
            <Box
              sx={{
                py: 2,
                px: 1.5,
                borderRadius: "12px",
                border: `1px dashed ${alpha(theme.palette.grey[500], 0.22)}`,
                bgcolor: alpha(theme.palette.grey[500], 0.03),
                textAlign: "center",
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                Select a line in the transcript to attach tags.
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ ...wellSx, p: { xs: 1.75, sm: 2 }, bgcolor: alpha(theme.palette.grey[500], 0.03) }}>
          <Typography variant="caption" color="text.secondary" sx={SECTION_LABEL_SX}>
            Recent tags
          </Typography>
          <Stack sx={{ gap: 1 }}>
            {recentTags.length ? (
              recentTags.map((tag) => {
                const { label, shortLabel, color } = resolveTagDisplay(tag, tags);
                const catalogIdx = tags.findIndex((t) => t.id === tag.tagId);
                const digit =
                  catalogIdx >= 0 ? paletteDigitForTag(tags[catalogIdx], catalogIdx) : null;
                const combo = digit ? formatCtrlShortcut(digit) : null;
                return (
                  <Box
                    key={tag.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1.5,
                      minHeight: 40,
                      py: 0.75,
                      px: 1.25,
                      borderRadius: "12px",
                      border: `1px solid ${alpha(theme.palette.grey[500], 0.1)}`,
                      bgcolor: alpha(theme.palette.common.white, 0.55),
                    }}
                  >
                    <Stack
                      direction="row"
                      sx={{
                        alignItems: "center",
                        gap: 0.75,
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      {combo ? (
                        <Box
                          component="span"
                          aria-hidden
                          sx={{
                            minWidth: 44,
                            height: 22,
                            px: 0.35,
                            borderRadius: "6px",
                            fontSize: "0.55rem",
                            fontWeight: 800,
                            lineHeight: 1,
                            letterSpacing: "-0.02em",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            bgcolor: alpha(theme.palette.common.black, 0.06),
                            color: "text.secondary",
                            border: `1px solid ${alpha(theme.palette.grey[500], 0.18)}`,
                          }}
                        >
                          {combo}
                        </Box>
                      ) : null}
                      <Chip
                        label={
                          <Stack component="span" direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                            <Typography
                              component="span"
                              variant="inherit"
                              sx={{ fontWeight: 600, fontSize: "0.7rem", overflow: "hidden", textOverflow: "ellipsis" }}
                            >
                              {label}
                            </Typography>
                            <Typography
                              component="span"
                              variant="caption"
                              sx={{
                                fontWeight: 700,
                                fontSize: "0.6rem",
                                letterSpacing: "0.04em",
                                color: "text.secondary",
                                flexShrink: 0,
                              }}
                            >
                              {shortLabel}
                            </Typography>
                          </Stack>
                        }
                        size="small"
                        color={color}
                        variant="outlined"
                        aria-label={`${label} ${shortLabel}${combo ? `, ${combo}` : ""}`}
                        sx={{
                          height: 26,
                          maxWidth: combo ? "min(100%, 160px)" : "min(100%, 200px)",
                          fontWeight: 600,
                          fontSize: "0.7rem",
                          ...tagChipOutlinedRestSx(theme, color),
                          "& .MuiChip-label": {
                            display: "flex",
                            alignItems: "center",
                            px: 0.75,
                            overflow: "hidden",
                          },
                        }}
                      />
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        flexShrink: 0,
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatClock(tag.timestamp)}
                    </Typography>
                  </Box>
                );
              })
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1, lineHeight: 1.55 }}>
                Tagged moments show up here as you capture them.
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>
    </GlassPanel>
  );
});
