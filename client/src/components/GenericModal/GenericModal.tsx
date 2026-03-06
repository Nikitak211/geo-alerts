import { useEffect, useMemo, useState } from "react";

type ModalMode = "register" | "paymentMethod";

export function GenericModal(props: {
  open: boolean;
  mode: ModalMode;
  title?: string;
  onClose: () => void;

  // register
  onRegister?: (email: string, password: string) => Promise<void>;

  // payment method
  onAddPaymentMethod?: (label: string) => Promise<void>;
  onPaymentMethodAdded?: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [label, setLabel] = useState("");

  const title = useMemo(() => {
    if (props.title) return props.title;
    return props.mode === "register" ? "Register" : "Add payment method";
  }, [props.mode, props.title]);

  useEffect(() => {
    if (!props.open) return;

    setErr(null);
    setBusy(false);

    if (props.mode === "register") {
      setEmail("");
      setPassword("");
    }

    if (props.mode === "paymentMethod") {
      setLabel("");
    }
  }, [props.open, props.mode]);

  if (!props.open) return null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          width: 380,
          maxWidth: "100%",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #ddd",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          padding: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 800 }}>{title}</div>
          <button onClick={props.onClose} style={{ marginLeft: "auto" }}>
            ✕
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          {props.mode === "register" ? (
            <>
              <label
                style={{ display: "block", fontSize: 12, marginBottom: 4 }}
              >
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", padding: "8px 10px" }}
                placeholder="email"
              />

              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  marginTop: 10,
                  marginBottom: 4,
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", padding: "8px 10px" }}
                placeholder="password"
              />

              <button
                disabled={busy}
                style={{
                  width: "100%",
                  marginTop: 12,
                  padding: "10px 12px",
                  fontWeight: 700,
                }}
                onClick={async () => {
                  setErr(null);
                  setBusy(true);

                  try {
                    if (!props.onRegister) {
                      throw new Error("Register handler missing");
                    }

                    if (!email.trim()) {
                      throw new Error("Missing email");
                    }

                    if (password.length < 4) {
                      throw new Error("Password too short");
                    }

                    await props.onRegister(email.trim(), password);
                    props.onClose();
                  } catch (e: any) {
                    setErr(e?.message ?? "Failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Register
              </button>
            </>
          ) : (
            <>
              <label
                style={{ display: "block", fontSize: 12, marginBottom: 4 }}
              >
                Label
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                style={{ width: "100%", padding: "8px 10px" }}
                placeholder='e.g. "Visa **** 4242"'
              />

              <button
                disabled={busy}
                style={{
                  width: "100%",
                  marginTop: 12,
                  padding: "10px 12px",
                  fontWeight: 700,
                }}
                onClick={async () => {
                  setErr(null);
                  setBusy(true);

                  try {
                    if (!props.onAddPaymentMethod) {
                      throw new Error("Payment handler missing");
                    }

                    if (!label.trim()) {
                      throw new Error("Missing label");
                    }

                    await props.onAddPaymentMethod(label.trim());
                    await props.onPaymentMethodAdded?.();
                    props.onClose();
                  } catch (e: any) {
                    setErr(e?.message ?? "Failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Add payment method
              </button>
            </>
          )}

          {err && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#b00" }}>
              {err}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
