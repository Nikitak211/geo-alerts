/**
 * Raw OREF payload and normalized shapes. Raw JSON is only used inside ingest/.
 */

/** Raw OREF payload from API (alerts.json). Shape can vary. */
export interface RawOrefPayload {
  id?: string | number;
  title?: string;
  data?: string[];
  desc?: string;
  cat?: string;
  /** ISO datetime preferred */
  datetime?: string;
  alertDate?: string;
  alertTime?: string;
  /** DD.MM.YYYY */
  date?: string;
  /** HH:MM */
  time?: string;
}

/** Normalized alert emitted from ingest (WS broadcast / persistence). */
export interface NormalizedOrefAlert {
  id: string;
  title: string;
  data: string[];
  eventTime: string | null;
}

/** Single area + time for settlement/betting. */
export interface OrefAreaAlert {
  areaHeb: string;
  alertTime: string;
}
