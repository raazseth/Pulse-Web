import { PropsWithChildren } from "react";
import { alpha, Paper, PaperProps } from "@mui/material";

export function GlassPanel({ children, sx, ...rest }: PropsWithChildren<PaperProps>) {
  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: "16px",
        bgcolor: "background.paper",
        border: (theme) => `1px solid ${alpha(theme.palette.grey[500], 0.12)}`,
        boxShadow: (theme) =>
          `0 1px 2px 0 ${alpha(theme.palette.grey[500], 0.06)}, 0 4px 16px -2px ${alpha(theme.palette.grey[500], 0.08)}`,
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Paper>
  );
}
