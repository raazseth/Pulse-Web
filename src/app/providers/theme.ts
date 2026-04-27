import { alpha, createTheme } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";

export const MARKER_COLORS = {
  prompt: "#0284c7",
  tag: "#d97706",
  transcript: "#7c3aed",
  signal: "#dc2626",
} as const;

const GREY = {
  100: "#F9FAFB",
  200: "#F4F6F8",
  300: "#DFE3E8",
  400: "#C4CDD5",
  500: "#919EAB",
  600: "#637381",
  700: "#454F5B",
  800: "#212B36",
  900: "#161C24",
};

export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#149F77",
      light: "#1DBF8F",
      dark: "#0E7A5C",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#373D41",
      light: "#4E555A",
      dark: "#22272A",
      contrastText: "#FFFFFF",
    },
    grey: GREY,
    background: {
      default: "#F4F6F8",
      paper: "#FFFFFF",
    },
    divider: alpha(GREY[500], 0.24),
    text: {
      primary: GREY[800],
      secondary: GREY[600],
      disabled: GREY[500],
    },
    action: {
      hover: alpha(GREY[500], 0.08),
      selected: alpha(GREY[500], 0.16),
      disabled: alpha(GREY[500], 0.8),
      disabledBackground: alpha(GREY[500], 0.24),
      focus: alpha(GREY[500], 0.24),
      hoverOpacity: 0.08,
      selectedOpacity: 0.16,
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '"Public Sans", "Segoe UI", sans-serif',
    h4: { fontWeight: 700, lineHeight: 1.5 },
    h6: { fontWeight: 700, lineHeight: 1.6 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    body1: { lineHeight: 1.6 },
    body2: { lineHeight: 1.57 },
    caption: { lineHeight: 1.5 },
    overline: {
      fontWeight: 700,
      letterSpacing: "0.08em",
      fontSize: "0.625rem",
      lineHeight: 2.5,
    },
    button: { fontWeight: 700, textTransform: "none" },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 700,
          textTransform: "none",
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundImage: "none",
          boxShadow: `0 0 2px 0 ${alpha(GREY[500], 0.2)}, 0 12px 24px -4px ${alpha(GREY[500], 0.12)}`,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 700 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8 },
        notchedOutline: { borderColor: alpha(GREY[500], 0.32) },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: "transparent", backgroundImage: "none" },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          backgroundImage: "none",
          backgroundColor: "#FFFFFF",
          borderBottom: `1px solid ${alpha(GREY[500], 0.16)}`,
          color: GREY[800],
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: GREY[800], fontSize: "0.75rem", color: "#FFFFFF" },
        arrow: { color: GREY[800] },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${alpha(GREY[500], 0.16)}` },
        head: {
          color: GREY[600],
          backgroundColor: GREY[200],
          fontWeight: 600,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { borderRadius: 6 },
      },
    },
  },
});

export type FloatingHudOvVariant = "teal" | "red" | "violet" | "ghost";

export type FloatingHudOvColors = {
  bg: string;
  bgH: string;
  color: string;
  colorH: string;
  ring: string;
};

export function getFloatingHudOvVariants(theme: Theme): Record<FloatingHudOvVariant, FloatingHudOvColors> {
  const W = theme.palette.common.white;
  const p = theme.palette.primary;
  const e = theme.palette.error;
  const spot = MARKER_COLORS.transcript;
  return {
    teal: {
      bg: alpha(p.main, 0.2),
      bgH: alpha(p.main, 0.34),
      color: p.light,
      colorH: W,
      ring: alpha(p.main, 0.55),
    },
    red: {
      bg: alpha(e.main, 0.22),
      bgH: alpha(e.main, 0.36),
      color: e.light,
      colorH: W,
      ring: alpha(e.main, 0.55),
    },
    violet: {
      bg: alpha(spot, 0.25),
      bgH: alpha(spot, 0.4),
      color: alpha(W, 0.92),
      colorH: W,
      ring: alpha(spot, 0.5),
    },
    ghost: {
      bg: alpha(W, 0.08),
      bgH: alpha(e.main, 0.22),
      color: alpha(W, 0.42),
      colorH: e.light,
      ring: alpha(W, 0.32),
    },
  };
}

export function getFloatingHudTokens(theme: Theme) {
  const W = theme.palette.common.white;
  const B = theme.palette.common.black;
  const g = theme.palette.grey;
  const p = theme.palette.primary;
  return {
    hi: alpha(W, 0.94),
    mid: alpha(W, 0.72),
    low: alpha(W, 0.52),
    faint: alpha(W, 0.38),
    border: alpha(W, 0.14),
    borderStrong: alpha(W, 0.22),
    field: alpha(W, 0.08),
    fieldHover: alpha(W, 0.12),
    card: alpha(W, 0.06),
    insetShine: alpha(W, 0.04),
    chipMutedBg: alpha(W, 0.04),
    accent: p.light,
    accentMain: p.main,
    contrastOnAccent: p.contrastText,
    chipFilledHover: p.dark,
    glassBg: alpha(g[900], 0.88),
    glassBorder: alpha(W, 0.14),
    chrome: alpha(B, 0.38),
    chromeSoft: alpha(B, 0.32),
    chromeDeep: alpha(B, 0.42),
    hoverWash: alpha(W, 0.08),
    hoverChrome: alpha(W, 0.06),
    railBg: alpha(W, 0.08),
    embedShadow: `0 24px 64px ${alpha(g[900], 0.52)}, inset 0 0 0 1px ${alpha(W, 0.06)}`,
    sendBg: alpha(p.main, 0.22),
    sendBgHover: alpha(p.main, 0.34),
    sendBorder: alpha(p.main, 0.45),
    lineDivider: alpha(W, 0.06),
    dimTrack: alpha(W, 0.05),
    dimTextMuted: alpha(W, 0.22),
  };
}

export type FloatingHudTokens = ReturnType<typeof getFloatingHudTokens>;
