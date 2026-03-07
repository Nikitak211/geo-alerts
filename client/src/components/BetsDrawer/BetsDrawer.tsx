import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Drawer,
  IconButton,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Chip,
} from "@mui/material";
import type { Bet, BetStatus } from "../../types";

const TABS: { key: BetStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "In progress" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

const formatBetDate = (value: string | Date) => {
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return value.slice(0, 10);
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
};

const normalizeStatus = (status: string): BetStatus | "void" => {
  if (
    status === "open" ||
    status === "won" ||
    status === "lost" ||
    status === "void"
  ) {
    return status;
  }
  return "open";
};

const statusColor = (
  status: string
): "default" | "primary" | "success" | "error" | "warning" => {
  switch (status) {
    case "won":
      return "success";
    case "lost":
      return "error";
    case "open":
      return "primary";
    default:
      return "default";
  }
};

export function BetsDrawer(props: {
  open: boolean;
  bets: Bet[] | null | undefined;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [tab, setTab] = useState<BetStatus | "all">("all");
  const [busy, setBusy] = useState(false);

  const safeBets = useMemo(() => {
    return Array.isArray(props.bets) ? props.bets : [];
  }, [props.bets]);

  const filtered = useMemo(() => {
    if (tab === "all") return safeBets;
    return safeBets.filter((b) => normalizeStatus(String(b.status)) === tab);
  }, [safeBets, tab]);

  return (
    <Drawer
      anchor="right"
      open={props.open}
      onClose={props.onClose}
      slotProps={{
        backdrop: {
          sx: { backgroundColor: "rgba(0,0,0,0.4)" },
        },
      }}
      PaperProps={{
        sx: {
          width: { xs: "92vw", sm: 420 },
          maxWidth: 420,
          bgcolor: "#22242a",
        },
      }}
    >
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          px={2}
          py={1.5}
          borderBottom={1}
          borderColor="divider"
        >
          <Typography variant="h6" fontWeight={700}>
            Bets
          </Typography>
          <IconButton
            onClick={props.onClose}
            aria-label="close"
            size="small"
            sx={{ color: "#EAEAEA" }}
          >
            ✕
          </IconButton>
        </Box>

        <Box
          display="flex"
          alignItems="center"
          gap={1}
          flexWrap="wrap"
          px={2}
          py={1.5}
          borderBottom={1}
          borderColor="divider"
        >
          <ToggleButtonGroup
            value={tab}
            exclusive
            onChange={(_, v) => v != null && setTab(v)}
            size="small"
            sx={{ flex: 1, flexWrap: "wrap" }}
          >
            {TABS.map((t) => (
              <ToggleButton key={t.key} value={t.key}>
                {t.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Button
            size="small"
            disabled={busy}
            sx={{ color: "#EAEAEA" }}
            onClick={async () => {
              setBusy(true);
              try {
                await props.onRefresh();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Refreshing…" : "Refresh"}
          </Button>
        </Box>

        <Box sx={{ flex: 1, overflow: "auto", px: 2, py: 2 }}>
          {filtered.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No bets.
            </Typography>
          ) : (
            filtered.map((b) => (
              <Paper
                key={String(b.id)}
                variant="outlined"
                sx={{
                  p: 1.5,
                  mb: 1.5,
                  borderColor: "divider",
                }}
              >
                <Box
                  display="flex"
                  alignItems="center"
                  gap={1}
                  flexWrap="wrap"
                  mb={1}
                >
                  <Typography variant="subtitle2" fontWeight={700}>
                    {b.area_heb ?? "-"}
                  </Typography>
                  {b.allow_minute_proximity && (
                    <Chip
                      label="±10 min"
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: "0.7rem",
                        fontWeight: 600,
                      }}
                      title="Minute proximity (±10 min) enabled"
                    />
                  )}
                  <Chip
                    label={String(b.status ?? "-")}
                    size="small"
                    color={statusColor(String(b.status))}
                    sx={{ marginLeft: "auto" }}
                  />
                </Box>

                <Typography variant="body2" color="text.secondary">
                  <strong>Date:</strong> {formatBetDate(b.bet_date) ?? "-"}{" "}
                  <strong>Time:</strong> {b.predicted_time ?? "-"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Stake:</strong> {b.amount ?? 0}
                  {b.status === "won" && (
                    <>
                      {" "}
                      · <strong>Payout:</strong> {b.payout_amount ?? 0}
                    </>
                  )}
                </Typography>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  sx={{ mt: 0.5 }}
                >
                  <strong>Placed:</strong> {formatDateTime(b.placed_at)}
                </Typography>

                {b.settled_alert_time && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                  >
                    <strong>Settled:</strong>{" "}
                    {formatDateTime(b.settled_alert_time)}
                  </Typography>
                )}
              </Paper>
            ))
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
