import { FC, useMemo, useState } from "react";
import { Box, Button, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useOrefAlertUi } from "../../contexts/OrefAlertUiContext";
import { tactical } from "../../theme";

export const AlertFeed: FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const {
    connected,
    alerts,
    blinking,
    soundEnabled,
    ready,
    testAlert,
    clearAlerts,
    enableSound,
    disableSound,
    unlockSound,
  } = useOrefAlertUi();

  const emptyHint = useMemo(() => {
    if (!ready) return "Initializing alert controls…";
    if (!connected) return "Link down. Alert feed unavailable.";
    return "No alerts yet. Click Test Alert or wait for live updates (connection is automatic).";
  }, [ready, connected]);

  const btnSx = {
    borderColor: tactical.hairlineStrong,
    color: tactical.phosphor,
    textTransform: "none" as const,
    fontSize: "0.7rem",
    borderRadius: "2px",
    minHeight: { xs: 44, sm: 28 },
    minWidth: { xs: 44, sm: "auto" },
    px: 1,
    "&:hover": {
      borderColor: tactical.phosphor,
      bgcolor: "rgba(197, 208, 184, 0.08)",
    },
  };

  return (
    <Box
      component="aside"
      className="ops-alert-feed"
      aria-label="OREF alert feed"
      onClickCapture={unlockSound}
      sx={{
        position: { xs: "absolute", sm: "relative" },
        left: { xs: 8, sm: "auto" },
        right: { xs: 8, sm: "auto" },
        bottom: { xs: 0, sm: "auto" },
        width: { xs: "auto", sm: "var(--alert-feed-w)" },
        minWidth: { xs: 0, sm: 240 },
        maxWidth: { xs: "none", sm: 300 },
        height: {
          xs: mobileExpanded ? "min(58dvh, 440px)" : "auto",
          sm: "100%",
        },
        maxHeight: { xs: "calc(100% - 16px)", sm: "none" },
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: "background.paper",
        borderRight: { xs: 0, sm: `1px solid ${tactical.hairline}` },
        borderTop: { xs: `1px solid ${tactical.hairlineStrong}`, sm: 0 },
        borderRadius: { xs: "6px 6px 0 0", sm: 0 },
        pb: { xs: "env(safe-area-inset-bottom)", sm: 0 },
        zIndex: 10,
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          px: 1.25,
          minHeight: { xs: 52, sm: "auto" },
          py: { xs: 0.5, sm: 1 },
          display: "flex",
          alignItems: "center",
          gap: 1,
          borderBottom:
            !isMobile || mobileExpanded
              ? `1px solid ${tactical.hairline}`
              : "none",
        }}
      >
        <Typography
          component="h2"
          sx={{
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: tactical.phosphor,
            m: 0,
            flex: 1,
          }}
        >
          OREF Alert
        </Typography>

        <Typography
          component="span"
          sx={{
            fontSize: "0.68rem",
            fontWeight: 700,
            color: connected ? tactical.statusGreen : tactical.alertRed,
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
          }}
          aria-label={connected ? "connected" : "disconnected"}
        >
          {connected ? "● connected" : "● disconnected"}
        </Typography>

        {isMobile ? (
          <Button
            size="small"
            variant="outlined"
            aria-label={
              mobileExpanded ? "Collapse alert feed" : "Expand alert feed"
            }
            aria-expanded={mobileExpanded}
            aria-controls="oref-alert-feed-content"
            onClick={() => setMobileExpanded((expanded) => !expanded)}
            sx={{ ...btnSx, px: 1.25, flexShrink: 0 }}
          >
            {mobileExpanded ? "Hide" : `Alerts ${alerts.length}`}
          </Button>
        ) : null}
      </Box>

      {!isMobile || mobileExpanded ? (
        <>
        <Box
          id="oref-alert-feed-content"
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 0.75,
            alignItems: "center",
            px: 1.25,
            py: 1,
            borderBottom: `1px solid ${tactical.hairline}`,
          }}
        >
          <Button
            size="small"
            variant="outlined"
            onClick={() => void testAlert()}
            disabled={!ready}
            sx={btnSx}
          >
            Test Alert
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={clearAlerts}
            disabled={!ready}
            sx={btnSx}
          >
            Clear
          </Button>
          <Button
            size="small"
            variant={soundEnabled ? "contained" : "outlined"}
            onClick={() => void (soundEnabled ? disableSound() : enableSound())}
            disabled={!ready}
            sx={
              soundEnabled
                ? {
                    ...btnSx,
                    bgcolor: "rgba(197, 208, 184, 0.18)",
                    border: `1px solid ${tactical.hairlineStrong}`,
                    "&:hover": {
                      bgcolor: "rgba(197, 208, 184, 0.28)",
                    },
                  }
                : btnSx
            }
          >
            {soundEnabled ? "Disable Sound" : "Enable Sound"}
          </Button>
        </Box>

      <Box
        component="ul"
        aria-live="polite"
        aria-relevant="additions"
        sx={{
          listStyle: "none",
          m: 0,
          p: 0,
          flex: 1,
          overflow: "auto",
        }}
      >
        {alerts.length === 0 ? (
          <Box component="li" sx={{ px: 1.25, py: 2 }}>
            <Typography
              sx={{
                fontSize: "0.72rem",
                color: tactical.phosphorMuted,
                lineHeight: 1.4,
              }}
            >
              {emptyHint}
            </Typography>
          </Box>
        ) : (
          alerts.map((a, index) => {
            const isNew = !!blinking[a.id];
            const time = a.time?.toLocaleTimeString?.() ?? "";
            return (
              <Box
                component="li"
                key={`${a.id}-${a.time?.getTime?.() ?? index}-${index}`}
                className={isNew ? "alert-feed-item--pulse" : undefined}
                sx={{
                  px: 1.25,
                  py: 0.9,
                  borderBottom: `1px solid ${tactical.hairline}`,
                  borderLeft: `3px solid ${
                    isNew ? tactical.alertRed : tactical.hairlineStrong
                  }`,
                  bgcolor: isNew ? "rgba(196, 75, 60, 0.12)" : "transparent",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    mb: 0.35,
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      fontSize: "0.58rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      px: 0.5,
                      py: 0.15,
                      borderRadius: "2px",
                      bgcolor: isNew ? tactical.alertRed : tactical.gunmetal,
                      color: isNew ? tactical.gunmetal : tactical.phosphor,
                    }}
                  >
                    {isNew ? "NEW" : "ALERT"}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: tactical.phosphor,
                      flex: 1,
                      lineHeight: 1.25,
                    }}
                  >
                    {a.title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.62rem",
                      color: tactical.phosphorMuted,
                    }}
                  >
                    {time}
                  </Typography>
                </Box>
                {a.desc ? (
                  <Typography
                    sx={{
                      fontSize: "0.65rem",
                      color: tactical.phosphorMuted,
                      mb: 0.35,
                    }}
                  >
                    {a.desc}
                  </Typography>
                ) : null}
                <Typography
                  sx={{
                    fontSize: "0.65rem",
                    color: tactical.phosphor,
                    lineHeight: 1.35,
                  }}
                >
                  <Box
                    component="span"
                    sx={{ color: tactical.phosphorMuted, fontWeight: 600 }}
                  >
                    Locations:{" "}
                  </Box>
                  {a.data.join(", ")}
                </Typography>
              </Box>
            );
          })
        )}
      </Box>
        </>
      ) : null}
    </Box>
  );
};
