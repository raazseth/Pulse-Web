const CLOUD_RUN_ORIGIN = "https://pulse-server-970597358569.europe-west1.run.app";

export type AppMode = "local" | "development" | "production";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function inferMode(): AppMode {
  if (import.meta.env.MODE === "test") return "local";
  const raw = import.meta.env.VITE_APP_MODE?.trim().toLowerCase();
  if (raw === "production" || raw === "prod") return "production";
  if (raw === "local") return "local";
  if (raw === "dev" || raw === "development") return "development";
  return "development";
}

function toWebSocketOrigin(httpOrigin: string): string {
  const url = new URL(httpOrigin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return trimTrailingSlash(url.toString());
}

export function getElectronEmbeddedServerPort(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const p = (window as { api?: { serverPort?: number } }).api?.serverPort;
  return typeof p === "number" && Number.isFinite(p) && p > 0 ? p : undefined;
}

export function resolveHudApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_HUD_API_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return trimTrailingSlash(fromEnv.trim());
  }

  const mode = inferMode();
  if (mode === "local") {
    const p = getElectronEmbeddedServerPort();
    if (p) return `http://localhost:${p}/api/v1`;
    return "http://localhost:3000/api/v1";
  }

  if (mode === "production") {
    // Vercel (or any same-origin host): vercel.json rewrites /api/* → Cloud Run so auth cookies stay first-party.
    return "/api/v1";
  }

  return `${CLOUD_RUN_ORIGIN}/api/v1`;
}

export function resolveTranscriptWsUrl(): string {
  const fromEnv = import.meta.env.VITE_TRANSCRIPT_WS_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return trimTrailingSlash(fromEnv.trim());
  }

  const mode = inferMode();
  if (mode === "local") {
    const p = getElectronEmbeddedServerPort();
    if (p) return `ws://localhost:${p}/ws/transcript`;
    return "ws://localhost:3000/ws/transcript";
  }

  return `${toWebSocketOrigin(CLOUD_RUN_ORIGIN)}/ws/transcript`;
}

export function getRuntimeApiConfig() {
  return {
    mode: inferMode(),
    apiBaseUrl: resolveHudApiBaseUrl(),
    transcriptWsUrl: resolveTranscriptWsUrl(),
  };
}
