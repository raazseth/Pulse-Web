/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ElectronApi {
  serverPort: number;
  livePulseWebOrigins: readonly string[];
  exportSession(session: unknown, format: string): Promise<unknown>;
  listDisplaySources(): Promise<Array<{ id: string; name: string }>>;
  setDisplayCaptureSource(sourceId: string | null): Promise<{ success: true }>;
  getDisplayCapturePreference(): Promise<string | null>;
  startInterview(): Promise<void>;
  stopInterview(): Promise<void>;
}

declare interface Window {
  api?: ElectronApi;
}

interface ImportMetaEnv {
  readonly VITE_APP_MODE?: "local" | "development" | "production";
  readonly VITE_HUD_API_URL: string;
  readonly VITE_TRANSCRIPT_WS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
