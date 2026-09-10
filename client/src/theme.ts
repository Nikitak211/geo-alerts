import { createTheme } from "@mui/material/styles";

/** Tactical ops-center palette */
export const tactical = {
  gunmetal: "#1a1d1a",
  panel: "#242824",
  olive: "#6b7c3a",
  statusGreen: "#9aaa65",
  alertRed: "#c44b3c",
  amber: "#c9a227",
  phosphor: "#c5d0b8",
  phosphorMuted: "rgba(197, 208, 184, 0.65)",
  hairline: "rgba(197, 208, 184, 0.18)",
  hairlineStrong: "rgba(197, 208, 184, 0.32)",
} as const;

export const appTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: tactical.olive,
      contrastText: tactical.phosphor,
    },
    secondary: {
      main: tactical.amber,
      contrastText: tactical.gunmetal,
    },
    error: {
      main: tactical.alertRed,
      contrastText: tactical.phosphor,
    },
    warning: {
      main: tactical.amber,
      contrastText: tactical.gunmetal,
    },
    background: {
      default: tactical.gunmetal,
      paper: tactical.panel,
    },
    text: {
      primary: tactical.phosphor,
      secondary: tactical.phosphorMuted,
    },
    divider: tactical.hairline,
    success: {
      main: tactical.olive,
      contrastText: tactical.phosphor,
    },
  },
  shape: {
    borderRadius: 3,
  },
  typography: {
    fontFamily:
      '"IBM Plex Mono", "Roboto Mono", "Consolas", "Courier New", monospace',
    h6: {
      fontSize: "0.95rem",
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
    },
    subtitle1: {
      fontSize: "0.85rem",
      fontWeight: 600,
      letterSpacing: "0.03em",
    },
    subtitle2: {
      fontSize: "0.75rem",
      fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
    },
    body1: {
      fontSize: "0.875rem",
    },
    body2: {
      fontSize: "0.8rem",
    },
    caption: {
      fontSize: "0.7rem",
      letterSpacing: "0.03em",
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
      letterSpacing: "0.02em",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: tactical.gunmetal,
          color: tactical.phosphor,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: tactical.panel,
          border: `1px solid ${tactical.hairline}`,
          borderRadius: 3,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: tactical.panel,
          borderLeft: `1px solid ${tactical.hairline}`,
          backgroundImage: "none",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: tactical.panel,
          color: tactical.phosphor,
          boxShadow: "none",
          borderBottom: `1px solid ${tactical.hairline}`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 3,
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
        },
        contained: {
          backgroundColor: tactical.olive,
          color: tactical.phosphor,
          "&:hover": { backgroundColor: "#7a8c45" },
          "&.Mui-disabled": {
            backgroundColor: "rgba(107, 124, 58, 0.35)",
            color: tactical.phosphorMuted,
          },
        },
        outlined: {
          borderColor: tactical.hairlineStrong,
          color: tactical.phosphor,
          "&:hover": {
            borderColor: tactical.phosphor,
            backgroundColor: "rgba(197, 208, 184, 0.06)",
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 3,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: tactical.hairlineStrong,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: tactical.phosphorMuted,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: tactical.olive,
            borderWidth: 1,
          },
        },
        input: {
          color: tactical.phosphor,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          borderColor: tactical.hairline,
          color: tactical.phosphorMuted,
          padding: "2px 8px",
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          "&.Mui-selected": {
            backgroundColor: "rgba(107, 124, 58, 0.35)",
            color: tactical.phosphor,
            borderColor: tactical.olive,
            "&:hover": {
              backgroundColor: "rgba(107, 124, 58, 0.45)",
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          height: 22,
          fontSize: "0.7rem",
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: tactical.panel,
          border: `1px solid ${tactical.hairline}`,
          borderRadius: 3,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 3,
          border: `1px solid ${tactical.hairline}`,
        },
      },
    },
  },
});
