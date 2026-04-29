import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  apiLogin,
  apiLogout,
  apiRefresh,
  apiRegister,
  clearStoredRefreshToken,
  persistRefreshTokenFromPair,
} from "@/modules/auth/api/authApi";
import { AuthState, AuthUser } from "@/modules/auth/types";


const LS_USER = "pulse_user";

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
  clearStoredRefreshToken();
}

interface AuthContext extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
}

const Ctx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>(() => ({
    accessToken: null,
    user: loadStoredUser(),
    isLoading: true,
  }));

  useEffect(() => {
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

  useEffect(() => {
    if (!state.user) return;
    const id = setInterval(refreshAccessToken, 12 * 60 * 1000);
    return () => clearInterval(id);
  }, [state.user, refreshAccessToken]);

  const login = useCallback(async (email: string, password: string) => {
    const { user, tokens } = await apiLogin(email, password);
    persistRefreshTokenFromPair(tokens);
    persistUser(user);
    setState({ user, accessToken: tokens.accessToken, isLoading: false });
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { user, tokens } = await apiRegister(email, password, name);
    persistRefreshTokenFromPair(tokens);
    persistUser(user);
    setState({ user, accessToken: tokens.accessToken, isLoading: false });
  }, []);

  const logout = useCallback(async () => {
    await apiLogout().catch(() => undefined);
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

export function useOptionalAuth(): AuthContext | null {
  return useContext(Ctx);
}
