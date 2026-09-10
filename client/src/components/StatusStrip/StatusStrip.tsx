import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  Menu,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { HubConnectionState } from "@microsoft/signalr";
import { PaymentMethod, User } from "../../types";
import { tactical } from "../../theme";

type MenuItemType = { key: string; label: string; disabled?: boolean };

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
  user: User | null;
  paymentMethods: PaymentMethod[];
  selectedPaymentMethodId: string | null;
  onSelectPaymentMethod: (id: string) => void;

  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;

  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onOpenAddPaymentMethod: () => void;
  onOpenBets: () => void;
  onOpenPlaceBet: () => void;

  onLoadBalance: (paymentMethodId: string) => Promise<void>;

  /** SignalR / OREF link */
  connectionState?: HubConnectionState | null;
  connected?: boolean;
  alertCount?: number;
  lastPollAt?: Date | null;
}) {
  const {
    user,
    connected = false,
    connectionState = null,
    alertCount = 0,
    lastPollAt = null,
  } = props;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [now, setNow] = useState(() => new Date());
  const menuOpen = Boolean(menuAnchor);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const menuItems: MenuItemType[] = useMemo(
    () => [
      { key: "bets", label: "View bets", disabled: !user },
      { key: "pay", label: "Settings: Payment method", disabled: !user },
      { key: "place", label: "Place bet", disabled: !user },
    ],
    [user],
  );

  const balanceText = useMemo(() => {
    if (!user?.wallet) return "";
    const avail = Number(user.wallet.availableBalance ?? 0).toFixed(2);
    const reserved = Number(user.wallet.reservedBalance ?? 0).toFixed(2);
    return `AVL ${avail} · RSV ${reserved}`;
  }, [user]);

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

  const handleCloseMenu = () => setMenuAnchor(null);

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      color: tactical.phosphor,
      fontSize: "0.75rem",
      height: 28,
      "& fieldset": { borderColor: tactical.hairlineStrong },
    },
    "& .MuiInputBase-input": { py: 0.5, px: 1 },
  };

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

      {user && (
        <Typography
          variant="caption"
          sx={{ color: tactical.phosphorMuted, whiteSpace: "nowrap", display: { xs: "none", md: "inline" } }}
        >
          {balanceText}
        </Typography>
      )}

      {user ? (
        <>
          <Typography
            variant="caption"
            sx={{
              color: tactical.phosphorMuted,
              maxWidth: 140,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: { xs: "none", sm: "inline" },
            }}
            title={user.email}
          >
            {user.email}
          </Typography>

          <FormControl size="small" sx={{ minWidth: 110, display: { xs: "none", sm: "inline-flex" } }}>
            <Select
              value={props.selectedPaymentMethodId ?? ""}
              onChange={(e) => props.onSelectPaymentMethod(e.target.value)}
              displayEmpty
              aria-label="Payment method"
              sx={{
                color: tactical.phosphor,
                fontSize: "0.72rem",
                height: 28,
                "& .MuiSelect-select": { py: 0.5, color: tactical.phosphor },
                ".MuiOutlinedInput-notchedOutline": {
                  borderColor: tactical.hairlineStrong,
                },
                "& .MuiSvgIcon-root": { color: tactical.phosphorMuted },
              }}
            >
              {props.paymentMethods.length === 0 ? (
                <MenuItem value="">
                  <em>No methods</em>
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
            variant="outlined"
            size="small"
            disabled={!props.selectedPaymentMethodId}
            onClick={() =>
              props.selectedPaymentMethodId &&
              props.onLoadBalance(props.selectedPaymentMethodId)
            }
            sx={{
              display: { xs: "none", md: "inline-flex" },
              height: 28,
              px: 1,
              fontSize: "0.7rem",
              borderColor: tactical.hairlineStrong,
              color: tactical.phosphor,
            }}
          >
            Load
          </Button>

          <Button
            id="ops-menu-button"
            aria-controls={menuOpen ? "ops-toolbar-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={menuOpen ? "true" : undefined}
            aria-label="Account and bets menu"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            sx={{
              color: tactical.phosphor,
              minWidth: 0,
              height: { xs: 44, sm: 28 },
              px: 1,
              fontSize: "0.75rem",
              border: `1px solid ${tactical.hairline}`,
              borderRadius: "2px",
            }}
          >
            MENU
          </Button>
          <Menu
            id="ops-toolbar-menu"
            anchorEl={menuAnchor}
            open={menuOpen}
            onClose={handleCloseMenu}
            MenuListProps={{ "aria-labelledby": "ops-menu-button" }}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            {menuItems.map((it) => (
              <MenuItem
                key={it.key}
                disabled={it.disabled}
                onClick={() => {
                  handleCloseMenu();
                  if (it.key === "bets") props.onOpenBets();
                  if (it.key === "pay") props.onOpenAddPaymentMethod();
                  if (it.key === "place") props.onOpenPlaceBet();
                }}
              >
                {it.label}
              </MenuItem>
            ))}
            <MenuItem
              onClick={() => {
                handleCloseMenu();
                props.onLogout();
              }}
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
            sx={{ ...fieldSx, width: 120, display: { xs: "none", sm: "inline-flex" } }}
            inputProps={{ "aria-label": "email" }}
          />
          <TextField
            size="small"
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ ...fieldSx, width: 100, display: { xs: "none", sm: "inline-flex" } }}
            inputProps={{ "aria-label": "password" }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={() => props.onLogin(email, password)}
            sx={{
              display: { xs: "none", sm: "inline-flex" },
              height: 28,
              px: 1,
              fontSize: "0.7rem",
            }}
          >
            Login
          </Button>
          <Button
            variant="contained"
            size="small"
            aria-label="Open login dialog"
            onClick={props.onOpenLogin}
            sx={{
              display: { xs: "inline-flex", sm: "none" },
              minWidth: 44,
              height: 44,
              px: 1,
              fontSize: "0.7rem",
            }}
          >
            Login
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => props.onOpenRegister()}
            sx={{
              height: { xs: 44, sm: 28 },
              px: 1,
              fontSize: "0.7rem",
              borderColor: tactical.hairlineStrong,
              color: tactical.phosphor,
            }}
          >
            Register
          </Button>
        </>
      )}
    </Box>
  );
}
