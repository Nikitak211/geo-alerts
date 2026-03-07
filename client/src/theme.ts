import { createTheme } from "@mui/material/styles";

const APP_BACKGROUND = "#22242a";
const APP_TEXT = "#EAEAEA";

export const appTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: APP_BACKGROUND,
      contrastText: APP_TEXT,
    },
    background: {
      default: APP_BACKGROUND,
      paper: "#2d2f36",
    },
    text: {
      primary: APP_TEXT,
      secondary: "rgba(234, 234, 234, 0.7)",
    },
    divider: "rgba(255, 255, 255, 0.12)",
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(255, 255, 255, 0.12)",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderLeft: "1px solid rgba(255, 255, 255, 0.12)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
        },
      },
    },
  },
});
