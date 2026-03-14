import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { TopToolbar } from "./components/TopToolbar/TopToolbar";
import { GenericModal } from "./components/GenericModal/GenericModal";
import { BetDrawer } from "./components/BetDrawer/BetDrawer";
import { BetsDrawer } from "./components/BetsDrawer/BetsDrawer";
import { User, PaymentMethod, Bet, BetFormValues } from "./types";
import { api } from "./utils/helper";
import { isRegion } from "./utils/regionAreas";
import { MainMap } from "./components/MainMap/MainMap";
import { useSignalRConnection } from "./contexts/SignalRConnectionContext";

type SelectedArea = {
  areaHeb: string;
  entityId: string;
};

const getLocalDateInputValue = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const Main: FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"register" | "paymentMethod">(
    "register",
  );

  const [selectedArea, setSelectedArea] = useState<SelectedArea | null>(null);
  const [isBetOpen, setIsBetOpen] = useState(false);
  const [betsOpen, setBetsOpen] = useState(false);
  const [bets, setBets] = useState<Bet[]>([]);

  const [form, setForm] = useState<BetFormValues>({
    date: getLocalDateInputValue(),
    predictedTime: "",
    amount: 10,
    allowMinuteProximity: true,
  });

  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<
    string | null
  >(null);

  const [notifications, setNotifications] = useState<
    { id: number; text: string }[]
  >([]);

  const refreshBets = useCallback(async () => {
    const list = await api<Bet[]>("/api/bets");
    setBets(list);
  }, []);

  const openBets = useCallback(async () => {
    await refreshBets();
    setBetsOpen(true);
  }, [refreshBets]);

  const refreshMe = useCallback(async () => {
    const me = await api<User>("/api/me");
    setUser(me);
  }, []);

  const loadPaymentMethods = useCallback(async () => {
    const pm = await api<PaymentMethod[]>("/api/payment-methods");
    setPaymentMethods(pm);
    setSelectedPaymentMethodId((prev) => prev ?? pm[0]?.id ?? null);
  }, []);

  const handleLoadBalance = async (_paymentMethodId: string) => {
    const amount = prompt("Enter amount to deposit");

    if (!amount) return;

    await api("/api/deposit", {
      method: "POST",
      body: JSON.stringify({
        amount,
        paymentMethodId: selectedPaymentMethodId,
      }),
    });

    await refreshMe(); // reload user wallet
  };

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    (async () => {
      try {
        await refreshMe();
        await loadPaymentMethods();
      } catch (e) {
        console.error(e);
        localStorage.removeItem("userId");
        setUser(null);
        setPaymentMethods([]);
        setSelectedPaymentMethodId(null);
      }
    })();
  }, [refreshMe, loadPaymentMethods]);

  const signalR = useSignalRConnection();

  useEffect(() => {
    const connection = signalR?.connection;
    if (!connection) return;

    let mounted = true;
    const handler = (msg: any) => {
      if (!mounted) return;
      if (msg.type === "wallet_updated" && msg.payload) {
        const p = msg.payload;
        setUser((prev) => {
          if (!prev || prev.id !== p.userId) return prev;
          return {
            ...prev,
            wallet: {
              availableBalance: Number(p.availableBalance ?? 0),
              reservedBalance: Number(p.reservedBalance ?? 0),
              totalBalance:
                Number(p.availableBalance ?? 0) +
                Number(p.reservedBalance ?? 0),
            },
          };
        });

        setNotifications((prev) => [
          {
            id: Date.now(),
            text:
              p.reason === "deposit"
                ? "Deposit completed"
                : p.reason === "bet_reserve"
                  ? "Bet placed and funds reserved"
                  : "Wallet updated after settlement",
          },
          ...prev,
        ]);
      }

      if (msg.type === "bet_settlement") {
        const p = msg.payload || {};
        const area = p.areaHeb ?? p.affectedAreaKey ?? "area";
        const winners = Array.isArray(p.winners) ? p.winners.length : 0;

        setNotifications((prev) => [
          {
            id: Date.now(),
            text: `Settlement for ${area} (${winners} winner${
              winners === 1 ? "" : "s"
            })`,
          },
          ...prev,
        ]);

        refreshBets().catch(() => undefined);
      }

      if (msg.type === "bets_expired" && msg.payload) {
        const count = Number(msg.payload.count ?? 0);
        setNotifications((prev) => [
          {
            id: Date.now(),
            text:
              count > 0
                ? `${count} bet${count === 1 ? "" : "s"} expired`
                : "Some bets expired",
          },
          ...prev,
        ]);

        refreshBets().catch(() => undefined);
      }
    };

    connection.on("message", handler);
    return () => {
      mounted = false;
      connection.off("message", handler);
    };
  }, [signalR?.connection, refreshBets]);

  const effectiveAreaHeb =
    selectedArea?.areaHeb ?? form.areaHeb ?? form.name ?? "";

  const canBet = useMemo(() => {
    if (!user) return false;
    if (!selectedPaymentMethodId) return false;
    if (!effectiveAreaHeb) return false;
    if (!form.date) return false;
    if (!form.predictedTime || !/^\d{2}:\d{2}$/.test(form.predictedTime))
      return false;
    if (!Number.isFinite(form.amount) || form.amount <= 0) return false;

    return true;
  }, [user, selectedPaymentMethodId, effectiveAreaHeb, form]);

  const handleOpenPlaceBetFromToolbar = useCallback(() => {
    setSelectedArea(null);
    setForm((prev) => ({
      ...prev,
      date: getLocalDateInputValue(),
      predictedTime: "",
      amount: 10,
      allowMinuteProximity: true,
      areaHeb: "",
    }));
    setIsBetOpen(true);
  }, []);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      const res = await api<{ ok: true; user: User }>("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("userId", res.user.id);
      setUser(res.user);

      await loadPaymentMethods();
      await refreshMe();
    },
    [loadPaymentMethods, refreshMe],
  );

  const handleRegister = useCallback(
    async (email: string, password: string) => {
      const res = await api<{ ok: true; user: User }>("/api/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("userId", res.user.id);
      setUser(res.user);

      await loadPaymentMethods();
      await refreshMe();
    },
    [loadPaymentMethods, refreshMe],
  );

  const handleLogout = useCallback(async () => {
    await api("/api/logout", { method: "POST" });
    localStorage.removeItem("userId");
    setUser(null);
    setPaymentMethods([]);
    setSelectedPaymentMethodId(null);
    setSelectedArea(null);
    setIsBetOpen(false);
    setBetsOpen(false);
    setBets([]);
  }, []);

  const handleAddPaymentMethod = useCallback(
    async (label: string) => {
      await api("/api/payment-methods", {
        method: "POST",
        body: JSON.stringify({ label }),
      });

      await loadPaymentMethods();
    },
    [loadPaymentMethods],
  );

  const submitBet = useCallback(async () => {
    const areaHeb = selectedArea?.areaHeb ?? form.areaHeb ?? form.name ?? "";
    if (!areaHeb) throw new Error("Select an area");
    if (!form.date) throw new Error("Missing date");
    if (!form.predictedTime || !/^\d{2}:\d{2}$/.test(form.predictedTime)) {
      throw new Error("Time must be HH:MM");
    }
    if (!Number.isFinite(form.amount) || form.amount <= 0) {
      throw new Error("Bad amount");
    }
    if (!selectedPaymentMethodId) {
      throw new Error("Select payment method");
    }

    await api<{ ok: true; betId: string }>("/api/bets", {
      method: "POST",
      body: JSON.stringify({
        areaHeb,
        betDate: form.date,
        predictedTime: form.predictedTime,
        amount: form.amount,
        paymentMethodId: selectedPaymentMethodId,
        allowMinuteProximity: !!form.allowMinuteProximity,
        is_region: isRegion(areaHeb),
      }),
    });

    setIsBetOpen(false);
    setSelectedArea(null);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      predictedTime: "",
      amount: 10,
      allowMinuteProximity: true,
      areaHeb: "",
    });

    await refreshMe();
    await refreshBets();
  }, [form, selectedArea, selectedPaymentMethodId, refreshMe, refreshBets]);

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {process.env?.ACTIVE_TOOLBAR ? (
        <TopToolbar
          user={user}
          paymentMethods={paymentMethods}
          selectedPaymentMethodId={selectedPaymentMethodId}
          onSelectPaymentMethod={setSelectedPaymentMethodId}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onLogout={handleLogout}
          onLoadBalance={handleLoadBalance}
          onOpenRegister={() => {
            setModalMode("register");
            setModalOpen(true);
          }}
          onOpenAddPaymentMethod={() => {
            setModalMode("paymentMethod");
            setModalOpen(true);
          }}
          onOpenBets={openBets}
          onOpenPlaceBet={handleOpenPlaceBetFromToolbar}
        />
      ) : null}
      <Box sx={{ position: "relative", flex: 1 }}>
        <MainMap />

        <GenericModal
          open={modalOpen}
          mode={modalMode}
          onClose={() => setModalOpen(false)}
          onRegister={handleRegister}
          onAddPaymentMethod={handleAddPaymentMethod}
        />

        {isBetOpen && (
          <BetDrawer
            selectedArea={selectedArea}
            areaHeb={effectiveAreaHeb}
            form={form}
            setForm={setForm}
            disabled={!canBet}
            loginRequired={!user}
            paymentRequired={!!user && !selectedPaymentMethodId}
            wallet={user?.wallet ?? null}
            onClose={() => {
              setIsBetOpen(false);
              setSelectedArea(null);
              setForm((f) => ({ ...f, areaHeb: "" }));
            }}
            onSubmit={submitBet}
          />
        )}

        <BetsDrawer
          open={betsOpen}
          bets={bets}
          onClose={() => setBetsOpen(false)}
          onRefresh={refreshBets}
        />

        {notifications.length > 0 && (
          <Box
            sx={{
              position: "absolute",
              left: 12,
              bottom: 12,
              display: "flex",
              flexDirection: "column",
              gap: 1,
              maxWidth: 320,
            }}
          >
            {notifications.slice(0, 3).map((n) => (
              <Paper
                key={n.id}
                elevation={2}
                sx={{
                  p: 1.25,
                  bgcolor: "#22242a",
                  color: "#EAEAEA",
                }}
              >
                <Typography variant="body2">{n.text}</Typography>
              </Paper>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};
