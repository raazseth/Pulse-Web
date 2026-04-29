import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/modules/auth/hooks/useAuthStore";
import { fetchWithAuth } from "@/shared/utils/fetchWithAuth";
import { getHudSessionsUrl, getHudSessionUrl, getHudSessionStatusUrl } from "@/shared/utils/hudApi";
import { SessionStatus } from "@/modules/context/types";
import type { HudApiFullSnapshot, HudSessionsListPayload } from "@/modules/context/types/hudApiSnapshot";

export interface SessionSummary {
  id: string;
  title: string;
  status: SessionStatus;
  noteCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateSessionPayload {
  title: string;
  facilitator?: string;
  audience?: string;
  role?: string;
}

interface SessionListContextValue {
  sessions: SessionSummary[];
  loading: boolean;
  listLoadSucceeded: boolean;
  lastActiveSessionId: string | null;
  refetch: () => Promise<void>;
  createSession: (payload: CreateSessionPayload) => Promise<SessionSummary>;
  getSession: (id: string) => Promise<SessionSummary | null>;
  fetchSessionSnapshot: (id: string) => Promise<HudApiFullSnapshot | null>;
  updateSessionStatus: (sessionId: string, status: SessionStatus) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
}

function parseSessionsListPayload(data: unknown): HudSessionsListPayload {
  if (Array.isArray(data)) {
    const sessions = data as SessionSummary[];
    const active = sessions.find((s) => s.status === "active");
    return {
      sessions,
      lastActiveSessionId: (active ?? sessions[0])?.id ?? null,
    };
  }
  const o = (data ?? {}) as Partial<HudSessionsListPayload>;
  return {
    sessions: Array.isArray(o.sessions) ? o.sessions : [],
    lastActiveSessionId: o.lastActiveSessionId ?? null,
  };
}

function isFullSessionSnapshot(data: unknown): data is HudApiFullSnapshot {
  return Boolean(
    data &&
      typeof data === "object" &&
      "session" in data &&
      (data as HudApiFullSnapshot).session &&
      typeof (data as HudApiFullSnapshot).session.id === "string",
  );
}

const Ctx = createContext<SessionListContextValue | null>(null);

function canListSessionsWithToken(accessToken: string | null): accessToken is string {
  return Boolean(accessToken);
}

export function SessionListProvider({ children }: PropsWithChildren) {
  const { accessToken, refreshAccessToken } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [listLoadSucceeded, setListLoadSucceeded] = useState(false);
  const [lastActiveSessionId, setLastActiveSessionId] = useState<string | null>(null);
  const getToken = useCallback(() => accessToken, [accessToken]);

  const refetch = useCallback(async () => {
    if (!canListSessionsWithToken(accessToken)) {
      setSessions([]);
      setListLoadSucceeded(false);
      setLoading(false);
      return;
    }
    const tokenAtStart = accessToken;
    setLoading(true);
    setListLoadSucceeded(false);
    try {
      const res = await fetchWithAuth(getHudSessionsUrl(), {}, getToken, refreshAccessToken);
      if (getToken() !== tokenAtStart) {
        return;
      }
      if (!res.ok) {
        return;
      }
      const json = await res.json() as { data?: unknown; lastActiveSessionId?: string | null };
      const parsed = parseSessionsListPayload(json.data);
      if (!parsed.lastActiveSessionId && json.lastActiveSessionId) {
        parsed.lastActiveSessionId = json.lastActiveSessionId;
      }
      setSessions(parsed.sessions);
      setLastActiveSessionId(parsed.lastActiveSessionId);
      setListLoadSucceeded(true);
    } finally {
      setLoading(false);
    }
  }, [accessToken, getToken, refreshAccessToken]);

  const lastSessionFetchToken = useRef<string | null>(null);

  useEffect(() => {
    if (!canListSessionsWithToken(accessToken)) {
      lastSessionFetchToken.current = null;
      setSessions([]);
      setListLoadSucceeded(false);
      setLastActiveSessionId(null);
      return;
    }
    if (lastSessionFetchToken.current !== accessToken) {
      lastSessionFetchToken.current = accessToken;
      setSessions([]);
      setListLoadSucceeded(false);
      setLastActiveSessionId(null);
    }
    refetch().catch(() => {
      setListLoadSucceeded(false);
    });
  }, [accessToken, refetch]);

  const createSession = useCallback(
    async (payload: CreateSessionPayload): Promise<SessionSummary> => {
      const res = await fetchWithAuth(
        getHudSessionsUrl(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        getToken,
        refreshAccessToken,
      );
      if (!res.ok) throw new Error(`Create session failed (${res.status})`);
      const json = await res.json() as { data?: SessionSummary };
      const created = json.data!;
      await refetch();
      return created;
    },
    [getToken, refreshAccessToken, refetch],
  );

  const getSession = useCallback(
    async (id: string): Promise<SessionSummary | null> => {
      const res = await fetchWithAuth(getHudSessionUrl(id), {}, getToken, refreshAccessToken);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Get session failed (${res.status})`);
      const json = await res.json() as { data?: unknown };
      const data = json.data;
      if (isFullSessionSnapshot(data)) {
        return {
          id: data.session.id,
          title: data.session.title,
          status: data.session.status,
          noteCount: 0,
          createdAt: data.session.createdAt,
        };
      }
      return null;
    },
    [getToken, refreshAccessToken],
  );

  const fetchSessionSnapshot = useCallback(
    async (id: string): Promise<HudApiFullSnapshot | null> => {
      const res = await fetchWithAuth(getHudSessionUrl(id), {}, getToken, refreshAccessToken);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Get session failed (${res.status})`);
      const json = await res.json() as { data?: unknown };
      return isFullSessionSnapshot(json.data) ? json.data : null;
    },
    [getToken, refreshAccessToken],
  );

  const updateSessionStatus = useCallback(
    async (sessionId: string, status: SessionStatus): Promise<void> => {
      const res = await fetchWithAuth(
        getHudSessionStatusUrl(sessionId),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
        getToken,
        refreshAccessToken,
      );
      if (!res.ok) throw new Error(`Update status failed (${res.status})`);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, status } : s)));
    },
    [getToken, refreshAccessToken],
  );

  const deleteSession = useCallback(
    async (sessionId: string): Promise<void> => {
      const res = await fetchWithAuth(
        getHudSessionUrl(sessionId),
        { method: "DELETE" },
        getToken,
        refreshAccessToken,
      );
      if (!res.ok) throw new Error(`Delete session failed (${res.status})`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    },
    [getToken, refreshAccessToken],
  );

  return (
    <Ctx.Provider
      value={{
        sessions,
        loading,
        listLoadSucceeded,
        lastActiveSessionId,
        refetch,
        createSession,
        getSession,
        fetchSessionSnapshot,
        updateSessionStatus,
        deleteSession,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSessionList() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSessionList must be used within SessionListProvider");
  return ctx;
}
