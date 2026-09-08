import { FC, memo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  FormControlLabel,
  Checkbox,
  Paper,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import { BetFormValues, SelectedArea, Wallet } from "../../types";
import { isRegion, isExcludedFromBetting } from "../../utils/regionAreas";
import { useOrefAreas } from "../../utils/useOrefAreas";
import { tactical } from "../../theme";

const isValidHHMM = (v: string) => /^\d{2}:\d{2}$/.test(v);

/** True if the given date + time (local) is in the past (cannot bet on it). */
function isPredictedTimeInPast(date: string, predictedTime: string): boolean {
  if (!date || !isValidHHMM(predictedTime)) return false;
  const t = predictedTime.trim().slice(0, 5);
  const iso = `${date}T${t}:00`;
  const predictedAt = new Date(iso);
  return (
    Number.isFinite(predictedAt.getTime()) &&
    predictedAt.getTime() <= Date.now()
  );
}

export const BetDrawer: FC<{
  selectedArea: SelectedArea | null;
  areaHeb: string;
  form: BetFormValues;
  setForm: React.Dispatch<React.SetStateAction<BetFormValues>>;
  disabled: boolean;
  loginRequired: boolean;
  paymentRequired: boolean;
  wallet: Wallet | null;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}> = memo((props) => {
  const { form, setForm } = props;
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const {
    areas: areaOptions,
    loading: areasLoading,
    error: areasError,
  } = useOrefAreas();

  const timeInvalid = !isValidHHMM(form.predictedTime);
  const predictedInPast = isPredictedTimeInPast(form.date, form.predictedTime);
  const showAreaPicker = props.selectedArea == null;

  return (
    <Paper
      elevation={0}
      sx={{
        position: "absolute",
        right: 12,
        top: 12,
        width: 320,
        maxWidth: "calc(100vw - 24px)",
        p: 2,
        zIndex: 1300,
        bgcolor: tactical.panel,
        border: `1px solid ${tactical.hairline}`,
        borderRadius: "3px",
        "& .MuiInputBase-input": { color: tactical.phosphor },
        "& .MuiInputLabel-root": { color: tactical.phosphorMuted },
        "& .MuiInputLabel-root.Mui-focused": { color: tactical.phosphor },
        "& .MuiOutlinedInput-notchedOutline": {
          borderColor: tactical.hairlineStrong,
        },
        "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
          borderColor: tactical.phosphorMuted,
        },
        "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline":
          {
            borderColor: tactical.olive,
          },
        "& .MuiFormHelperText-root": { color: tactical.phosphorMuted },
        "& .MuiSvgIcon-root": { color: tactical.phosphor },
      }}
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={1.5}
      >
        <Typography
          variant="subtitle2"
          sx={{ letterSpacing: "0.06em", color: tactical.phosphor }}
        >
          Bet on area
        </Typography>
        <Button
          size="small"
          onClick={props.onClose}
          aria-label="close"
          sx={{ color: tactical.phosphor, minWidth: 0 }}
        >
          ✕
        </Button>
      </Box>

      {showAreaPicker ? (
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            <strong>Area</strong>
          </Typography>
          <Autocomplete
            value={form.areaHeb ?? form.name ?? null}
            inputValue={form.areaHeb ?? form.name ?? ""}
            onInputChange={(_, value) =>
              setForm((f) => ({ ...f, areaHeb: value ?? "" }))
            }
            onChange={(_, value) =>
              setForm((f) => ({ ...f, areaHeb: value ?? "" }))
            }
            options={areaOptions}
            loading={areasLoading}
            freeSolo
            filterSelectedOptions={false}
            ListboxProps={{ style: { maxHeight: 320 } }}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                placeholder="Type to filter, then select..."
                error={!!areasError}
                helperText={areasError ?? undefined}
                sx={{ "& .MuiInputBase-input": { color: tactical.phosphor } }}
              />
            )}
            sx={{
              "& .MuiOutlinedInput-root": { color: tactical.phosphor },
              "& .MuiInputLabel-root": { color: tactical.phosphorMuted },
              "& .MuiAutocomplete-popupIndicator": { color: tactical.phosphor },
              "& .MuiAutocomplete-clearIndicator": { color: tactical.phosphor },
            }}
          />
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          <strong>Area:</strong> {props.areaHeb}
        </Typography>
      )}
      {props.areaHeb && isExcludedFromBetting(props.areaHeb) && (
        <Alert
          severity="warning"
          sx={{
            mt: 0.5,
            mb: 1,
            bgcolor: "rgba(201, 162, 39, 0.12)",
            color: tactical.amber,
            border: `1px solid ${tactical.hairline}`,
            "& .MuiAlert-icon": { color: tactical.amber },
          }}
        >
          This area cannot be used for betting.
        </Alert>
      )}
      {isRegion(props.areaHeb) && !isExcludedFromBetting(props.areaHeb) && (
        <Alert
          severity="info"
          sx={{
            mt: 0.5,
            mb: 1,
            bgcolor: "rgba(107, 124, 58, 0.12)",
            color: tactical.phosphor,
            border: `1px solid ${tactical.hairline}`,
            "& .MuiAlert-icon": { color: tactical.olive },
          }}
        >
          This area is a region (not a city/settlement). Winning payout is lower
          than for specific settlements.
        </Alert>
      )}
      {props.wallet && (
        <Box mt={0.5} mb={1}>
          <Typography variant="caption" color="text.secondary" display="block">
            <strong>Available:</strong>{" "}
            {Number(props.wallet.availableBalance ?? 0).toFixed(2)}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            <strong>Reserved:</strong>{" "}
            {Number(props.wallet.reservedBalance ?? 0).toFixed(2)}
          </Typography>
        </Box>
      )}

      <TextField
        label="Date"
        type="date"
        value={form.date}
        onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
        fullWidth
        size="small"
        margin="normal"
        InputLabelProps={{ shrink: true }}
      />

      <TextField
        label="Time (HH:MM)"
        type="time"
        value={form.predictedTime}
        onChange={(e) =>
          setForm((f) => ({ ...f, predictedTime: e.target.value }))
        }
        fullWidth
        size="small"
        margin="normal"
        inputProps={{ step: 60 }}
        InputLabelProps={{ shrink: true }}
        error={timeInvalid}
        helperText={
          timeInvalid ? "Please enter time in HH:MM format." : undefined
        }
      />

      <TextField
        label="Amount"
        type="number"
        value={form.amount}
        onChange={(e) =>
          setForm((f) => ({ ...f, amount: Number(e.target.value) }))
        }
        fullWidth
        size="small"
        margin="normal"
        inputProps={{ min: 1, step: 1 }}
      />

      <FormControlLabel
        control={
          <Checkbox
            checked={!!form.allowMinuteProximity}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                allowMinuteProximity: e.target.checked,
              }))
            }
            size="small"
            sx={{
              color: tactical.phosphorMuted,
              "&.Mui-checked": { color: tactical.olive },
            }}
          />
        }
        label={
          <Typography variant="body2" color="text.primary">
            Enable minute proximity (max ±10 min)
          </Typography>
        }
        sx={{ mt: 1 }}
      />

      <Paper
        variant="outlined"
        elevation={0}
        sx={{
          mt: 1.5,
          p: 1,
          bgcolor: tactical.gunmetal,
          borderColor: tactical.hairline,
          borderRadius: "3px",
        }}
      >
        <Typography
          variant="caption"
          fontWeight={700}
          display="block"
          gutterBottom
          color="text.secondary"
        >
          Time payout model
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          • High payout for an exact guess on <strong>HH:MM</strong>.
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          • When enabled, lower payout for closest minutes within ±10 minutes of
          the alert time.
        </Typography>
      </Paper>

      {props.loginRequired && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          Login required to place a bet.
        </Typography>
      )}
      {props.paymentRequired && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          Select a payment method to place a bet.
        </Typography>
      )}
      {predictedInPast && (
        <Alert
          severity="warning"
          sx={{
            mt: 1,
            bgcolor: "rgba(201, 162, 39, 0.12)",
            color: tactical.amber,
            border: `1px solid ${tactical.hairline}`,
          }}
        >
          Cannot place a bet for a time in the past.
        </Alert>
      )}

      {err && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          {err}
        </Typography>
      )}

      <Button
        variant="contained"
        fullWidth
        disabled={
          props.disabled ||
          busy ||
          timeInvalid ||
          predictedInPast ||
          isExcludedFromBetting(props.areaHeb)
        }
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
        sx={{ mt: 2 }}
      >
        {busy ? "Placing…" : "Place Bet"}
      </Button>
    </Paper>
  );
});

BetDrawer.displayName = "BetDrawer";
