import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiLogin, apiLogout, apiRefresh, apiRegister } from "@/modules/auth/api/authApi";
import { AuthState, AuthUser, TokenPair } from "@/modules/auth/types";
import { DESKTOP_SENTINEL } from "@/shared/constants/auth";

// Access token: React state only (memory). Never persisted.
// Refresh token: httpOnly, Secure, SameSite=Strict cookie set by the server.
//   The client never reads or writes it — it travels automatically via
//   credentials: "include" on every auth request.
// User display info: localStorage (not sensitive, used only for UI rendering).
const LS_USER = "pulse_user";

function isElectron(): boolean {
  return typeof window !== "undefined" && "api" in window;
}

function loadStoredUser(): AuthUser | null {
  try {
    return JSON.parse(localStorage.getItem(LS_USER) ?? "null") as AuthUser | null;
  } catch {
    return null;
  }
}

function persistUser(user: AuthUser) {
  localStorage.setItem(LS_USER, JSON.stringify(user));
}

function clearStorage() {
  localStorage.removeItem(LS_USER);
}

const DESKTOP_USER: AuthUser = {
  id: "local",
  email: "local@pulse.app",
  name: "Local User",
  createdAt: new Date().toISOString(),
};

interface AuthContext extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Attempt a silent token refresh via the httpOnly cookie. Returns the new
   *  access token, or null if the cookie is absent/expired (user must re-login). */
  refreshAccessToken: () => Promise<string | null>;
}

const Ctx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>(() => {
    if (isElectron()) {
      return { user: DESKTOP_USER, accessToken: DESKTOP_SENTINEL, isLoading: false };
    }
    return { accessToken: null, user: loadStoredUser(), isLoading: true };
  });

  // On mount, silently refresh using the httpOnly cookie. The browser sends the
  // cookie automatically (credentials: "include" is set in authApi). If the
  // cookie is absent or expired the call fails and we clear state.
  useEffect(() => {
    if (isElectron()) return;

    apiRefresh()
      .then(({ accessToken, user }) => {
        persistUser(user);
        setState({ accessToken, user, isLoading: false });
      })
      .catch(() => {
        clearStorage();
        setState({ accessToken: null, user: null, isLoading: false });
      });
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (isElectron()) return DESKTOP_SENTINEL;
    try {
      const { accessToken, user } = await apiRefresh();
      persistUser(user);
      setState((s) => ({ ...s, accessToken, user }));
      return accessToken;
    } catch {
      clearStorage();
      setState({ user: null, accessToken: null, isLoading: false });
      return null;
    }
  }, []);

  // Proactively refresh the access token before it expires (TTL is 15 min,
  // refresh every 12 min) so WebSocket reconnects and API calls always have
  // a valid token — avoids the "expired token → 401 → reconnect loop" failure.
  useEffect(() => {
    if (isElectron() || !state.user) return;
    const id = setInterval(refreshAccessToken, 12 * 60 * 1000);
    return () => clearInterval(id);
  }, [state.user, refreshAccessToken]);

  const login = useCallback(async (email: string, password: string) => {
    const { user, tokens } = await apiLogin(email, password);
    // The server sets the refresh token as an httpOnly cookie in the response.
    // We only store the user (display info) and keep the access token in state.
    persistUser(user);
    setState({ user, accessToken: tokens.accessToken, isLoading: false });
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { user, tokens } = await apiRegister(email, password, name);
    persistUser(user);
    setState({ user, accessToken: tokens.accessToken, isLoading: false });
  }, []);

  const logout = useCallback(async () => {
    if (!isElectron()) {
      // Server receives the httpOnly cookie and invalidates it server-side.
      await apiLogout().catch(() => undefined);
    }
    clearStorage();
    setState({ user: null, accessToken: null, isLoading: false });
  }, []);

  return (
    <Ctx.Provider value={{ ...state, login, register, logout, refreshAccessToken }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
