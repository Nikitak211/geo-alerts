import { FC, useEffect, useState } from "react";
import { Box, Link, Typography } from "@mui/material";
import { visuallyHidden } from "@mui/utils";
import { StatusStrip } from "./components/StatusStrip/StatusStrip";
import { AlertFeed } from "./components/AlertFeed/AlertFeed";
import { getApiBase } from "./utils/helper";
import { MainMap } from "./components/MainMap/MainMap";
import { useSignalRConnection } from "./contexts/SignalRConnectionContext";
import { useOrefAlerts } from "./features/oref/hooks/useOrefAlerts";
import { OrefAlertUiProvider } from "./contexts/OrefAlertUiContext";
import { NewsStatusNotice } from "./features/news/components/NewsStatusNotice";

/** Toolbar visibility: from runtime /api/config (Docker) or build-time REACT_APP_ACTIVE_TOOLBAR (local dev). */
function useActiveToolbar(): boolean {
  const [active, setActive] = useState(() =>
    !!process.env?.REACT_APP_ACTIVE_TOOLBAR
  );
  useEffect(() => {
    const base = getApiBase();
    fetch(`${base}/api/config`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && typeof data.activeToolbar === "boolean")
          setActive(data.activeToolbar);
      })
      .catch(() => {});
  }, []);
  return active;
}

export const Main: FC = () => {
  const showToolbar = useActiveToolbar();

  const signalR = useSignalRConnection();
  const { lastUpdate, connected: orefConnected } = useOrefAlerts();
  const [lastPollAt, setLastPollAt] = useState<Date | null>(null);

  useEffect(() => {
    if (lastUpdate?.id != null) {
      setLastPollAt(new Date());
    }
  }, [lastUpdate?.id]);

  const alertCount = lastUpdate?.data?.length ?? 0;

  return (
    <Box
      sx={{
        height: "100vh",
        "@supports (height: 100dvh)": {
          height: "100dvh",
        },
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
        overflow: "hidden",
      }}
    >
      {showToolbar ? (
        <StatusStrip
          connectionState={signalR?.connectionState ?? null}
          connected={orefConnected}
          alertCount={alertCount}
          lastPollAt={lastPollAt}
        />
      ) : null}

      <OrefAlertUiProvider>
      <Box
        component="main"
        id="main-content"
        sx={{
          position: "relative",
          flex: 1,
          display: "flex",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <Typography component="h1" sx={visuallyHidden}>Geo Alerts – live Home Front Command alert map</Typography>
        <AlertFeed />

        <Box role="region" aria-label="Alert map" sx={{ position: "relative", flex: 1, minWidth: 0, minHeight: 0 }}>
          <MainMap toolbarVisible={showToolbar} />
          <Box
            component="nav"
            aria-label="Site information"
            sx={{ position: "absolute", left: 8, bottom: { xs: "calc(64px + env(safe-area-inset-bottom))", sm: 32 }, zIndex: 11, display: "flex", gap: 0.5, flexWrap: "wrap", "& a": { px: 1, py: 0.5, borderRadius: 1, bgcolor: "rgba(26,29,26,0.9)", color: "#e6ecdf", fontSize: 13 } }}
          >
            <Link href="/accessibility" underline="always"><span lang="he">נגישות</span> · Accessibility</Link>
            <Link href="/privacy" underline="always">Privacy</Link>
            <Link href="/terms" underline="always">Terms</Link>
          </Box>
          <NewsStatusNotice />
        </Box>
      </Box>
      </OrefAlertUiProvider>
    </Box>
  );
};
