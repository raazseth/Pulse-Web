import { AuthUser, TokenPair } from "@/modules/auth/types";
import { resolveHudApiBaseUrl } from "@/shared/utils/hudApiBaseUrl";

const BASE = resolveHudApiBaseUrl();

interface AuthResult {
  user: AuthUser;
  tokens: TokenPair;
}

interface RefreshResult {
  accessToken: string;
  user: AuthUser;
}

async function post<T>(path: string, body: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${BASE}/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // credentials: "include" sends httpOnly cookies so the server can read
    // the refresh token without it ever being accessible to JavaScript.
    credentials: "include",
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    // Server returned HTML (e.g. nginx error page) — surface a clear message.
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

// No arguments: the refresh token is sent automatically as an httpOnly cookie.
export async function apiRefresh(): Promise<RefreshResult> {
  return post<RefreshResult>("/refresh");
}

export async function apiLogout(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, {
    method: "DELETE",
    credentials: "include",
  });
}
