import React, { useMemo, useState } from "react";
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

  if (!props.open) return null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.25)",
        zIndex: 9998,
      }}
    >
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          height: "100%",
          width: 420,
          maxWidth: "92vw",
          background: "white",
          borderLeft: "1px solid #ddd",
          padding: 12,
          boxShadow: "-10px 0 30px rgba(0,0,0,0.15)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 800 }}>Bets</div>
          <button onClick={props.onClose} style={{ marginLeft: "auto" }}>
            ✕
          </button>
        </div>

        <div
          style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #ddd",
                background: tab === t.key ? "#f2f2f2" : "white",
                fontWeight: tab === t.key ? 700 : 400,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}

          <button
            onClick={async () => {
              setBusy(true);
              try {
                await props.onRefresh();
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              marginLeft: "auto",
            }}
          >
            {busy ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div style={{ marginTop: 12, overflow: "auto", flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ fontSize: 13, color: "#666", marginTop: 10 }}>
              No bets.
            </div>
          ) : (
            filtered.map((b) => (
              <div
                key={String(b.id)}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 800 }}>{b.area_heb ?? "-"}</div>
                  <span style={{ marginLeft: "auto", fontSize: 12 }}>
                    <b>{b.status ?? "-"}</b>
                  </span>
                </div>

                <div style={{ fontSize: 13, marginTop: 6 }}>
                  <div>
                    <b>Date:</b> {formatBetDate(b.bet_date) ?? "-"} &nbsp;{" "}
                    <b>Time:</b> {b.predicted_time ?? "-"}
                  </div>
                  <div>
                    <b>Stake:</b> {b.amount ?? 0}
                    {b.status === "won" ? (
                      <>
                        {" "}
                        · <b>Payout:</b> {b.payout_amount ?? 0}
                      </>
                    ) : null}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                  <b>Placed:</b> {formatDateTime(b.placed_at)}
                </div>

                {b.settled_alert_time ? (
                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                    <b>Settled:</b> {formatDateTime(b.settled_alert_time)}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
