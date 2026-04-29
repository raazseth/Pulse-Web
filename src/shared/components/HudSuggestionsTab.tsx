import { memo, useMemo, type RefObject } from "react";
import { keyframes } from "@emotion/react";
import { alpha, useTheme, type Theme } from "@mui/material/styles";
import { Box, Stack, Typography } from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import RuleRoundedIcon from "@mui/icons-material/RuleRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import MicNoneOutlinedIcon from "@mui/icons-material/MicNoneOutlined";
import type { TranscriptItem } from "@/modules/transcript/types";
import type { PromptSuggestion } from "@/modules/prompts/types";
import {
  getFloatingHudTokens,
  type FloatingHudTokens,
} from "@/app/providers/theme";
import { formatClock } from "@/shared/utils/formatters";
import {
  intervieweeUiLabel,
  interviewerSideUiLabel,
  isIntervieweeSpeaker,
} from "@/modules/transcript/utils/interviewRoles";

const INTERVIEWEE_TEAL = "#26C6DA";
const AI_VIOLET = "#A78BFA";
const AI_GLOW = "rgba(167, 139, 250, 0.22)";

const kfBubbleLeft = keyframes`
  from { opacity: 0; transform: translateX(-10px); }
  to   { opacity: 1; transform: translateX(0);     }
`;
const kfBubbleRight = keyframes`
  from { opacity: 0; transform: translateX(10px); }
  to   { opacity: 1; transform: translateX(0);    }
`;
const kfCardIn = keyframes`
  from { opacity: 0; transform: translateY(10px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
`;
const kfCardOut = keyframes`
  from { opacity: 1; transform: translateY(0)    scale(1);    }
  to   { opacity: 0; transform: translateY(-6px) scale(0.97); }
`;
const kfDotBlink = keyframes`
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.75); }
  40%            { opacity: 1;   transform: scale(1);    }
`;
const kfAcceptedIn = keyframes`
  from { opacity: 0; transform: translateY(8px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1);    }
`;

export interface AcceptedMsg {
  id: string;
  text: string;
  title: string;
  timestamp: string;
  origin: "model" | "local";
  transcriptId?: string;
  transcriptIds?: string[];
}

export interface PendingMsg {
  id: string;
  text: string;
  speakerId: string;
  timestamp: string;
}

export type TimelineRow =
  | { kind: "transcript"; id: string; item: TranscriptItem }
  | { kind: "accepted"; id: string; msg: AcceptedMsg }
  | { kind: "pending"; id: string; msg: PendingMsg };


const TypingDots = memo(function TypingDots({ color }: { color: string }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: "4px", py: 0.25 }}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            bgcolor: color,
            animation: `${kfDotBlink} 1.2s ease-in-out infinite`,
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </Box>
  );
});


const SuggestionCard = memo(function SuggestionCard({
  prompt,
  isRejecting,
  onAccept,
  onReject,
  hud,
  theme,
  anchoredToIntervieweeMic,
}: {
  prompt: PromptSuggestion;
  isRejecting: boolean;
  onAccept: (p: PromptSuggestion) => void;
  onReject: (id: string) => void;
  hud: FloatingHudTokens;
  theme: Theme;
  anchoredToIntervieweeMic: boolean;
}) {
  const isModel = (prompt.suggestionOrigin ?? "local") === "model";
  const timeLabel = prompt.transcriptTimeLabel ?? formatClock(prompt.timestamp);
  const accent = isModel ? AI_VIOLET : anchoredToIntervieweeMic ? INTERVIEWEE_TEAL : hud.accentMain;
  const aa = (a: number) => alpha(accent, a);

  return (
    <Box
      sx={{
        width: "100%",
        minWidth: 0,
        alignSelf: "stretch",
        animation: isRejecting
          ? `${kfCardOut} 200ms ease both`
          : `${kfCardIn} 240ms cubic-bezier(0.16,1,0.3,1) both`,
        borderRadius: "12px",
        border: isModel
          ? `1px solid ${alpha(AI_VIOLET, 0.45)}`
          : `1px solid ${hud.border}`,
        ...(isModel
          ? {
            background: `linear-gradient(145deg, ${alpha(AI_VIOLET, 0.14)} 0%, ${alpha(theme.palette.common.black, 0.28)} 52%, ${hud.card} 100%)`,
          }
          : { bgcolor: hud.card }),
        boxShadow: isModel
          ? `0 0 24px ${AI_GLOW}, 0 4px 18px ${alpha(theme.palette.common.black, 0.2)}`
          : `0 2px 8px ${alpha(theme.palette.common.black, 0.1)}`,
        overflow: "hidden",
        position: "relative",
        transition: "border-color 180ms ease, box-shadow 180ms ease, opacity 180ms ease",
        willChange: "transform, opacity",
        "&:hover": {
          borderColor: isModel ? alpha(AI_VIOLET, 0.65) : hud.borderStrong,
          boxShadow: isModel
            ? `0 0 28px ${alpha(AI_VIOLET, 0.35)}, 0 6px 22px ${alpha(theme.palette.common.black, 0.22)}`
            : `0 4px 14px ${alpha(theme.palette.common.black, 0.14)}`,
        },
      }}
    >
      {isModel ? (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `radial-gradient(120% 80% at 0% 0%, ${alpha(AI_VIOLET, 0.16)} 0%, transparent 55%)`,
          }}
        />
      ) : null}
      <Box sx={{
        position: "absolute", left: 0, top: 5, bottom: 5, width: 3,
        borderRadius: "0 3px 3px 0",
        bgcolor: isModel ? AI_VIOLET : alpha(theme.palette.common.white, 0.15),
      }} />

      <Stack sx={{ p: 1.1, pl: 1.85, gap: 0.45, width: "100%", minWidth: 0, boxSizing: "border-box", position: "relative" }}>
        <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 0.5, flexWrap: "wrap", width: "100%", minWidth: 0 }}>
          <Box sx={{ color: isModel ? AI_VIOLET : anchoredToIntervieweeMic ? INTERVIEWEE_TEAL : hud.mid, display: "flex", alignItems: "center" }}>
            {isModel ? (
              <AutoAwesomeRoundedIcon sx={{ fontSize: 13 }} />
            ) : anchoredToIntervieweeMic ? (
              <MicNoneOutlinedIcon sx={{ fontSize: 13 }} />
            ) : (
              <RuleRoundedIcon sx={{ fontSize: 13 }} />
            )}
          </Box>
          <Typography variant="caption" sx={{
            fontSize: "0.625rem", letterSpacing: "0.07em", textTransform: "uppercase",
            color: isModel ? alpha(AI_VIOLET, 0.95) : hud.low, fontWeight: 600,
          }}>
            {isModel
              ? "AI · interviewer vs you"
              : anchoredToIntervieweeMic
                ? "After your mic"
                : "Offline pattern"}
          </Typography>
          <Typography variant="caption" sx={{ fontSize: "0.625rem", color: hud.faint, ml: "auto", fontVariantNumeric: "tabular-nums" }}>
            {timeLabel}
          </Typography>
        </Stack>

        <Typography variant="subtitle2" sx={{
          fontSize: "0.78rem", fontWeight: 600, lineHeight: 1.28, color: hud.hi,
          letterSpacing: "-0.01em", display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere",
        }}>
          {prompt.title}
        </Typography>

        {prompt.body ? (
          <Typography variant="body2" sx={{
            fontSize: "0.75rem", color: hud.mid, lineHeight: 1.5,
            display: "-webkit-box", WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere",
          }}>
            {prompt.body}
          </Typography>
        ) : null}

        <Stack
          sx={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 0.35,
            mt: 0.125,
          }}
        >
          <Box
            component="button"
            type="button"
            onClick={() => onAccept(prompt)}
            aria-label="Accept suggestion"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              p: 0,
              minWidth: 22,
              borderRadius: "6px",
              border: `1px solid ${aa(0.28)}`,
              bgcolor: "transparent",
              color: anchoredToIntervieweeMic ? INTERVIEWEE_TEAL : isModel ? AI_VIOLET : hud.accent,
              cursor: "pointer",
              transition: "background-color 120ms ease, border-color 120ms ease, opacity 120ms ease",
              "&:hover": { bgcolor: aa(0.1), borderColor: aa(0.45) },
              "&:active": { opacity: 0.75 },
            }}
          >
            <CheckRoundedIcon sx={{ fontSize: 14 }} />
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => onReject(prompt.id)}
            aria-label="Delete suggestion"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              p: 0,
              minWidth: 22,
              borderRadius: "6px",
              border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
              bgcolor: "transparent",
              color: hud.faint,
              cursor: "pointer",
              transition: "background-color 120ms ease, border-color 120ms ease, color 120ms ease",
              "&:hover": {
                bgcolor: alpha(theme.palette.error.main, 0.1),
                borderColor: alpha(theme.palette.error.main, 0.28),
                color: alpha(theme.palette.error.light, 0.95),
              },
              "&:active": { opacity: 0.75 },
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: 14 }} />
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
});

const TranscriptBubble = memo(function TranscriptBubble({
  item, isMe, hud, theme,
}: {
  item: TranscriptItem;
  isMe: boolean;
  hud: FloatingHudTokens;
  theme: Theme;
}) {
  const speakerNorm = String(item.speakerId ?? "").trim().toLowerCase();
  const isGuest = isIntervieweeSpeaker(item.speakerId);
  const isPartial = item.text === "…";

  const bubbleBg = isMe ? alpha(theme.palette.primary.main, 0.8)
    : isGuest ? alpha(INTERVIEWEE_TEAL, 0.1)
      : alpha(theme.palette.common.white, 0.06);
  const bubbleBorder = isMe ? alpha(theme.palette.primary.main, 0.4)
    : isGuest ? alpha(INTERVIEWEE_TEAL, 0.4)
      : hud.border;
  const bubbleShadow = isMe ? `0 2px 10px ${alpha(theme.palette.primary.main, 0.18)}`
    : isGuest ? `0 2px 10px ${alpha(INTERVIEWEE_TEAL, 0.12)}`
      : `0 1px 3px ${alpha(theme.palette.common.black, 0.1)}`;
  const metaColor = isMe ? alpha(theme.palette.common.white, 0.6)
    : isGuest ? alpha(INTERVIEWEE_TEAL, 0.85)
      : hud.faint;
  const timeColor = isMe ? alpha(theme.palette.common.white, 0.4)
    : isGuest ? alpha(INTERVIEWEE_TEAL, 0.5)
      : hud.faint;
  const textColor = isMe ? alpha(theme.palette.common.white, 0.96) : hud.hi;
  const bubbleRadius = isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px";
  const speakerLabel = isMe
    ? "You"
    : isGuest
      ? intervieweeUiLabel(item.speakerId)
      : interviewerSideUiLabel(item.speakerId);
  const dotColor = isMe ? alpha(theme.palette.common.white, 0.6) : isGuest ? INTERVIEWEE_TEAL : hud.mid;

  return (
    <Stack
      sx={{
        width: "100%",
        minWidth: 0,
        alignItems: isMe ? "flex-end" : "flex-start",
        animation: `${isMe ? kfBubbleRight : kfBubbleLeft} 220ms cubic-bezier(0.16,1,0.3,1) both`,
        willChange: "transform, opacity",
      }}
    >
      <Box
        sx={{
          maxWidth: "87%",
          px: 1.5,
          py: isPartial ? 0.75 : 1,
          borderRadius: bubbleRadius,
          bgcolor: bubbleBg,
          border: `1px solid ${bubbleBorder}`,
          boxShadow: bubbleShadow,
          transition: "border-color 180ms ease",
        }}
      >
        <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 0.5, mb: isPartial ? 0 : 0.4, justifyContent: isMe ? "flex-end" : "flex-start" }}>
          {speakerNorm === "system" && !isPartial && <HeadphonesIcon sx={{ fontSize: 10, color: metaColor }} />}
          {!isPartial && (
            <>
              <Typography variant="caption" sx={{ fontSize: "0.6rem", color: metaColor, fontWeight: 600, textTransform: "capitalize" }}>
                {speakerLabel}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: "0.6rem", color: timeColor, fontVariantNumeric: "tabular-nums" }}>
                {item.formattedTime || formatClock(item.timestamp)}
              </Typography>
            </>
          )}
        </Stack>
        {isPartial ? (
          <TypingDots color={dotColor} />
        ) : (
          <Typography variant="body2" sx={{
            fontSize: "0.8125rem", lineHeight: 1.5, color: textColor,
            whiteSpace: "pre-wrap", wordBreak: "break-word",
            textAlign: isMe ? "right" : "left",
          }}>
            {item.text}
          </Typography>
        )}
      </Box>
    </Stack>
  );
});

const AcceptedMessageBubble = memo(function AcceptedMessageBubble({
  msg, hud, theme,
}: {
  msg: AcceptedMsg;
  hud: FloatingHudTokens;
  theme: Theme;
}) {
  return (
    <Stack
      sx={{
        width: "100%",
        minWidth: 0,
        alignItems: "flex-start",
        animation: `${kfAcceptedIn} 280ms cubic-bezier(0.34,1.56,0.64,1) both`,
        willChange: "transform, opacity",
      }}
    >
      <Box sx={{
        maxWidth: "87%", px: 1.5, py: 1,
        borderRadius: "14px 14px 14px 4px",
        bgcolor: alpha(hud.accentMain, 0.1),
        border: `1px solid ${alpha(hud.accentMain, 0.28)}`,
        boxShadow: `0 2px 10px ${alpha(hud.accentMain, 0.08)}`,
      }}>
        <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 0.5, mb: 0.4 }}>
          <AutoAwesomeRoundedIcon sx={{ fontSize: 11, color: hud.accent }} />
          <Typography variant="caption" sx={{ fontSize: "0.6rem", color: hud.accent, fontWeight: 600 }}>
            AI · accepted
          </Typography>
          <Typography variant="caption" sx={{ fontSize: "0.6rem", color: hud.faint, fontVariantNumeric: "tabular-nums" }}>
            {formatClock(msg.timestamp)}
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ fontSize: "0.8125rem", lineHeight: 1.5, color: hud.hi, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {msg.text || msg.title}
        </Typography>
      </Box>
    </Stack>
  );
});

export interface HudSuggestionsTabProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  mergedConversationTimeline: TimelineRow[];
  latestMessageSuggestions: PromptSuggestion[];
  suggestionsLoading: boolean;
  rejectingIds: Set<string>;
  onPromptAccept: (prompt: PromptSuggestion) => void;
  onPromptReject: (id: string) => void;
}

export function HudSuggestionsTab({
  scrollRef,
  mergedConversationTimeline,
  latestMessageSuggestions,
  suggestionsLoading,
  rejectingIds,
  onPromptAccept,
  onPromptReject,
}: HudSuggestionsTabProps) {
  const theme = useTheme();
  const hud = useMemo(() => getFloatingHudTokens(theme), [theme]);

  const intervieweeLineIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of mergedConversationTimeline) {
      if (row.kind === "transcript" && isIntervieweeSpeaker(row.item.speakerId)) {
        ids.add(row.item.id);
      }
    }
    return ids;
  }, [mergedConversationTimeline]);

  const isEmpty = !mergedConversationTimeline.length && !latestMessageSuggestions.length && !suggestionsLoading;

  return (
    <Box
      ref={scrollRef}
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        px: 1.5,
        py: 1.5,
        color: hud.hi,
        scrollbarWidth: "thin",
        scrollbarColor: `${alpha(theme.palette.common.white, 0.1)} transparent`,
        "&::-webkit-scrollbar": { width: 4 },
        "&::-webkit-scrollbar-track": { background: "transparent" },
        "&::-webkit-scrollbar-thumb": { background: alpha(theme.palette.common.white, 0.12), borderRadius: 4 },
      }}
    >
      {isEmpty ? (
        <Box sx={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100%", gap: 1.25, py: 4,
        }}>
          <AutoAwesomeRoundedIcon sx={{ fontSize: 26, color: alpha(AI_VIOLET, 0.65) }} />
          <Typography variant="body2" sx={{ color: hud.faint, fontSize: "0.8rem", textAlign: "center", lineHeight: 1.55, maxWidth: "78%" }}>
            Prep tips refresh when you speak on the mic. Call audio adds context from the conversation; suggestions help you tighten answers and stay ready for what might come next.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5} sx={{ width: "100%", minWidth: 0, alignItems: "stretch" }}>
          {mergedConversationTimeline.map((entry) => {
            if (entry.kind === "accepted") {
              return <AcceptedMessageBubble key={entry.id} msg={entry.msg} hud={hud} theme={theme} />;
            }
            if (entry.kind === "pending") {
              const pendingItem: TranscriptItem = {
                id: entry.msg.id,
                text: entry.msg.text,
                timestamp: entry.msg.timestamp,
                speakerId: entry.msg.speakerId,
                formattedTime: formatClock(entry.msg.timestamp),
              };
              return <TranscriptBubble key={entry.id} item={pendingItem} isMe hud={hud} theme={theme} />;
            }
            const item = entry.item;
            // Interviewee ids (mic / you) share one lane — align right; interviewer/system left.
            const isMe = isIntervieweeSpeaker(item.speakerId);
            return <TranscriptBubble key={entry.id} item={item} isMe={isMe} hud={hud} theme={theme} />;
          })}

          {latestMessageSuggestions.length > 0 && (
            <Stack sx={{ gap: 1, pt: 0.25 }}>
              <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 0.75, px: 0.25 }}>
                <Box sx={{ flex: 1, height: "1px", bgcolor: alpha(theme.palette.common.white, 0.07) }} />
                <Typography variant="caption" sx={{
                  color: hud.faint, letterSpacing: "0.06em",
                  textTransform: "uppercase", fontWeight: 600, fontSize: "0.6rem",
                }}>
                  AI & feed
                </Typography>
                <Box sx={{ flex: 1, height: "1px", bgcolor: alpha(theme.palette.common.white, 0.07) }} />
              </Stack>
              {latestMessageSuggestions.map((prompt) => {
                const anchoredToInterviewee =
                  intervieweeLineIds.size > 0 &&
                  (prompt.transcriptIds ?? []).some((id) => intervieweeLineIds.has(id));
                return (
                  <SuggestionCard
                    key={`prompt-${prompt.id}`}
                    prompt={prompt}
                    isRejecting={rejectingIds.has(prompt.id)}
                    onAccept={onPromptAccept}
                    onReject={onPromptReject}
                    hud={hud}
                    theme={theme}
                    anchoredToIntervieweeMic={anchoredToInterviewee}
                  />
                );
              })}
            </Stack>
          )}

          {suggestionsLoading && (
            <Stack sx={{ alignItems: "flex-start", pt: 0.5 }}>
              <Box sx={{
                px: 1.5, py: 0.75,
                borderRadius: "14px 14px 14px 4px",
                border: `1px solid ${alpha(AI_VIOLET, 0.38)}`,
                bgcolor: alpha(AI_VIOLET, 0.1),
                boxShadow: `0 0 20px ${alpha(AI_VIOLET, 0.12)}`,
              }}>
                <TypingDots color={alpha(AI_VIOLET, 0.85)} />
              </Box>
              <Typography variant="caption" sx={{ color: hud.faint, mt: 0.5, ml: 0.25, fontSize: "0.6rem" }}>
                Generating AI follow-ups…
              </Typography>
            </Stack>
          )}
        </Stack>
      )}
    </Box>
  );
}
