import { FC, memo, useState } from "react";
import { BetFormValues } from "../../types";

const isValidHHMM = (v: string) => /^\d{2}:\d{2}$/.test(v);

export const BetDrawer: FC<{
  areaHeb: string;
  form: BetFormValues;
  setForm: React.Dispatch<React.SetStateAction<BetFormValues>>;
  disabled: boolean;
  loginRequired: boolean;
  paymentRequired: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}> = memo((props) => {
  const { form, setForm } = props;
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const timeInvalid = !isValidHHMM(form.predictedTime);

  return (
    <div
      style={{
        position: "absolute",
        right: 12,
        top: 12,
        width: 320,
        border: "1px solid #ddd",
        borderRadius: 10,
        background: "white",
        padding: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Bet on area</div>
        <button onClick={props.onClose} style={{ marginLeft: "auto" }}>
          ✕
        </button>
      </div>

      <div style={{ marginTop: 6, fontSize: 13 }}>
        <div>
          <b>MUN_HEB:</b> {props.areaHeb}
        </div>
      </div>

      <hr style={{ margin: "10px 0" }} />

      <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
        Date
      </label>
      <input
        type="date"
        value={form.date}
        onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
        style={{ width: "100%", padding: "8px 10px" }}
      />

      <label
        style={{
          display: "block",
          fontSize: 12,
          marginTop: 10,
          marginBottom: 4,
        }}
      >
        Time (HH:MM)
      </label>
      <input
        type="time"
        step={60} // minutes only (no seconds)
        value={form.predictedTime}
        onChange={(e) =>
          setForm((f) => ({ ...f, predictedTime: e.target.value }))
        }
        style={{ width: "100%", padding: "8px 10px" }}
      />
      {timeInvalid && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#b00" }}>
          Please enter time in HH:MM format.
        </div>
      )}

      <label
        style={{
          display: "block",
          fontSize: 12,
          marginTop: 10,
          marginBottom: 4,
        }}
      >
        Amount
      </label>
      <input
        type="number"
        min={1}
        step={1}
        value={form.amount}
        onChange={(e) =>
          setForm((f) => ({ ...f, amount: Number(e.target.value) }))
        }
        style={{ width: "100%", padding: "8px 10px" }}
      />

      {props.loginRequired && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#b00" }}>
          Login required to place a bet.
        </div>
      )}
      {props.paymentRequired && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#b00" }}>
          Select a payment method to place a bet.
        </div>
      )}

      {err && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#b00" }}>{err}</div>
      )}

      <button
        disabled={props.disabled || busy || timeInvalid}
        onClick={async () => {
          setErr(null);
          setBusy(true);
          try {
            await props.onSubmit();
          } catch (e: any) {
            setErr(e?.message ?? "Failed");
          } finally {
            setBusy(false);
          }
        }}
        style={{
          width: "100%",
          marginTop: 12,
          padding: "10px 12px",
          fontWeight: 700,
        }}
      >
        Place Bet
      </button>
    </div>
  );
});

BetDrawer.displayName = "BetDrawer";
