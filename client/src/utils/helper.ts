const API_BASE = "http://localhost:8090";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const userId = localStorage.getItem("userId");

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-user-id": userId } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}
