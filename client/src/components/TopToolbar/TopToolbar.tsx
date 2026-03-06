import { useEffect, useMemo, useRef, useState } from "react";
import { PaymentMethod, User } from "../../types";

type MenuItem = { key: string; label: string; disabled?: boolean };

export function TopToolbar(props: {
  user: User | null;
  paymentMethods: PaymentMethod[];
  selectedPaymentMethodId: string | null;
  onSelectPaymentMethod: (id: string) => void;

  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;

  onOpenRegister: () => void;
  onOpenAddPaymentMethod: () => void;
  onOpenBets: () => void;

  onLoadBalance: (paymentMethodId: string) => Promise<void>;
}) {
  const { user } = props;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const menuItems: MenuItem[] = useMemo(
    () => [
      { key: "bets", label: "View bets", disabled: !user },
      { key: "pay", label: "Settings: Payment method", disabled: !user },
    ],
    [user],
  );

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(e.target as any)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const balanceText = user
    ? `Balance: ${Number(user.balance ?? 0).toFixed(2)}`
    : "";

  return (
    <div
      style={{
        height: 56,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 12px",
        borderBottom: "1px solid #ddd",
        background: "#22242a",
        color: "#EAEAEAEA",
      }}
    >
      <div style={{ fontWeight: 800 }}>Cesium Bets</div>

      {user ? (
        <div style={{ fontSize: 13, color: "#333" }}>{balanceText}</div>
      ) : null}

      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {user ? (
          <>
            <span style={{ fontSize: 13 }}>Logged in: {user.email}</span>

            <select
              value={props.selectedPaymentMethodId ?? ""}
              onChange={(e) => props.onSelectPaymentMethod(e.target.value)}
              style={{ padding: "6px 8px" }}
            >
              {props.paymentMethods.length === 0 ? (
                <option value="">No payment methods</option>
              ) : (
                props.paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.label}
                  </option>
                ))
              )}
            </select>

            <button
              disabled={!props.selectedPaymentMethodId}
              onClick={() =>
                props.selectedPaymentMethodId &&
                props.onLoadBalance(props.selectedPaymentMethodId)
              }
              style={{
                padding: "6px 10px",
                fontWeight: 700,
              }}
            >
              Load Balance
            </button>

            {/* Hamburger */}
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setMenuOpen((s) => !s)}
                style={{ padding: "6px 10px" }}
                aria-label="menu"
              >
                ☰
              </button>

              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "110%",
                    width: 220,
                    background: "white",
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                    padding: 6,
                    zIndex: 9999,
                  }}
                >
                  {menuItems.map((it) => (
                    <button
                      key={it.key}
                      disabled={it.disabled}
                      onClick={() => {
                        setMenuOpen(false);
                        if (it.key === "bets") props.onOpenBets();
                        if (it.key === "pay") props.onOpenAddPaymentMethod();
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 10px",
                        borderRadius: 8,
                        border: "none",
                        background: "transparent",
                        opacity: it.disabled ? 0.5 : 1,
                        cursor: it.disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      {it.label}
                    </button>
                  ))}

                  <div
                    style={{ height: 1, background: "#eee", margin: "6px 0" }}
                  />

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      props.onLogout();
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 10px",
                      borderRadius: 8,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <input
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: "6px 8px" }}
            />
            <input
              placeholder="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: "6px 8px" }}
            />
            <button
              onClick={() => props.onLogin(email, password)}
              style={{ padding: "6px 10px" }}
            >
              Login
            </button>

            <button
              onClick={() => props.onOpenRegister()}
              style={{ padding: "6px 10px" }}
            >
              Register
            </button>
          </>
        )}
      </div>
    </div>
  );
}
