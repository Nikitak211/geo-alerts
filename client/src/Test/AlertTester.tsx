import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import { useCesium } from "resium";
import { css } from "./AlertTester.styles";

type AlertPayload = {
  id: string;
  cat: string;
  title: string;
  data: string[];
  desc: string;
  time: Date;
};

const CITY_TTL_MS = 600_000;

/* =========================
   NAME NORMALIZATION + LOOKUP KEYS (NO FUZZY / NO CONTAINS)
   ========================= */

const normalize = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[׳״"']/g, "")
    .replace(/[‐-‒–—−]/g, "-")
    .replace(/\u200f|\u200e/g, ""); // RTL marks

const PREFIX_WORDS = new Set(["קריית", "קרית", "כפר", "מושב", "קיבוץ"]);

function stripPrefix(raw: string): string {
  const s = normalize(raw);
  const parts = s.split(" ").filter(Boolean);
  if (parts.length >= 2 && PREFIX_WORDS.has(parts[0]))
    return parts.slice(1).join(" ");
  return s;
}

const OREF_TO_BASE_OVERRIDES: Record<string, string> = {
  "תל אביב": "תל אביב-יפו",
  "תל אביב יפו": "תל אביב-יפו",
  "תל אביב-יפו": "תל אביב-יפו",
};

function toBaseMunicipalityName(raw: string) {
  let s = normalize(raw);

  // OREF often uses "X - Y" for sub-areas; keep left side
  const dash = s.split(" - ");
  if (dash.length > 1) s = dash[0].trim();

  // remove non-municipality prefixes that appear in OREF
  s = s
    .replace(/^אזור תעשייה\s+/, "")
    .replace(/^פארק\s+/, "")
    .replace(/^תחנת רכבת\s+/, "")
    .replace(/^בית עלמין\s+/, "")
    .replace(/^מרכז אזורי\s+/, "")
    .replace(/^מסוף\s+/, "")
    .trim();

  if (OREF_TO_BASE_OVERRIDES[s]) s = OREF_TO_BASE_OVERRIDES[s];

  return s;
}

function cleanupParens(s: string) {
  return normalize(s)
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unifyHebrewPunctuation(s: string) {
  // normalize common arabic/geresh spelling quirks (deterministic, not fuzzy)
  return normalize(s)
    .replace(/׳/g, "")
    .replace(/"/g, "")
    .replace(/״/g, "")
    .replace(/'/g, "");
}

function buildLookupKeys(raw: string): string[] {
  const out = new Set<string>();

  const original = unifyHebrewPunctuation(raw);
  const base = unifyHebrewPunctuation(toBaseMunicipalityName(raw));

  const candidates = [
    original,
    base,
    cleanupParens(original),
    cleanupParens(base),
    stripPrefix(original),
    stripPrefix(base),
    stripPrefix(cleanupParens(original)),
    stripPrefix(cleanupParens(base)),
  ]
    .map((x) => normalize(x))
    .filter(Boolean);

  for (const s of candidates) {
    out.add(s);

    // hyphen <-> space
    out.add(s.replace(/-/g, " "));
    out.add(s.replace(/\s+/g, "-"));

    // normalize "X - Y" into "X-Y" and vice versa
    out.add(s.replace(/\s*-\s*/g, "-"));
    out.add(s.replace(/\s*-\s*/g, " - "));
  }

  return Array.from(out).map(normalize).filter(Boolean);
}

/* =========================
   AUDIO (TRIPLE BEEP)
   ========================= */

function createSirenPlayer() {
  const AudioCtx = (window.AudioContext ||
    (window as any).webkitAudioContext) as typeof AudioContext | undefined;
  if (!AudioCtx) return null;

  const ctx = new AudioCtx();

  const beep = (freq: number, durationMs: number, gainValue: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.value = freq;

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    const dur = durationMs / 1000;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainValue, now + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + dur);

    osc.start(now);
    osc.stop(now + dur);
  };

  const playSiren = () => {
    const freq = 880;
    const duration = 180;
    beep(freq, duration, 0.25);
    setTimeout(() => beep(freq, duration, 0.25), 220);
    setTimeout(() => beep(freq, duration, 0.25), 440);
  };

  return {
    ctx,
    unlock: async () => {
      if (ctx.state === "suspended") await ctx.resume();
      beep(1, 10, 0.0001);
    },
    playSiren,
    dispose: () => ctx.close(),
  };
}

/* =========================
   ENTITY NAME EXTRACTION (NO FIXED PROPERTY KEY)
   ========================= */

const looksHebrew = (s: string) => /[\u0590-\u05FF]/.test(s);

function extractEntityNames(e: Cesium.Entity): string[] {
  const out: string[] = [];

  if (typeof e.name === "string" && e.name.trim()) out.push(e.name.trim());

  const props = e.properties;
  if (props) {
    const keys =
      (props as any).propertyNames ?? Object.keys((props as any) ?? {});

    // Hebrew strings first
    for (const k of keys) {
      try {
        const v = (props as any)[k]?.getValue?.();
        if (typeof v === "string" && v.trim() && looksHebrew(v))
          out.push(v.trim());
      } catch {}
    }

    // then any string
    for (const k of keys) {
      try {
        const v = (props as any)[k]?.getValue?.();
        if (typeof v === "string" && v.trim()) out.push(v.trim());
      } catch {}
    }
  }

  // de-dup
  return Array.from(new Set(out.filter(Boolean)));
}

/* =========================
   HIGHLIGHT STORE
   ========================= */

type HighlightStore = {
  ds: Cesium.GeoJsonDataSource | null;

  // lookupKey -> entities
  entitiesByKey: Map<string, Cesium.Entity[]>;

  // original material per entity (restore)
  originalMatByEntity: Map<Cesium.Entity, Cesium.MaterialProperty | undefined>;

  // cityKey -> timeout id
  timeoutByCity: Map<string, number>;

  // cityKey -> last entities highlighted (so TTL restores exactly those)
  lastEntitiesByCity: Map<string, Cesium.Entity[]>;
};

export default function AlertTester() {
  const { viewer } = useCesium();

  const wsRef = useRef<WebSocket | null>(null);
  const blinkTimeoutsRef = useRef<Record<string, number>>({});
  const sirenRef = useRef<ReturnType<typeof createSirenPlayer> | null>(null);

  const storeRef = useRef<HighlightStore>({
    ds: null,
    entitiesByKey: new Map(),
    originalMatByEntity: new Map(),
    timeoutByCity: new Map(),
    lastEntitiesByCity: new Map(),
  });

  const [connected, setConnected] = useState(false);
  const [alerts, setAlerts] = useState<AlertPayload[]>([]);
  const [blinking, setBlinking] = useState<Record<string, boolean>>({});
  const [soundEnabled, setSoundEnabled] = useState(false);

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

  const playAlertSound = () => {
    if (!soundEnabled) return;
    sirenRef.current?.playSiren();
  };

  const enableSound = async () => {
    if (!sirenRef.current) sirenRef.current = createSirenPlayer();
    if (!sirenRef.current) return;
    await sirenRef.current.unlock();
    setSoundEnabled(true);
  };

  /* =========================
     LOAD MUNICIPALITIES + BUILD KEY INDEX ONCE
     ========================= */

  useEffect(() => {
    if (!viewer) return;
    if (storeRef.current.ds) return;

    let cancelled = false;

    (async () => {
      try {
        const ds = await Cesium.GeoJsonDataSource.load(
          "/data/municipalities.geojson",
          {},
        );

        if (cancelled) return;

        viewer.dataSources.add(ds);
        storeRef.current.ds = ds;

        const index = new Map<string, Cesium.Entity[]>();

        for (const e of ds.entities.values) {
          // start hidden (you can change)
          if (e.polygon) {
            e.polygon.material = new Cesium.ColorMaterialProperty(
              Cesium.Color.LIGHTGREEN.withAlpha(0.25),
            );
            e.polygon.outline = new Cesium.ConstantProperty(true);
            e.polygon.outlineWidth = new Cesium.ConstantProperty(3);
            e.polygon.outlineColor = new Cesium.ColorMaterialProperty(
              Cesium.Color.RED,
            );
          }

          const names = extractEntityNames(e);
          for (const n of names) {
            for (const key of buildLookupKeys(n)) {
              const arr = index.get(key) ?? [];
              arr.push(e);
              index.set(key, arr);
            }
          }
        }

        storeRef.current.entitiesByKey = index;

        // console.log("indexed municipality keys:", index.size);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Failed to load municipalities GeoJSON:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [viewer]);

  /* =========================
     HIGHLIGHT
     ========================= */

  const applyHighlightToEntity = (e: Cesium.Entity) => {
    if (!e.polygon) return;

    if (!storeRef.current.originalMatByEntity.has(e)) {
      storeRef.current.originalMatByEntity.set(e, e.polygon.material);
    }

    e.polygon.material = new Cesium.ColorMaterialProperty(
      Cesium.Color.RED.withAlpha(0.35),
    );
    e.polygon.outline = new Cesium.ConstantProperty(true);
    e.polygon.outlineWidth = new Cesium.ConstantProperty(3);
    e.polygon.outlineColor = new Cesium.ConstantProperty(Cesium.Color.RED);
  };

  const restoreEntity = (e: Cesium.Entity) => {
    if (!e.polygon) return;

    e.polygon.material = new Cesium.ColorMaterialProperty(
      Cesium.Color.LIGHTGREEN.withAlpha(0.25),
    );
    e.polygon.outline = new Cesium.ConstantProperty(true);
    e.polygon.outlineWidth = new Cesium.ConstantProperty(3);

    e.polygon.outlineColor = new Cesium.ColorMaterialProperty(Cesium.Color.RED);

    storeRef.current.originalMatByEntity.delete(e);
  };

  // ✅ SIMPLE MATCH: try deterministic lookup keys only.
  const matchEntitiesForCity = (cityNameRaw: string): Cesium.Entity[] => {
    const index = storeRef.current.entitiesByKey;

    // Try raw keys
    for (const k of buildLookupKeys(cityNameRaw)) {
      const ents = index.get(k);
      if (ents?.length) return ents;
    }

    // Try base municipality keys explicitly (safe)
    const base = toBaseMunicipalityName(cityNameRaw);
    if (base && base !== cityNameRaw) {
      for (const k of buildLookupKeys(base)) {
        const ents = index.get(k);
        if (ents?.length) return ents;
      }
    }

    return [];
  };

  const highlightCity = (cityNameRaw: string) => {
    const ds = storeRef.current.ds;
    if (!ds) return;

    const baseName = toBaseMunicipalityName(cityNameRaw);
    const cityKey = normalize(baseName);

    const entities = matchEntitiesForCity(cityNameRaw);
    if (entities.length === 0) return;

    entities.forEach(applyHighlightToEntity);

    storeRef.current.lastEntitiesByCity.set(cityKey, entities);

    const prev = storeRef.current.timeoutByCity.get(cityKey);
    if (prev) window.clearTimeout(prev);

    const t = window.setTimeout(() => {
      const last = storeRef.current.lastEntitiesByCity.get(cityKey) ?? [];
      last.forEach(restoreEntity);

      storeRef.current.lastEntitiesByCity.delete(cityKey);
      storeRef.current.timeoutByCity.delete(cityKey);
    }, CITY_TTL_MS);

    storeRef.current.timeoutByCity.set(cityKey, t);
  };

  const clearAllCityHighlights = () => {
    for (const t of storeRef.current.timeoutByCity.values())
      window.clearTimeout(t);
    storeRef.current.timeoutByCity.clear();
    storeRef.current.lastEntitiesByCity.clear();

    for (const e of storeRef.current.originalMatByEntity.keys())
      restoreEntity(e);
    storeRef.current.originalMatByEntity.clear();
  };

  /* =========================
     WS
     ========================= */

  const connect = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket("ws://localhost:8080");
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (ev) => {
      let msg: any;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (msg.type === "oref_update") {
        const alert = msg.payload as Omit<AlertPayload, "time">;

        const withTime: AlertPayload = { ...alert, time: new Date() };
        setAlerts((prev) => [withTime, ...prev]);

        startBlink(withTime.id, 8000);
        playAlertSound();

        if (Array.isArray(withTime.data)) {
          for (const cityName of withTime.data) highlightCity(cityName);
        }
      }
    };

    ws.onclose = () => setConnected(false);
  };

  const nextAlert = () => wsRef.current?.send("next");

  const testAlert = () => {
    const payload: AlertPayload = {
      id: Date.now().toString(),
      cat: "99",
      title: "🚨 בדיקה",
      data: [
        // Golan + North-East
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

        // Upper Galilee / Panhandle
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

        // Western Galilee
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

        // Haifa / Krayot
        "חיפה",
        "קריית אתא",
        "קריית ביאליק",
        "קריית מוצקין",
        "קריית ים",
        "נשר",
        "טירת כרמל",

        // Tiberias + Kinneret area (for validation)
        "טבריה",
        "מגדל",
        "יבנאל",
      ],
      desc: "בדיקת מערכת",
      time: new Date(),
    };

    setAlerts((prev) => [payload, ...prev]);
    startBlink(payload.id, 8000);
    playAlertSound();

    payload.data.forEach((d) => highlightCity(d));
  };

  const clearAlerts = () => {
    setAlerts([]);
    setBlinking({});
    clearAllCityHighlights();

    Object.values(blinkTimeoutsRef.current).forEach((t) =>
      window.clearTimeout(t),
    );
    blinkTimeoutsRef.current = {};
  };

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();

      Object.values(blinkTimeoutsRef.current).forEach((t) =>
        window.clearTimeout(t),
      );
      blinkTimeoutsRef.current = {};

      clearAllCityHighlights();
      sirenRef.current?.dispose?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        padding: "20px",
        position: "absolute",
        top: 0,
        right: 0,
        width: "250px",
        height: "60vh",
        background: "#1d1d1dd0",
      }}
    >
      <style>{css}</style>

      <h2 style={{ marginBottom: 8, color: "#EAEAEAEA" }}>Oref Alert</h2>

      <div className="toolbar">
        <button onClick={connect} disabled={connected}>
          Connect WS
        </button>

        <button onClick={nextAlert} disabled={!connected}>
          Next Alert
        </button>

        <button onClick={testAlert}>Test Alert</button>

        <button onClick={clearAlerts}>Clear</button>

        <button onClick={enableSound} disabled={soundEnabled}>
          {soundEnabled ? "Sound Enabled" : "Enable Sound"}
        </button>

        <span
          style={{
            color: connected ? "#2ef369" : "#f31616",
            fontSize: 16,
            fontWeight: 900,
          }}
          className="status"
        >
          Status: {connected ? "🟢 connected" : "🔴 disconnected"}
        </span>
      </div>

      <div style={{ height: "40vh", overflowY: "auto", paddingRight: 6 }}>
        {alerts.map((a) => {
          const isNew = !!blinking[a.id];
          const time = a.time?.toLocaleTimeString?.() ?? "";
          playAlertSound();

          return (
            <div
              key={a.id}
              className={`alertCard ${isNew ? "alertCard--new" : ""}`}
            >
              <div className="alertHeader">
                <span className={`badge ${isNew ? "badge--danger" : ""}`}>
                  {isNew ? "NEW" : "ALERT"}
                </span>

                <div className="title">{a.title}</div>

                <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
                  {time}
                </div>
              </div>

              <div className="desc">{a.desc}</div>

              <div className="locations">
                <strong>Locations:</strong> {a.data.join(", ")}
              </div>
            </div>
          );
        })}

        {alerts.length === 0 && (
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            No alerts yet. Click <b>Test Alert</b> or wait for WS updates.
          </div>
        )}
      </div>
    </div>
  );
}
