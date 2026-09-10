import type { NewsType } from "./types";
import { tactical } from "../../theme";

export const NEWS_TYPE_LABEL: Record<NewsType, string> = {
  conflict: "CONFLICT",
  diplomacy: "DIPLOMACY",
  security: "SECURITY",
  humanitarian: "HUMANITARIAN",
  politics: "POLITICS",
};

export const NEWS_TYPE_COLOR: Record<NewsType, string> = {
  conflict: tactical.alertRed,
  diplomacy: tactical.olive,
  security: tactical.amber,
  humanitarian: "#5a8f9c",
  politics: tactical.phosphorMuted,
};

const CONFLICT_KW = [
  "missile",
  "strike",
  "attack",
  "bomb",
  "rocket",
  "war",
  "shell",
  "explosion",
  "killed",
  "airstrike",
  "combat",
  "invade",
  "invasion",
  "offensive",
];
const DIPLOMACY_KW = [
  "ceasefire",
  "talks",
  "diplomat",
  "negotiation",
  "treaty",
  "summit",
  "envoy",
  "peace",
  "accord",
  "mediation",
  "ambassador",
];
const SECURITY_KW = [
  "security",
  "terror",
  "intel",
  "intercept",
  "defense",
  "defence",
  "border",
  "checkpoint",
  "arrest",
  "raid",
  "militia",
];
const HUMANITARIAN_KW = [
  "aid",
  "refugee",
  "humanitarian",
  "hospital",
  "civilian",
  "evacuate",
  "evacuation",
  "relief",
  "displaced",
  "famine",
  "unrwa",
];

function hasAny(hay: string, needles: string[]): boolean {
  return needles.some((n) => hay.includes(n));
}

/** Keyword classifier — mirrors server NewsTypeClassifier. */
export function classifyNewsType(title: string | null | undefined): NewsType {
  if (!title?.trim()) return "politics";
  const lower = title.toLowerCase();
  if (hasAny(lower, CONFLICT_KW)) return "conflict";
  if (hasAny(lower, DIPLOMACY_KW)) return "diplomacy";
  if (hasAny(lower, SECURITY_KW)) return "security";
  if (hasAny(lower, HUMANITARIAN_KW)) return "humanitarian";
  return "politics";
}
