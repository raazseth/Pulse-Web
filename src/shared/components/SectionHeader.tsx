import { Stack, Typography } from "@mui/material";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: SectionHeaderProps) {
  return (
    <Stack spacing={0.5}>
      {eyebrow ? (
        <Typography variant="overline" color="primary.main">
          {eyebrow}
        </Typography>
      ) : null}
      <Typography variant="h6">{title}</Typography>
      {subtitle ? (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      ) : null}
    </Stack>
  );
}
