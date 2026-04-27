import { DESKTOP_SENTINEL } from "@/shared/constants/auth";

function buildAuthHeaders(token: string | null): Record<string, string> {
  if (!token || token === DESKTOP_SENTINEL) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * Fetch wrapper that automatically retries once on 401 using the provided
 * refreshToken callback. Callers must still check res.ok on the returned
 * Response — this only handles token refresh, not response parsing.
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit,
  getToken: () => string | null,
  refreshToken: () => Promise<string | null>,
): Promise<Response> {
  const request = (token: string | null) =>
    fetch(url, {
      ...options,
      headers: { ...options.headers, ...buildAuthHeaders(token) },
    });

  let res = await request(getToken());

  if (res.status === 401) {
    const newToken = await refreshToken();
    if (newToken) {
      res = await request(newToken);
    }
  }

  return res;
}
