import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { HubConnectionState } from "@microsoft/signalr";
import { tactical } from "../../theme";

function formatClock(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function connectionLabel(state: HubConnectionState | null, connected: boolean): string {
  if (state === HubConnectionState.Connected || (state == null && connected)) {
    return "LINK UP";
  }
  if (state === HubConnectionState.Reconnecting) return "RECONNECTING";
  if (state === HubConnectionState.Connecting) return "CONNECTING";
  return "LINK DOWN";
}

function connectionTone(
  state: HubConnectionState | null,
  connected: boolean,
): "up" | "warn" | "down" {
  if (state === HubConnectionState.Connected || (state == null && connected)) {
    return "up";
  }
  if (
    state === HubConnectionState.Reconnecting ||
    state === HubConnectionState.Connecting
  ) {
    return "warn";
  }
  return "down";
}

export function StatusStrip(props: {
  /** SignalR / OREF link */
  connectionState?: HubConnectionState | null;
  connected?: boolean;
  alertCount?: number;
  lastPollAt?: Date | null;
}) {
  const {
    connected = false,
    connectionState = null,
    alertCount = 0,
    lastPollAt = null,
  } = props;

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const tone = connectionTone(connectionState, connected);
  const linkLabel = connectionLabel(connectionState, connected);
  const dotColor =
    tone === "up"
      ? tactical.statusGreen
      : tone === "warn"
        ? tactical.amber
        : tactical.alertRed;
  const reconnecting = tone === "warn";

  const lastPollText = lastPollAt
    ? lastPollAt.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "—";

  return (
    <Box
      component="header"
      role="banner"
      aria-label="Operations status strip"
      sx={{
        height: "var(--status-strip-h)",
        minHeight: "var(--status-strip-h)",
        display: "flex",
        alignItems: "center",
        gap: { xs: 0.75, sm: 1.5 },
        px: { xs: 0.75, sm: 1.25 },
        bgcolor: "background.paper",
        borderBottom: `1px solid ${tactical.hairline}`,
        color: "text.primary",
        zIndex: 20,
        flexShrink: 0,
      }}
    >
      <Typography
        component="span"
        sx={{
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: tactical.phosphor,
          whiteSpace: "nowrap",
          display: { xs: "none", sm: "inline" },
        }}
      >
        GEO OPS
      </Typography>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 1,
          py: 0.25,
          border: `1px solid ${tactical.hairline}`,
          borderRadius: "2px",
        }}
        aria-live="polite"
        aria-label={`Connection status: ${linkLabel}`}
      >
        <Box
          component="span"
          className={reconnecting ? "conn-dot--reconnecting" : undefined}
          aria-hidden
          sx={{
            width: 8,
            height: 8,
            borderRadius: "1px",
            bgcolor: dotColor,
            flexShrink: 0,
          }}
        />
        <Typography
          component="span"
          sx={{
            fontSize: "0.68rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: dotColor,
          }}
        >
          {linkLabel}
        </Typography>
      </Box>

      <Typography
        component="span"
        aria-label={`Active alerts: ${alertCount}`}
        sx={{
          fontSize: "0.68rem",
          letterSpacing: "0.04em",
          color: alertCount > 0 ? tactical.alertRed : tactical.phosphorMuted,
          whiteSpace: "nowrap",
        }}
      >
        ALERTS{" "}
        <Box component="strong" sx={{ color: alertCount > 0 ? tactical.alertRed : tactical.phosphor }}>
          {alertCount}
        </Box>
      </Typography>

      <Typography
        component="span"
        aria-label={`Last poll: ${lastPollText}`}
        sx={{
          fontSize: "0.68rem",
          letterSpacing: "0.04em",
          color: tactical.phosphorMuted,
          whiteSpace: "nowrap",
          display: { xs: "none", md: "inline" },
        }}
      >
        LAST POLL {lastPollText}
      </Typography>

      <Box sx={{ flexGrow: 1 }} />

      <Typography
        component="time"
        dateTime={now.toISOString()}
        aria-label={`Local time ${formatClock(now)}`}
        sx={{
          fontSize: "0.75rem",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.04em",
          color: tactical.phosphor,
          whiteSpace: "nowrap",
          display: { xs: "none", sm: "inline" },
        }}
      >
        {formatClock(now)}
      </Typography>

    </Box>
  );
}
