/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE?: "local" | "development" | "production";
  readonly VITE_HUD_API_URL: string;
  readonly VITE_TRANSCRIPT_WS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
