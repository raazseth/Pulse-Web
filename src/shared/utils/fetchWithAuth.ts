function buildAuthHeaders(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

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
