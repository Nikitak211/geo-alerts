import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Modal,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

type ModalMode = "register" | "paymentMethod";

export function GenericModal(props: {
  open: boolean;
  mode: ModalMode;
  title?: string;
  onClose: () => void;

  onRegister?: (email: string, password: string) => Promise<void>;
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

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper
        sx={{
          width: 380,
          maxWidth: "100%",
          p: 2,
          bgcolor: "#2d2f36",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" fontWeight={700} color="text.primary">
            {title}
          </Typography>
          <Button
            size="small"
            onClick={props.onClose}
            aria-label="close"
            sx={{ color: "#EAEAEA", minWidth: 0 }}
          >
            ✕
          </Button>
        </Box>

        <Box component="form" sx={{ mt: 2 }}>
          {props.mode === "register" ? (
            <>
              <TextField
                fullWidth
                size="small"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email"
                margin="normal"
                sx={{
                  "& .MuiInputBase-input": { color: "#EAEAEA" },
                  "& .MuiInputLabel-root": { color: "rgba(234,234,234,0.7)" },
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(234,234,234,0.5)",
                  },
                }}
              />
              <TextField
                fullWidth
                size="small"
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                margin="normal"
                sx={{
                  "& .MuiInputBase-input": { color: "#EAEAEA" },
                  "& .MuiInputLabel-root": { color: "rgba(234,234,234,0.7)" },
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(234,234,234,0.5)",
                  },
                }}
              />
              <Button
                fullWidth
                variant="contained"
                disabled={busy}
                sx={{
                  mt: 2,
                  bgcolor: "rgba(255,255,255,0.15)",
                  color: "#EAEAEA",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.25)" },
                }}
                onClick={async () => {
                  setErr(null);
                  setBusy(true);
                  try {
                    if (!props.onRegister) throw new Error("Register handler missing");
                    if (!email.trim()) throw new Error("Missing email");
                    if (password.length < 4) throw new Error("Password too short");
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
              </Button>
            </>
          ) : (
            <>
              <TextField
                fullWidth
                size="small"
                label="Label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder='e.g. "Visa **** 4242"'
                margin="normal"
                sx={{
                  "& .MuiInputBase-input": { color: "#EAEAEA" },
                  "& .MuiInputLabel-root": { color: "rgba(234,234,234,0.7)" },
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(234,234,234,0.5)",
                  },
                }}
              />
              <Button
                fullWidth
                variant="contained"
                disabled={busy}
                sx={{
                  mt: 2,
                  bgcolor: "rgba(255,255,255,0.15)",
                  color: "#EAEAEA",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.25)" },
                }}
                onClick={async () => {
                  setErr(null);
                  setBusy(true);
                  try {
                    if (!props.onAddPaymentMethod) throw new Error("Payment handler missing");
                    if (!label.trim()) throw new Error("Missing label");
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
              </Button>
            </>
          )}

          {err && (
            <Typography variant="body2" color="error" sx={{ mt: 1.5 }}>
              {err}
            </Typography>
          )}
        </Box>
      </Paper>
    </Modal>
  );
}
