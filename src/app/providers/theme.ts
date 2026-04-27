import { alpha, createTheme } from "@mui/material/styles";

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
