import { useCallback, useMemo } from "react";
import { fetchWithAuth } from "@/shared/utils/fetchWithAuth";
import { getHudContextUrl } from "@/shared/utils/hudApi";

interface UseHudContextApiOptions {
  sessionId: string;
  accessToken: string | null;
  refreshAccessToken: () => Promise<string | null>;
}

/**
 * PATCH /hud/sessions/:id/context — merges `context` JSON and updates title/facilitator/audience/role columns when those keys are present.
 */
export function useHudContextApi({
  sessionId,
  accessToken,
  refreshAccessToken,
}: UseHudContextApiOptions) {
  const getToken = useCallback(() => accessToken, [accessToken]);

  const patchContext = useCallback(
    async (context: Record<string, string>): Promise<void> => {
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
