import { useCallback, useState } from "react";
import { fetchWithAuth } from "@/shared/utils/fetchWithAuth";
import { getHudSessionsUrl, getHudSessionUrl, getHudSessionStatusUrl } from "@/shared/utils/hudApi";
import { SessionStatus } from "@/modules/context/types";

export type { SessionStatus };

export interface SessionSummary {
  id: string;
  title: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateSessionPayload {
  title: string;
  facilitator?: string;
  audience?: string;
  role?: string;
}

interface UseSessionApiOptions {
  accessToken: string | null;
  refreshAccessToken: () => Promise<string | null>;
}

export function useSessionApi({ accessToken, refreshAccessToken }: UseSessionApiOptions) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading]   = useState(false);

  const getToken = useCallback(() => accessToken, [accessToken]);

  const listSessions = useCallback(async (): Promise<SessionSummary[]> => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(getHudSessionsUrl(), {}, getToken, refreshAccessToken);
      if (!res.ok) return [];
      const json = await res.json() as { data?: SessionSummary[] | { sessions?: SessionSummary[] } };
      const data = Array.isArray(json.data) ? json.data : json.data?.sessions ?? [];
      setSessions(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, [getToken, refreshAccessToken]);

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
      const session = json.data!;
      setSessions((prev) => [session, ...prev]);
      return session;
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
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status } : s)),
      );
    },
    [getToken, refreshAccessToken],
  );

  return { sessions, loading, listSessions, getSession, createSession, updateSessionStatus };
}
