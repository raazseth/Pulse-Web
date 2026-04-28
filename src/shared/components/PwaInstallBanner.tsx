import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, IconButton, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import GetAppRoundedIcon from "@mui/icons-material/GetAppRounded";

const DISMISS_KEY = "pulse-pwa-install-dismissed";

type ChromiumInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

export function PwaInstallBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [deferredPrompt, setDeferredPrompt] = useState<ChromiumInstallPrompt | null>(null);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as ChromiumInstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  }, []);

  const installChromium = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch {}
    setDeferredPrompt(null);
    dismiss();
  }, [deferredPrompt, dismiss]);

  if (dismissed || isStandalone()) return null;

  if (isIos()) {
    return (
      <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 0 }}>
        <Alert
          severity="info"
          icon={<GetAppRoundedIcon fontSize="inherit" />}
          action={
            <IconButton size="small" aria-label="Dismiss install hint" onClick={dismiss} edge="end">
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          }
          sx={{ borderRadius: "12px", alignItems: "flex-start" }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Install Pulse on this device
          </Typography>
          <Typography variant="body2" color="text.secondary">
            In Safari, tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>, then Open. You will get a full-screen app and faster reloads.
          </Typography>
        </Alert>
      </Box>
    );
  }

  if (deferredPrompt) {
    return (
      <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 0 }}>
        <Alert
          severity="success"
          icon={<GetAppRoundedIcon fontSize="inherit" />}
          action={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Button size="small" variant="contained" onClick={installChromium} sx={{ borderRadius: "10px", textTransform: "none", fontWeight: 600 }}>
                Install
              </Button>
              <IconButton size="small" aria-label="Dismiss" onClick={dismiss}>
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Box>
          }
          sx={{ borderRadius: "12px" }}
        >
          <Typography variant="body2">Install Pulse as an app for quick access and offline shell caching.</Typography>
        </Alert>
      </Box>
    );
  }

  return null;
}
