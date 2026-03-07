import { useEffect, useState } from "react";

const OREF_AREAS_URL = "/data/cities.json";

export function useOrefAreas(): {
  areas: string[];
  loading: boolean;
  error: string | null;
} {
  const [areas, setAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(OREF_AREAS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load areas: ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const names = list
          .filter(
            (x): x is { name?: string; value?: string; id?: number } =>
              x != null && typeof x === "object" && (x as any).value !== "all"
          )
          .map((x) => (typeof x.value === "string" ? x.value : x.name))
          .filter((name): name is string => typeof name === "string" && name.length > 0);
        setAreas(names);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "Failed to load areas");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { areas, loading, error };
}
