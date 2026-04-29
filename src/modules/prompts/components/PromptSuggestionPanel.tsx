import { memo, useState } from "react";
import {
  alpha,
  Box,
  Chip,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import RuleRoundedIcon from "@mui/icons-material/RuleRounded";
import { GlassPanel } from "@/shared/components/GlassPanel";
import { SectionHeader } from "@/shared/components/SectionHeader";
import { formatClock } from "@/shared/utils/formatters";
import { PromptSuggestion } from "@/modules/prompts/types";

function transcriptRefCount(p: PromptSuggestion): number {
  if (p.transcriptIds?.length) return p.transcriptIds.length;
  if (p.transcriptId) return 1;
  return 0;
}

interface PromptSuggestionPanelProps {
  prompts: PromptSuggestion[];
  onDismiss?: (promptId: string) => void;
  onUse?: (promptId: string) => void;
}

export const PromptSuggestionPanel = memo(function PromptSuggestionPanel({
  prompts,
  onDismiss,
  onUse,
}: PromptSuggestionPanelProps) {
  const theme = useTheme();
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const handleUse = (id: string) => {
    setUsedIds((prev) => new Set([...prev, id]));
    onUse?.(id);
  };

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
    onDismiss?.(id);
  };

  const visible = prompts.filter((p) => !dismissedIds.has(p.id));

  const metaChipSx = {
    height: 22,
    fontSize: "0.65rem",
    fontWeight: 600,
    borderColor: alpha(theme.palette.grey[500], 0.35),
    bgcolor: alpha(theme.palette.common.white, 0.55),
  };

  return (
    <GlassPanel>
      <Stack sx={{ gap: 2 }}>
        <SectionHeader
          eyebrow="AI coach"
          title="Interviewer follow-ups"
          subtitle="Server AI tags INTERVIEWER (system/call audio) vs INTERVIEWEE (your mic) and suggests follow-ups when you speak. Offline patterns fill in only if the model is unavailable."
        />
        <Divider />
        <Stack sx={{ gap: 1.5 }}>
          {visible.length ? (
            visible.map((prompt, index) => {
              const refCount = transcriptRefCount(prompt);
              const showRefSummary = refCount > 0;
              const timeLabel = prompt.transcriptTimeLabel ?? formatClock(prompt.timestamp);
              const prevTimeLabel =
                index > 0
                  ? visible[index - 1].transcriptTimeLabel ??
                    formatClock(visible[index - 1].timestamp)
                  : null;
              const showTimeChip = prevTimeLabel === null || timeLabel !== prevTimeLabel;
              const origin = prompt.suggestionOrigin ?? "local";
              const isModel = origin === "model";

              const AI_VIOLET = "#7C3AED";

              return (
                <Box
                  key={prompt.id}
                  sx={{
                    p: 1.75,
                    borderRadius: 2,
                    border: isModel
                      ? `1px solid ${alpha(AI_VIOLET, 0.35)}`
                      : `1px solid ${alpha(theme.palette.grey[500], 0.22)}`,
                    background: isModel
                      ? `linear-gradient(135deg, ${alpha(AI_VIOLET, 0.06)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 55%)`
                      : alpha(theme.palette.grey[500], 0.04),
                    boxShadow: isModel ? `0 4px 20px ${alpha(AI_VIOLET, 0.12)}` : "none",
                  }}
                >
                <Stack sx={{ gap: 0.75 }}>
                  <Stack
                    direction="row"
                    sx={{
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 1,
                    }}
                  >
                    <Stack sx={{ flex: 1, minWidth: 0, gap: 0.75 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: "-0.01em" }}>
                        {prompt.title}
                      </Typography>
                      <Stack
                        direction="row"
                        sx={{
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 0.5,
                          rowGap: 0.5,
                        }}
                      >
                        <Tooltip
                          title={
                            isModel
                              ? "Generated from live transcript: interviewee lines drive these questions for the interviewer."
                              : "Client-side pattern when server AI suggestions are not available."
                          }
                        >
                          <Chip
                            size="small"
                            variant="outlined"
                            icon={
                              isModel ? (
                                <AutoAwesomeRoundedIcon sx={{ "&&": { fontSize: 15 } }} />
                              ) : (
                                <RuleRoundedIcon sx={{ "&&": { fontSize: 15 } }} />
                              )
                            }
                            label={isModel ? "AI · model" : "Offline"}
                            sx={{
                              ...metaChipSx,
                              height: 22,
                              color: isModel ? AI_VIOLET : "text.secondary",
                              borderColor: isModel
                                ? alpha(AI_VIOLET, 0.45)
                                : alpha(theme.palette.grey[600], 0.35),
                              bgcolor: isModel
                                ? alpha(AI_VIOLET, 0.08)
                                : alpha(theme.palette.grey[500], 0.08),
                              fontWeight: 700,
                              "& .MuiChip-icon": { color: "inherit" },
                            }}
                          />
                        </Tooltip>
                        {showTimeChip ? (
                          <Chip
                            label={timeLabel}
                            size="small"
                            variant="outlined"
                            sx={{
                              ...metaChipSx,
                              color: "primary.dark",
                              borderColor: alpha(theme.palette.primary.main, 0.35),
                              bgcolor: alpha(theme.palette.primary.main, 0.06),
                            }}
                          />
                        ) : null}
                        {showRefSummary ? (
                          <Chip
                            label={`${refCount} transcript ref${refCount === 1 ? "" : "s"}`}
                            size="small"
                            variant="outlined"
                            color="info"
                            sx={{ ...metaChipSx, borderColor: alpha(theme.palette.info.main, 0.35) }}
                          />
                        ) : null}
                        {usedIds.has(prompt.id) ? (
                          <Chip
                            label="Used"
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ ...metaChipSx, height: 22, borderColor: alpha(theme.palette.success.main, 0.45) }}
                          />
                        ) : null}
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {prompt.body}
                      </Typography>
                    </Stack>
                    <Stack direction="row" sx={{ flexShrink: 0, gap: 0.25 }}>
                      <Tooltip title="Mark as used">
                        <IconButton
                          size="small"
                          onClick={() => handleUse(prompt.id)}
                          disabled={usedIds.has(prompt.id)}
                          aria-label="Mark prompt as used"
                          sx={{ color: "success.main", opacity: usedIds.has(prompt.id) ? 0.4 : 1 }}
                        >
                          <CheckRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dismiss">
                        <IconButton
                          size="small"
                          onClick={() => handleDismiss(prompt.id)}
                          aria-label="Dismiss prompt"
                          sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}
                        >
                          <CloseRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Stack>
                </Box>
              );
            })
          ) : (
            <Typography variant="body2" color="text.secondary">
              AI suggestions refresh after you speak on the mic; system audio carries the interviewer. Set session context (title, facilitator, audience, role) for best results.
            </Typography>
          )}
        </Stack>
      </Stack>
    </GlassPanel>
  );
});
