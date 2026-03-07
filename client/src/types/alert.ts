/** OREF alert payload (from WebSocket or test). */
export type AlertPayload = {
  id: string;
  cat: string;
  title: string;
  data: string[];
  desc: string;
  time: Date;
};

/** Store for alert highlight state (place index + timeouts). */
export type HighlightStore = {
  placeIndexByCityKey: Map<string, string[]>;
  georefReadyPromise: Promise<void>;
  timeoutByCity: Map<string, number>;
};

/** GeoJSON feature types for statistical areas. */
export declare namespace GeoJSON {
  interface FeatureCollection {
    type: "FeatureCollection";
    features: Feature[];
  }
  interface Feature {
    type: "Feature";
    properties?: Record<string, unknown>;
    geometry?: unknown;
  }
}
