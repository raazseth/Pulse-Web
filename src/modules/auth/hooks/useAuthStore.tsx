import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
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
import { clearHudLocalStorageForUser } from "@/modules/context/utils/clearHudClientCache";
import { deleteTranscriptDatabase } from "@/shared/services/sessionIdb";
import { isElectronPipSatellite } from "@/shared/utils/electronPipSatellite";

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

function readUserIdFromLocalStorage(): string | undefined {
  try {
    const raw = localStorage.getItem(LS_USER);
    const u = raw ? (JSON.parse(raw) as { id?: string }) : null;
    return typeof u?.id === "string" ? u.id : undefined;
  } catch {
    return undefined;
  }
}

/** Clear auth tokens, HUD localStorage, and transcript IDB (used on logout and failed auth). */
function clearStorageAndHudCaches() {
  const uid = readUserIdFromLocalStorage();
  clearHudLocalStorageForUser(uid);
  localStorage.removeItem(LS_USER);
  clearStoredRefreshToken();
  void deleteTranscriptDatabase().catch(() => {});
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

  const userRef = useRef(state.user);
  userRef.current = state.user;

  const hydrateGeneration = useRef(0);

  const bumpHydrateGeneration = useCallback(() => {
    hydrateGeneration.current += 1;
  }, []);

  useEffect(() => {
    const gen = hydrateGeneration.current;
    apiRefresh()
      .then(({ accessToken, user }) => {
        if (gen !== hydrateGeneration.current) return;
        persistUser(user);
        setState({ accessToken, user, isLoading: false });
      })
      .catch(() => {
        if (gen !== hydrateGeneration.current) return;
        if (isElectronPipSatellite()) {
          setState({
            accessToken: null,
            user: loadStoredUser(),
            isLoading: false,
          });
          return;
        }
        clearStorageAndHudCaches();
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
      if (!isElectronPipSatellite()) {
        clearStorageAndHudCaches();
      }
      setState((s) => ({
        ...s,
        user: isElectronPipSatellite() ? loadStoredUser() : null,
        accessToken: null,
        isLoading: false,
      }));
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
    bumpHydrateGeneration();
    persistRefreshTokenFromPair(tokens);
    persistUser(user);
    clearHudLocalStorageForUser(undefined);
    setState({ user, accessToken: tokens.accessToken, isLoading: false });
  }, [bumpHydrateGeneration]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { user, tokens } = await apiRegister(email, password, name);
    bumpHydrateGeneration();
    persistRefreshTokenFromPair(tokens);
    persistUser(user);
    clearHudLocalStorageForUser(undefined);
    setState({ user, accessToken: tokens.accessToken, isLoading: false });
  }, [bumpHydrateGeneration]);

  const logout = useCallback(async () => {
    const signingOutId = userRef.current?.id;
    bumpHydrateGeneration();
    await apiLogout().catch(() => undefined);
    clearHudLocalStorageForUser(signingOutId);
    localStorage.removeItem(LS_USER);
    clearStoredRefreshToken();
    void deleteTranscriptDatabase().catch(() => {});
    setState({ user: null, accessToken: null, isLoading: false });
  }, [bumpHydrateGeneration]);

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
