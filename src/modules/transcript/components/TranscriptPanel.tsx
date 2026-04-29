import { useEffect, useMemo, useRef } from "react";
import { Box, Chip, Divider, Stack, Typography } from "@mui/material";
import { GlassPanel } from "@/shared/components/GlassPanel";
import { SectionHeader } from "@/shared/components/SectionHeader";
import { useAutoScroll } from "@/shared/hooks/useAutoScroll";
import type { TagOption, TranscriptTag } from "@/modules/tagging/types";
import { TranscriptItem, TranscriptSignalCue, TranscriptStreamStatus } from "@/modules/transcript/types";
import { TranscriptRow } from "./TranscriptRow";

interface TranscriptPanelProps {
  activeItemId?: string;
  errorMessage?: string;
  items: TranscriptItem[];
  signals?: TranscriptSignalCue[];
  status: TranscriptStreamStatus;
  onSelect: (id: string) => void;
  transcriptTags?: TranscriptTag[];
  availableTags?: TagOption[];
}

export function TranscriptPanel({
  activeItemId,
  errorMessage,
  items,
  signals,
  status,
  onSelect,
  transcriptTags,
  availableTags,
}: TranscriptPanelProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const { isPinnedToBottom } = useAutoScroll(listRef, items.length);

  const visibleItems = useMemo(() => {
    if (!activeItemId || items.length <= 240 || isPinnedToBottom) {
      return items.slice(-240);
    }

    const selectedIndex = items.findIndex((item) => item.id === activeItemId);
    if (selectedIndex < 0) {
      return items.slice(-240);
    }

    const start = Math.max(0, selectedIndex - 120);
    return items.slice(start, start + 240);
  }, [activeItemId, isPinnedToBottom, items]);

  useEffect(() => {
    if (!activeItemId) return;
    const element = document.getElementById(`transcript-row-${activeItemId}`);
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeItemId]);

  return (
    <GlassPanel sx={{ height: { xs: "58vh", lg: "calc(100vh - 190px)" } }}>
      <Stack spacing={2} sx={{ height: "100%" }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <SectionHeader
            eyebrow="Transcript"
            title="Live speaker feed"
            subtitle="Pinned to the latest lines while the session is flowing."
          />
          <Chip
            label={status}
            color={status === "connected" ? "primary" : "default"}
            variant={status === "connected" ? "filled" : "outlined"}
          />
        </Stack>
        <Divider />
        <Box
          ref={listRef}
          sx={{
            overflowY: "auto",
            pr: 1,
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          {visibleItems.length ? (
            visibleItems.map((item) => (
              <TranscriptRow
                key={item.id}
                isActive={item.id === activeItemId}
                item={item}
                rowSignals={signals?.filter((s) => s.transcriptId === item.id)}
                onSelect={onSelect}
                transcriptTags={transcriptTags}
                availableTags={availableTags}
              />
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              Waiting for transcript events from the live socket.
            </Typography>
          )}
        </Box>
        {errorMessage ? (
          <Typography variant="caption" color="error.light">
            {errorMessage}
          </Typography>
        ) : null}
      </Stack>
    </GlassPanel>
  );
}
