import { useEffect, useState } from "react";
import { Alert, Box } from "@mui/material";
import {
  isEmbeddedLocalHudMode,
  isNonLocalAbsoluteHudApi,
  resolveHudApiHealthProbeUrl,
} from "@/shared/utils/hudApiBaseUrl";

const SESSION_DISMISS_KEY = "pulse-hud-cloud-unreachable-dismissed";

export function HudConnectivityBanner() {
  const [embedded] = useState(() => isEmbeddedLocalHudMode());
  const [cloudUnreachable, setCloudUnreachable] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
  });

  useEffect(() => {
    if (embedded || dismissed) return;
    if (!isNonLocalAbsoluteHudApi()) return;
    const url = resolveHudApiHealthProbeUrl();
    if (!url) return;
    let cancelled = false;
    fetch(url, { method: "GET", signal: AbortSignal.timeout(6000) })
      .then((r) => {
        if (!cancelled && !r.ok) setCloudUnreachable(true);
      })
      .catch(() => {
        if (!cancelled) setCloudUnreachable(true);
      });
    return () => {
      cancelled = true;
    };
  }, [embedded, dismissed]);

  if (embedded) {
    return (
      <Box sx={{ px: 2, pt: 1.5 }}>
        <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
          Embedded HUD server: API, WebSocket, and mic capture use <strong>127.0.0.1</strong> only. Cloud Run and
          Vercel HUD endpoints are ignored while this desktop session is running.
        </Alert>
      </Box>
    );
  }

  if (!cloudUnreachable || dismissed) return null;

  return (
    <Box sx={{ px: 2, pt: 1.5 }}>
      <Alert
        severity="warning"
        variant="outlined"
        onClose={() => {
          sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
          setDismissed(true);
        }}
        sx={{ py: 0.5 }}
      >
        The remote HUD host did not respond. Check your network or VPN, or switch to a reachable API URL in your
        environment.
      </Alert>
    </Box>
  );
}
