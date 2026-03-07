import { useMemo, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  FormControl,
  Menu,
  MenuItem,
  Select,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { PaymentMethod, User } from "../../types";

type MenuItemType = { key: string; label: string; disabled?: boolean };

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
  onOpenPlaceBet: () => void;

  onLoadBalance: (paymentMethodId: string) => Promise<void>;
}) {
  const { user } = props;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchor);

  const menuItems: MenuItemType[] = useMemo(
    () => [
      { key: "bets", label: "View bets", disabled: !user },
      { key: "pay", label: "Settings: Payment method", disabled: !user },
    ],
    [user],
  );

  const balanceText = useMemo(() => {
    if (!user?.wallet) return "";
    const avail = Number(user.wallet.availableBalance ?? 0).toFixed(2);
    const reserved = Number(user.wallet.reservedBalance ?? 0).toFixed(2);
    const total = Number(user.wallet.totalBalance ?? 0).toFixed(2);
    return `Available: ${avail} · Reserved: ${reserved} · Total: ${total}`;
  }, [user]);

  const handleCloseMenu = () => setMenuAnchor(null);

  return (
    <AppBar
      position="static"
      sx={{
        bgcolor: "#22242a",
        color: "#EAEAEA",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <Toolbar variant="dense" sx={{ gap: 2, minHeight: { xs: 48, sm: 56 } }}>
        <Typography variant="h6" component="span" fontWeight={800}>
          Cesium Bets
        </Typography>

        {user && (
          <Typography variant="body2" sx={{ color: "#EAEAEA" }}>
            {balanceText}
          </Typography>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {user ? (
          <>
            <Typography variant="body2" sx={{ color: "#EAEAEA" }}>
              Logged in: {user.email}
            </Typography>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={props.selectedPaymentMethodId ?? ""}
                onChange={(e) => props.onSelectPaymentMethod(e.target.value)}
                displayEmpty
                sx={{
                  color: "#EAEAEA",
                  "& .MuiSelect-select": { color: "#EAEAEA" },
                  ".MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(234,234,234,0.5)",
                  },
                  "& .MuiSvgIcon-root": { color: "#EAEAEA" },
                }}
              >
                {props.paymentMethods.length === 0 ? (
                  <MenuItem value="">
                    <em>No payment methods</em>
                  </MenuItem>
                ) : (
                  props.paymentMethods.map((pm) => (
                    <MenuItem key={pm.id} value={pm.id}>
                      {pm.label}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              size="small"
              disabled={!props.selectedPaymentMethodId}
              onClick={() =>
                props.selectedPaymentMethodId &&
                props.onLoadBalance(props.selectedPaymentMethodId)
              }
              sx={{
                bgcolor: "rgba(255,255,255,0.15)",
                color: "#EAEAEA",
                "&:hover": { bgcolor: "rgba(255,255,255,0.25)" },
              }}
            >
              Load Balance
            </Button>

            <Button
              variant="contained"
              size="small"
              onClick={props.onOpenPlaceBet}
              sx={{
                bgcolor: "rgba(76, 175, 80, 0.9)",
                color: "#fff",
                "&:hover": { bgcolor: "rgba(76, 175, 80, 1)" },
              }}
            >
              Place bet
            </Button>

            <Button
              id="menu-button"
              aria-controls={menuOpen ? "toolbar-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={menuOpen ? "true" : undefined}
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{ color: "#EAEAEA", minWidth: 0 }}
            >
              ☰
            </Button>
            <Menu
              id="toolbar-menu"
              anchorEl={menuAnchor}
              open={menuOpen}
              onClose={handleCloseMenu}
              MenuListProps={{ "aria-labelledby": "menu-button" }}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              PaperProps={{
                sx: {
                  bgcolor: "#2d2f36",
                  border: "1px solid rgba(255,255,255,0.12)",
                  mt: 1.5,
                },
              }}
            >
              {menuItems.map((it) => (
                <MenuItem
                  key={it.key}
                  disabled={it.disabled}
                  onClick={() => {
                    handleCloseMenu();
                    if (it.key === "bets") props.onOpenBets();
                    if (it.key === "pay") props.onOpenAddPaymentMethod();
                  }}
                  sx={{ color: "#EAEAEA" }}
                >
                  {it.label}
                </MenuItem>
              ))}
              <MenuItem
                onClick={() => {
                  handleCloseMenu();
                  props.onLogout();
                }}
                sx={{ color: "#EAEAEA" }}
              >
                Logout
              </MenuItem>
            </Menu>
          </>
        ) : (
          <>
            <TextField
              size="small"
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{
                width: 140,
                "& .MuiOutlinedInput-root": {
                  color: "#EAEAEA",
                  "& fieldset": { borderColor: "rgba(234,234,234,0.5)" },
                },
                "& .MuiInputLabel-root": { color: "rgba(234,234,234,0.7)" },
              }}
              inputProps={{ "aria-label": "email" }}
            />
            <TextField
              size="small"
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{
                width: 120,
                "& .MuiOutlinedInput-root": {
                  color: "#EAEAEA",
                  "& fieldset": { borderColor: "rgba(234,234,234,0.5)" },
                },
              }}
              inputProps={{ "aria-label": "password" }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={() => props.onLogin(email, password)}
              sx={{
                bgcolor: "rgba(255,255,255,0.15)",
                color: "#EAEAEA",
                "&:hover": { bgcolor: "rgba(255,255,255,0.25)" },
              }}
            >
              Login
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => props.onOpenRegister()}
              sx={{
                borderColor: "rgba(234,234,234,0.5)",
                color: "#EAEAEA",
                "&:hover": { borderColor: "#EAEAEA", bgcolor: "rgba(255,255,255,0.08)" },
              }}
            >
              Register
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}
