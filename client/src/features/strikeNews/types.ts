/**
 * Strike news: articles about strikes in Iran / Gulf / region (excl. Israel).
 */

export type StrikeNewsArticle = {
  id: string;
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  sourceName: string;
  /** Place name extracted from title/description (e.g. "Tehran", "Riyadh"). */
  placeName: string | null;
};

export type StrikeNewsItem = StrikeNewsArticle & {
  /** Geocoded coordinates for map billboard. */
  lat: number;
  lon: number;
};
