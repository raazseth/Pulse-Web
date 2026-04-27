import { memo, useMemo } from "react";
import { alpha, Box, Chip, Stack, Typography, useTheme } from "@mui/material";
import type { TagOption, TranscriptTag } from "@/modules/tagging/types";
import { tagChipOutlinedRestSx } from "@/modules/tagging/utils/tagChipStyles";
import { TranscriptItem } from "@/modules/transcript/types";

interface TranscriptRowProps {
  isActive: boolean;
  item: TranscriptItem;
  onSelect: (id: string) => void;
  transcriptTags?: TranscriptTag[];
  availableTags?: TagOption[];
}

function tagChipProps(tag: TranscriptTag, catalog: TagOption[] | undefined) {
  const opt = catalog?.find((o) => o.id === tag.tagId);
  return {
    label: opt?.label ?? tag.tagId,
    color: (opt?.color ?? "default") as
      | "default"
      | "primary"
      | "secondary"
      | "error"
      | "info"
      | "success"
      | "warning",
  };
}

function TranscriptRowComponent({
  isActive,
  item,
  onSelect,
  transcriptTags,
  availableTags,
}: TranscriptRowProps) {
  const theme = useTheme();
  const accent = theme.palette.primary.main;

  const rowTags = useMemo(
    () => transcriptTags?.filter((t) => t.transcriptId === item.id) ?? [],
    [item.id, transcriptTags],
  );

  return (
    <Box
      id={`transcript-row-${item.id}`}
      onClick={() => onSelect(item.id)}
      sx={{
        px: 1.5,
        py: 1.25,
        borderRadius: 1,
        cursor: "pointer",
        border: `1px solid ${alpha(accent, isActive ? 0.16 : 0.04)}`,
        backgroundColor: isActive ? alpha(accent, 0.1) : "transparent",
        transition: "background-color 180ms ease, border-color 180ms ease",
      }}
    >
      <Stack direction="row" sx={{ gap: 1.5, alignItems: "flex-start" }}>
        <Box sx={{ minWidth: 88, flexShrink: 0 }}>
          <Typography variant="caption" color="primary.light" sx={{ display: "block", lineHeight: 1.4 }}>
            {item.formattedTime}
          </Typography>
          <Chip
            label={item.speakerId}
            size="small"
            variant="outlined"
            sx={{
              mt: 0.5,
              height: 24,
              maxWidth: "100%",
              "& .MuiChip-label": {
                px: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
              },
              borderColor: alpha(theme.palette.grey[500], 0.35),
              bgcolor: alpha(theme.palette.common.white, 0.45),
              fontWeight: 600,
              fontSize: "0.6875rem",
            }}
          />
        </Box>
        <Stack sx={{ flex: 1, minWidth: 0, gap: 0.75 }}>
          <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
            {item.text}
          </Typography>
          {rowTags.length > 0 ? (
            <Stack
              direction="row"
              sx={{
                flexWrap: "wrap",
                gap: 0.5,
                alignItems: "center",
                rowGap: 0.5,
              }}
            >
              {rowTags.map((tag) => {
                const { label, color } = tagChipProps(tag, availableTags);
                return (
                  <Chip
                    key={tag.id}
                    label={label}
                    size="small"
                    color={color}
                    variant="outlined"
                    sx={{
                      height: 22,
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      ...tagChipOutlinedRestSx(theme, color),
                    }}
                  />
                );
              })}
            </Stack>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}

export const TranscriptRow = memo(TranscriptRowComponent);
