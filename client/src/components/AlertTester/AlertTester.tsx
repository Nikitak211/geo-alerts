import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Paper, Typography } from "@mui/material";
import type { AlertPayload, HighlightStore } from "../../types";
import { normalize, toBaseMunicipalityName } from "../../utils/cityNameMatching";
import { createSirenPlayer } from "../../utils/siren";
import { useAlertPlaces } from "../../contexts/AlertPlacesContext";
import { useOrefTrajectory } from "../../features/oref";
import { GeoJsonProvider, useGeoJsonContext } from "../../contexts/GeoJsonContext";
import { MunicipalityGeoJsonLayer } from "../MapLayer";

const CITY_TTL_MS = 600_000; // 10 min for highlights and pins
const CITIES_URL = "/data/cities.json";
const GEOJSON_URL = "/data/municipalities.geojson";

function AlertTesterContent() {
  const blinkTimeoutsRef = useRef<Record<string, number>>({});
  const sirenRef = useRef<ReturnType<typeof createSirenPlayer> | null>(null);
  const storeRef = useRef<HighlightStore>({
    placeIndexByCityKey: new Map(),
    georefReadyPromise: Promise.resolve(),
    timeoutByCity: new Map(),
  });

  const { getDisplayNamesForCity } = useGeoJsonContext();
  const { setPlaces, setServerPositions, clearAll } = useAlertPlaces();
  const { lastUpdate, serverPositions, connected, clearTrajectories } = useOrefTrajectory();

  const [highlightedNames, setHighlightedNames] = useState<Set<string>>(
    new Set(),
  );
  const [alerts, setAlerts] = useState<AlertPayload[]>([]);
  const [blinking, setBlinking] = useState<Record<string, boolean>>({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const unlockAttemptedRef = useRef(false);

  useEffect(() => {
    if (soundEnabled && !sirenRef.current) {
      sirenRef.current = createSirenPlayer();
    }
  }, [soundEnabled]);

  const handleUnlockSound = useCallback(() => {
    if (unlockAttemptedRef.current || !sirenRef.current) return;
    unlockAttemptedRef.current = true;
    sirenRef.current.unlock();
  }, []);

  const startBlink = (id: string, ms = 8000) => {
    setBlinking((prev) => ({ ...prev, [id]: true }));
    if (blinkTimeoutsRef.current[id])
      window.clearTimeout(blinkTimeoutsRef.current[id]);
    blinkTimeoutsRef.current[id] = window.setTimeout(() => {
      setBlinking((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      delete blinkTimeoutsRef.current[id];
    }, ms);
  };

  const playAlertSoundRef = useRef<() => void>(() => {});
  const playAlertSound = useCallback(() => {
    if (!soundEnabled) return;
    const siren = sirenRef.current;
    if (!siren) return;
    siren.unlock().then(() => {
      if (sirenRef.current) sirenRef.current.playSiren();
    });
  }, [soundEnabled]);
  playAlertSoundRef.current = playAlertSound;

  const enableSound = async () => {
    if (!sirenRef.current) sirenRef.current = createSirenPlayer();
    if (!sirenRef.current) return;
    await sirenRef.current.unlock();
    setSoundEnabled(true);
  };

  const disableSound = () => {
    setSoundEnabled(false);
  };

  const highlightCityRef = useRef<(name: string) => void>(() => {});
  const highlightCity = useCallback(
    (cityNameRaw: string) => {
      const displayNames = getDisplayNamesForCity(cityNameRaw);
      if (displayNames.length === 0) return;
      const cityKey = normalize(toBaseMunicipalityName(cityNameRaw));
      setHighlightedNames((prev) => {
        const next = new Set(prev);
        displayNames.forEach((n) => next.add(n));
        return next;
      });
      const prev = storeRef.current.timeoutByCity.get(cityKey);
      if (prev) window.clearTimeout(prev);
      const t = window.setTimeout(() => {
        setHighlightedNames((prev) => {
          const next = new Set(prev);
          displayNames.forEach((n) => next.delete(n));
          return next;
        });
        storeRef.current.timeoutByCity.delete(cityKey);
      }, CITY_TTL_MS);
      storeRef.current.timeoutByCity.set(cityKey, t);
    },
    [getDisplayNamesForCity],
  );
  highlightCityRef.current = highlightCity;

  const clearAllCityHighlights = useCallback(() => {
    Array.from(storeRef.current.timeoutByCity.values()).forEach((t) => window.clearTimeout(t));
    storeRef.current.timeoutByCity.clear();
    setHighlightedNames(new Set());
  }, []);

  const placesMapRef = useRef<Record<string, { title: string; expiresAt: number }>>({});

  const syncPlaces = useCallback(() => {
    const now = Date.now();
    const map = placesMapRef.current;
    const next: { place: string; title: string }[] = [];
    for (const [place, v] of Object.entries(map)) {
      if (v.expiresAt > now) next.push({ place, title: v.title });
      else delete map[place];
    }
    setPlaces(next);
  }, [setPlaces]);

  // Sync server positions from SignalR into AlertPlacesContext for pins
  useEffect(() => {
    setServerPositions(serverPositions);
  }, [serverPositions, setServerPositions]);

  // Push each new oref_update from SignalR into local alerts and trigger blink/sound/highlight
  const lastUpdateIdRef = useRef<string | number | null>(null);
  useEffect(() => {
    if (!lastUpdate?.id) return;
    const id = String(lastUpdate.id);
    if (lastUpdateIdRef.current === id) return;
    lastUpdateIdRef.current = id;
    const withTime: AlertPayload = {
      id,
      title: lastUpdate.title ?? "",
      data: lastUpdate.data ?? [],
      desc: lastUpdate.desc ?? "",
      cat: lastUpdate.cat ?? "",
      time: new Date(),
    };
    setAlerts((prev) => [withTime, ...prev]);
    startBlink(id, 8000);
    playAlertSoundRef.current();
    if (Array.isArray(withTime.data)) {
      for (const cityName of withTime.data) highlightCityRef.current(cityName);
    }
  }, [lastUpdate]);

  useEffect(() => {
    const now = Date.now();
    if (alerts.length === 0) {
      placesMapRef.current = {};
    } else {
      const latest = alerts[0];
      for (const place of latest.data ?? []) {
        placesMapRef.current[place] = {
          title: latest.title ?? "",
          expiresAt: now + CITY_TTL_MS,
        };
      }
    }
    syncPlaces();
  }, [alerts, syncPlaces]);

  useEffect(() => {
    const id = setInterval(syncPlaces, 30_000);
    return () => clearInterval(id);
  }, [syncPlaces]);

  const testAlert = async () => {
    const siren = sirenRef.current;
    if (siren && soundEnabled) {
      await siren.unlock();
      siren.playSiren();
    }
    const payload: AlertPayload = {
      id: Date.now().toString(),
      cat: "99",
      title: "🚨 בדיקה",
      data: [
        "קצרין",
        "מסעדה",
        "מג'דל שמס",
        "בוקעתא",
        "עין קנייא",
        "נמרוד",
        "אלוני הבשן",
        "אורטל",
        "מרום גולן",
        "עין זיוון",
        "קריית שמונה",
        "מטולה",
        "כפר גלעדי",
        "תל חי",
        "מרגליות",
        "משגב עם",
        "מנרה",
        "כפר יובל",
        "מעיין ברוך",
        "דפנה",
        "שאר ישוב",
        "שניר",
        "הגושרים",
        "צפת",
        "ראש פינה",
        "חצור הגלילית",
        "נהריה",
        "עכו",
        "מעלות-תרשיחא",
        "שלומי",
        "כפר ורדים",
        "יאנוח-ג'ת",
        "פקיעין (בוקייעה)",
        "ראמה",
        "ג'דיידה-מכר",
        "ירכא",
        "כפר יאסיף",
        "חיפה",
        "קריית אתא",
        "קריית ביאליק",
        "קריית מוצקין",
        "קריית ים",
        "נשר",
        "טירת כרמל",
        "טבריה",
        "מגדל",
        "יבנאל",
      ],
      desc: "בדיקת מערכת",
      time: new Date(),
    };
    setAlerts((prev) => [payload, ...prev]);
    startBlink(payload.id, 8000);
    payload.data.forEach((d) => highlightCity(d));
  };

  const clearAlerts = () => {
    setAlerts([]);
    clearAll();
    clearTrajectories();
    setBlinking({});
    clearAllCityHighlights();
    Object.values(blinkTimeoutsRef.current).forEach((t) =>
      window.clearTimeout(t),
    );
    blinkTimeoutsRef.current = {};
  };

  useEffect(() => {
    return () => {
      Object.values(blinkTimeoutsRef.current).forEach((t) =>
        window.clearTimeout(t),
      );
      blinkTimeoutsRef.current = {};
      clearAllCityHighlights();
      sirenRef.current?.dispose?.();
    };
  }, []);

  return (
    <>
      <MunicipalityGeoJsonLayer
        geojsonUrl={GEOJSON_URL}
        highlightedNames={highlightedNames}
      />
      <Paper
        elevation={4}
        onClickCapture={handleUnlockSound}
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 280,
          maxWidth: "92vw",
          height: "60vh",
          p: 2,
          bgcolor: "#22242a",
          borderLeft: "1px solid rgba(255,255,255,0.12)",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{ color: "#EAEAEA", mb: 1.5 }}
        >
          Oref Alert
        </Typography>

        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            alignItems: "center",
            mb: 1.5,
          }}
        >
          <Button
            size="small"
            variant="outlined"
            onClick={testAlert}
            sx={{
              borderColor: "rgba(234,234,234,0.5)",
              color: "#EAEAEA",
              "&:hover": {
                borderColor: "#EAEAEA",
                bgcolor: "rgba(255,255,255,0.08)",
              },
            }}
          >
            Test Alert
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={clearAlerts}
            sx={{
              borderColor: "rgba(234,234,234,0.5)",
              color: "#EAEAEA",
              "&:hover": {
                borderColor: "#EAEAEA",
                bgcolor: "rgba(255,255,255,0.08)",
              },
            }}
          >
            Clear
          </Button>
          <Button
            size="small"
            variant={soundEnabled ? "contained" : "outlined"}
            onClick={soundEnabled ? disableSound : enableSound}
            sx={
              soundEnabled
                ? {
                    bgcolor: "rgba(255,255,255,0.2)",
                    color: "#EAEAEA",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
                  }
                : {
                    borderColor: "rgba(234,234,234,0.5)",
                    color: "#EAEAEA",
                    "&:hover": {
                      borderColor: "#EAEAEA",
                      bgcolor: "rgba(255,255,255,0.08)",
                    },
                  }
            }
          >
            {soundEnabled ? "Disable Sound" : "Enable Sound"}
          </Button>
          <Typography
            variant="body2"
            component="span"
            sx={{
              color: connected ? "#2ef369" : "#f31616",
              fontWeight: 700,
              ml: 0.5,
            }}
          >
            {connected ? "🟢 connected" : "🔴 disconnected"}
          </Typography>
        </Box>

        <Box sx={{ flex: 1, overflow: "auto", pr: 0.5 }}>
          {alerts.length === 0 ? (
            <Typography variant="body2" sx={{ color: "rgba(234,234,234,0.7)" }}>
              No alerts yet. Click <strong>Test Alert</strong> or wait for live
              updates (connection is automatic).
            </Typography>
          ) : (
            alerts.map((a, index) => {
              const isNew = !!blinking[a.id];
              const time = a.time?.toLocaleTimeString?.() ?? "";
              return (
                <Paper
                  key={`${a.id}-${a.time?.getTime?.() ?? index}-${index}`}
                  variant="outlined"
                  className={isNew ? "alert-card-new" : ""}
                  sx={{
                    p: 1.25,
                    mb: 1,
                    bgcolor: isNew ? "rgba(255,59,59,0.15)" : "#2d2f36",
                    borderColor: isNew
                      ? "rgba(255,59,59,0.6)"
                      : "rgba(255,255,255,0.12)",
                    borderLeftWidth: isNew ? 4 : 1,
                    borderLeftStyle: "solid",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      mb: 0.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 700,
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 999,
                        bgcolor: isNew ? "#ff3b3b" : "rgba(0,0,0,0.4)",
                        color: isNew ? "#111" : "#EAEAEA",
                      }}
                    >
                      {isNew ? "NEW" : "ALERT"}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={800}
                      sx={{ color: "#EAEAEA", flex: 1 }}
                    >
                      {a.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "rgba(234,234,234,0.7)" }}
                    >
                      {time}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ color: "rgba(234,234,234,0.85)", display: "block" }}
                  >
                    {a.desc}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: "rgba(234,234,234,0.8)" }}
                  >
                    <strong>Locations:</strong> {a.data.join(", ")}
                  </Typography>
                </Paper>
              );
            })
          )}
        </Box>
      </Paper>
    </>
  );
}

function AlertTester() {
  return (
    <GeoJsonProvider
      citiesUrl={CITIES_URL}
      geojsonUrl={GEOJSON_URL}
    >
      <AlertTesterContent />
    </GeoJsonProvider>
  );
}

export default memo(AlertTester);
