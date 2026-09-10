export type NewsType =
  | "conflict"
  | "diplomacy"
  | "security"
  | "humanitarian"
  | "politics";

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  lat: number;
  lon: number;
  type: NewsType;
  seenAt: string;
  domain: string;
  imageUrl?: string | null;
};

export type NewsCluster = {
  kind: "cluster";
  id: string;
  type: NewsType;
  lat: number;
  lon: number;
  count: number;
  items: NewsItem[];
  cellKey: string;
};

export type NewsLeaf = {
  kind: "leaf";
  id: string;
  item: NewsItem;
};

export type NewsMapEntity = NewsCluster | NewsLeaf;
