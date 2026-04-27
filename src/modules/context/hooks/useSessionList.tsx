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

export interface SessionSummary {
  id: string;
  title: string;
  status: SessionStatus;
  noteCount: number;
  createdAt: string;
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
  refetch: () => Promise<void>;
  createSession: (payload: CreateSessionPayload) => Promise<SessionSummary>;
  getSession: (id: string) => Promise<SessionSummary | null>;
  updateSessionStatus: (sessionId: string, status: SessionStatus) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
}

const Ctx = createContext<SessionListContextValue | null>(null);

export function SessionListProvider({ children }: PropsWithChildren) {
  const { accessToken, refreshAccessToken } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const getToken = useCallback(() => accessToken, [accessToken]);
  const didFetch = useRef(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(getHudSessionsUrl(), {}, getToken, refreshAccessToken);
      if (!res.ok) return;
      const json = await res.json() as { data?: SessionSummary[] };
      setSessions(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [getToken, refreshAccessToken]);

  useEffect(() => {
    if (!accessToken || didFetch.current) return;
    didFetch.current = true;
    setLoading(true);
    refetch().catch(() => {});
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
      const json = await res.json() as { data?: SessionSummary };
      return json.data ?? null;
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
    <Ctx.Provider value={{ sessions, loading, refetch, createSession, getSession, updateSessionStatus, deleteSession }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSessionList() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSessionList must be used within SessionListProvider");
  return ctx;
}
