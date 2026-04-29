import { AuthUser, TokenPair } from "@/modules/auth/types";
import { resolveHudApiBaseUrl } from "@/shared/utils/hudApiBaseUrl";

const LS_REFRESH = "pulse_refresh_token";

function apiBase(): string {
  return resolveHudApiBaseUrl();
}

export function clearStoredRefreshToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LS_REFRESH);
}

export function persistRefreshTokenFromPair(tokens: TokenPair): void {
  if (typeof window === "undefined") return;
  if (tokens.refreshToken) {
    window.localStorage.setItem(LS_REFRESH, tokens.refreshToken);
  } else {
    window.localStorage.removeItem(LS_REFRESH);
  }
}

interface AuthResult {
  user: AuthUser;
  tokens: TokenPair;
}

interface RefreshResult {
  accessToken: string;
  user: AuthUser;
  refreshToken?: string;
}

async function post<T>(path: string, body: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${apiBase()}/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Server error ${res.status}: unexpected response format`);
  }

  let json: { success: boolean; data: T; message: string };
  try {
    json = await res.json() as { success: boolean; data: T; message: string };
  } catch {
    throw new Error(`Server error ${res.status}: malformed JSON response`);
  }

  if (!res.ok) {
    const message = typeof json.message === "string" && json.message
      ? json.message
      : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return json.data;
}

export async function apiRegister(
  email: string,
  password: string,
  name: string,
): Promise<AuthResult> {
  return post<AuthResult>("/register", { email, password, name });
}

export async function apiLogin(email: string, password: string): Promise<AuthResult> {
  return post<AuthResult>("/login", { email, password });
}

export async function apiRefresh(): Promise<RefreshResult> {
  const stored =
    typeof window !== "undefined" ? window.localStorage.getItem(LS_REFRESH) : null;
  const body: Record<string, string> = stored ? { refreshToken: stored } : {};
  const data = await post<RefreshResult>("/refresh", body);
  if (typeof window !== "undefined" && data.refreshToken) {
    window.localStorage.setItem(LS_REFRESH, data.refreshToken);
  }
  return data;
}

export async function apiLogout(): Promise<void> {
  const stored =
    typeof window !== "undefined" ? window.localStorage.getItem(LS_REFRESH) : null;
  await fetch(`${apiBase()}/auth/logout`, {
    method: "DELETE",
    headers: stored ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: stored ? JSON.stringify({ refreshToken: stored }) : undefined,
  });
  clearStoredRefreshToken();
}
