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

export function isEmbeddedLocalHudMode(): boolean {
  return getElectronEmbeddedServerPort() !== undefined;
}

function embeddedLocalApiBase(port: number): string {
  return `http://127.0.0.1:${port}/api/v1`;
}

function embeddedLocalTranscriptWs(port: number): string {
  return `ws://127.0.0.1:${port}/ws/transcript`;
}

function isFileDocument(): boolean {
  if (typeof window === "undefined") return false;
  const { protocol, href } = window.location;
  return protocol === "file:" || href.startsWith("file:");
}

export function resolveHudApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_HUD_API_URL;

  if (isFileDocument()) {
    const p = getElectronEmbeddedServerPort();
    if (p) return `http://127.0.0.1:${p}/api/v1`;
    if (typeof fromEnv === "string" && fromEnv.trim().startsWith("http")) {
      return trimTrailingSlash(fromEnv.trim());
    }
    return `${CLOUD_RUN_ORIGIN}/api/v1`;
  }

  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return trimTrailingSlash(fromEnv.trim());
  }

  const mode = inferMode();
  if (mode === "local") {
    const p = getElectronEmbeddedServerPort();
    if (p) return `http://127.0.0.1:${p}/api/v1`;
    return "http://localhost:3000/api/v1";
  }

  if (mode === "production") {
    return "/api/v1";
  }

  return `${CLOUD_RUN_ORIGIN}/api/v1`;
}

export function resolveTranscriptWsUrl(): string {
  const embeddedPort = getElectronEmbeddedServerPort();
  if (embeddedPort) {
    return embeddedLocalTranscriptWs(embeddedPort);
  }

  const fromEnv = import.meta.env.VITE_TRANSCRIPT_WS_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return trimTrailingSlash(fromEnv.trim());
  }

  if (isFileDocument()) {
    return `${toWebSocketOrigin(CLOUD_RUN_ORIGIN)}/ws/transcript`;
  }

  const mode = inferMode();
  if (mode === "local") {
    return "ws://localhost:3000/ws/transcript";
  }

  return `${toWebSocketOrigin(CLOUD_RUN_ORIGIN)}/ws/transcript`;
}

/** Absolute HTTP(S) HUD API base suitable for a one-shot health probe (skips relative production paths). */
export function resolveHudApiHealthProbeUrl(): string | undefined {
  const base = resolveHudApiBaseUrl();
  if (!base.startsWith("http")) return undefined;
  return `${trimTrailingSlash(base)}/health`;
}

export function isNonLocalAbsoluteHudApi(): boolean {
  const base = resolveHudApiBaseUrl();
  if (!base.startsWith("http")) return false;
  try {
    const { hostname } = new URL(base);
    return hostname !== "localhost" && hostname !== "127.0.0.1";
  } catch {
    return false;
  }
}

export function getRuntimeApiConfig() {
  return {
    mode: inferMode(),
    apiBaseUrl: resolveHudApiBaseUrl(),
    transcriptWsUrl: resolveTranscriptWsUrl(),
  };
}
