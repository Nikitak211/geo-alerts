import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { TopToolbar } from "./components/TopToolbar/TopToolbar";
import { GenericModal } from "./components/GenericModal/GenericModal";
import { BetDrawer } from "./components/BetDrawer/BetDrawer";
import { BetsDrawer } from "./components/BetsDrawer/BetsDrawer";
import { User, PaymentMethod, Bet, BetFormValues } from "./types";
import { api } from "./utils/helper";
import { MainMap } from "./components/MainMap/MainMap";

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
  });

  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<
    string | null
  >(null);

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

  const handleLoadBalance = async (paymentMethodId: string) => {
    const amount = prompt("Enter amount to deposit");

    if (!amount) return;

    await api("/api/deposit", {
      method: "POST",
      body: JSON.stringify({
        amount,
        paymentMethodId: selectedPaymentMethodId,
      }),
    });

    await refreshMe(); // reload user balance
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

  const canBet = useMemo(() => {
    if (!user) return false;
    if (!selectedPaymentMethodId) return false;
    if (!selectedArea) return false;
    if (!form.date) return false;
    if (!form.predictedTime || !/^\d{2}:\d{2}$/.test(form.predictedTime))
      return false;
    if (!Number.isFinite(form.amount) || form.amount <= 0) return false;

    return true;
  }, [user, selectedPaymentMethodId, selectedArea, form]);

  const handleAreaSelect = useCallback((area: SelectedArea) => {
    setSelectedArea(area);
    setForm({
      date: getLocalDateInputValue(),
      predictedTime: "",
      amount: 10,
    });
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
    if (!selectedArea) throw new Error("No area selected");
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
        areaHeb: selectedArea.areaHeb,
        betDate: form.date,
        predictedTime: form.predictedTime,
        amount: form.amount,
        paymentMethodId: selectedPaymentMethodId,
      }),
    });

    setIsBetOpen(false);
    setSelectedArea(null);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      predictedTime: "",
      amount: 10,
    });

    await refreshMe();
    await refreshBets();
  }, [form, selectedArea, selectedPaymentMethodId, refreshMe, refreshBets]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
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
      />

      <div style={{ position: "relative", flex: 1 }}>
        <MainMap onAreaSelect={handleAreaSelect} />

        <GenericModal
          open={modalOpen}
          mode={modalMode}
          onClose={() => setModalOpen(false)}
          onRegister={handleRegister}
          onAddPaymentMethod={handleAddPaymentMethod}
        />

        {isBetOpen && selectedArea && (
          <BetDrawer
            areaHeb={selectedArea.areaHeb}
            form={form}
            setForm={setForm}
            disabled={!canBet}
            loginRequired={!user}
            paymentRequired={!!user && !selectedPaymentMethodId}
            onClose={() => {
              setIsBetOpen(false);
              setSelectedArea(null);
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
      </div>
    </div>
  );
};
