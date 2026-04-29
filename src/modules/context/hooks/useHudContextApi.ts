import { useCallback, useMemo } from "react";
import { fetchWithAuth } from "@/shared/utils/fetchWithAuth";
import { getHudContextUrl } from "@/shared/utils/hudApi";

interface UseHudContextApiOptions {
  sessionId: string;
  accessToken: string | null;
  refreshAccessToken: () => Promise<string | null>;
}

   
                                                                                                                                           
   
export function useHudContextApi({
  sessionId,
  accessToken,
  refreshAccessToken,
}: UseHudContextApiOptions) {
  const getToken = useCallback(() => accessToken, [accessToken]);

  const patchContext = useCallback(
    async (context: Record<string, string>): Promise<void> => {
      if (!sessionId) return;
      const res = await fetchWithAuth(
        getHudContextUrl(sessionId),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context }),
        },
        getToken,
        refreshAccessToken,
      );
      if (!res.ok) throw new Error(`Update context failed (${res.status})`);
    },
    [sessionId, getToken, refreshAccessToken],
  );

  return useMemo(() => ({ patchContext }), [patchContext]);
}
