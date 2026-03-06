// citiesLayer.ts
import * as Cesium from "cesium";

export async function loadMunicipalities(viewer: Cesium.Viewer) {
  const ds = await Cesium.GeoJsonDataSource.load(
    "/data/israel-municipalities.geojson",
    {
      stroke: Cesium.Color.ORANGE,
      fill: Cesium.Color.ORANGE.withAlpha(0.25),
      strokeWidth: 2,
    },
  );

  viewer.dataSources.add(ds);
  return ds;
}

type HighlightStore = {
  // keep the original polygon material so we can restore it
  originalByCity: Map<string, Cesium.MaterialProperty | undefined>;
  // timeout per city (to auto-clear)
  timeoutByCity: Map<string, number>;
};

export function createHighlightStore(): HighlightStore {
  return {
    originalByCity: new Map(),
    timeoutByCity: new Map(),
  };
}

export function highlightCityWithAutoClear(
  ds: Cesium.GeoJsonDataSource,
  store: HighlightStore,
  cityNameHe: string,
  ttlMs = 60_000,
) {
  const entities = ds.entities.values;

  // find matching entity by Hebrew name property
  const target = entities.find((e) => {
    const name = e.properties?.name_he?.getValue?.();
    return name === cityNameHe;
  });

  if (!target?.polygon) return; // not found or not a polygon

  // store original material once
  if (!store.originalByCity.has(cityNameHe)) {
    store.originalByCity.set(cityNameHe, target.polygon.material);
  }

  // apply highlight
  target.polygon.material = Cesium.Color.RED.withAlpha(
    0.5,
  ) as unknown as Cesium.MaterialProperty;

  // refresh timeout (extend if called again)
  const prevTimeout = store.timeoutByCity.get(cityNameHe);
  if (prevTimeout) window.clearTimeout(prevTimeout);

  const t = window.setTimeout(() => {
    // restore original material (if entity still exists)
    const original = store.originalByCity.get(cityNameHe);
    const stillThere = ds.entities.values.find((e) => {
      const name = e.properties?.name_he?.getValue?.();
      return name === cityNameHe;
    });

    if (stillThere && stillThere?.polygon && original) {
      stillThere.polygon.material = original;
    }

    store.timeoutByCity.delete(cityNameHe);
    store.originalByCity.delete(cityNameHe);
  }, ttlMs);

  store.timeoutByCity.set(cityNameHe, t);
}

export function clearAllHighlights(
  ds: Cesium.GeoJsonDataSource,
  store: HighlightStore,
) {
  // stop timers
  for (const t of store.timeoutByCity.values()) window.clearTimeout(t);
  store.timeoutByCity.clear();

  // restore any originals we still know about
  for (const [cityNameHe, original] of store.originalByCity.entries()) {
    const e = ds.entities.values.find(
      (x) => x.properties?.name_he?.getValue?.() === cityNameHe,
    );
    if (e?.polygon && original) e.polygon.material = original;
  }
  store.originalByCity.clear();
}
