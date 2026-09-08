import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { AlertPayload, HighlightStore } from "../../types";
import { normalize, toBaseMunicipalityName } from "../../utils/cityNameMatching";
import { createSirenPlayer } from "../../utils/siren";
import { useAlertPlaces } from "../../contexts/AlertPlacesContext";
import { useOrefAlertUi } from "../../contexts/OrefAlertUiContext";
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
  const { lastUpdate, serverPositions, connected, clearTrajectories } =
    useOrefTrajectory();
  const { publish } = useOrefAlertUi();

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

  const enableSound = useCallback(async () => {
    if (!sirenRef.current) sirenRef.current = createSirenPlayer();
    if (!sirenRef.current) return;
    await sirenRef.current.unlock();
    setSoundEnabled(true);
  }, []);

  const disableSound = useCallback(() => {
    setSoundEnabled(false);
  }, []);

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
    Array.from(storeRef.current.timeoutByCity.values()).forEach((t) =>
      window.clearTimeout(t),
    );
    storeRef.current.timeoutByCity.clear();
    setHighlightedNames(new Set());
  }, []);

  const placesMapRef = useRef<
    Record<string, { title: string; expiresAt: number }>
  >({});

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

  useEffect(() => {
    setServerPositions(serverPositions);
  }, [serverPositions, setServerPositions]);

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

  const testAlert = useCallback(async () => {
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
  }, [soundEnabled, highlightCity]);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    clearAll();
    clearTrajectories();
    setBlinking({});
    clearAllCityHighlights();
    Object.values(blinkTimeoutsRef.current).forEach((t) =>
      window.clearTimeout(t),
    );
    blinkTimeoutsRef.current = {};
  }, [clearAll, clearTrajectories, clearAllCityHighlights]);

  useEffect(() => {
    publish({
      connected,
      alerts,
      blinking,
      soundEnabled,
      ready: true,
      testAlert,
      clearAlerts,
      enableSound,
      disableSound,
      unlockSound: handleUnlockSound,
    });
  }, [
    publish,
    connected,
    alerts,
    blinking,
    soundEnabled,
    testAlert,
    clearAlerts,
    enableSound,
    disableSound,
    handleUnlockSound,
  ]);

  useEffect(() => {
    return () => {
      Object.values(blinkTimeoutsRef.current).forEach((t) =>
        window.clearTimeout(t),
      );
      blinkTimeoutsRef.current = {};
      clearAllCityHighlights();
      sirenRef.current?.dispose?.();
      publish({
        ready: false,
        alerts: [],
        blinking: {},
        connected: false,
        testAlert: () => {},
        clearAlerts: () => {},
        enableSound: () => {},
        disableSound: () => {},
        unlockSound: () => {},
      });
    };
  }, [clearAllCityHighlights, publish]);

  return (
    <MunicipalityGeoJsonLayer
      geojsonUrl={GEOJSON_URL}
      highlightedNames={highlightedNames}
    />
  );
}

function AlertTester() {
  return (
    <GeoJsonProvider citiesUrl={CITIES_URL} geojsonUrl={GEOJSON_URL}>
      <AlertTesterContent />
    </GeoJsonProvider>
  );
}

export default memo(AlertTester);
