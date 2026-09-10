/** Short tooltip / extractive summary (no LLM). Max ~120 chars. */
export function summarizeNews(
  title: string,
  domain?: string,
  maxLen = 120
): string {
  const domainBit = domain?.trim() ? ` · ${domain.trim()}` : "";
  const raw = `${title.trim()}${domainBit}`;
  if (raw.length <= maxLen) return raw;
  return raw.slice(0, Math.max(0, maxLen - 3)).trimEnd() + "...";
}
