import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getElectronEmbeddedServerPort,
  isEmbeddedLocalHudMode,
  resolveHudApiBaseUrl,
  resolveTranscriptWsUrl,
} from "./hudApiBaseUrl";

describe("hudApiBaseUrl embedded port", () => {
  const originalApi = (globalThis as unknown as { window?: Window }).window;

  beforeEach(() => {
    vi.stubGlobal("window", {
      ...originalApi,
      api: { serverPort: 18473 },
      location: { protocol: "https:", href: "https://example.com/" },
    } as unknown as Window & { api: { serverPort: number } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getElectronEmbeddedServerPort reads preload port", () => {
    expect(getElectronEmbeddedServerPort()).toBe(18473);
    expect(isEmbeddedLocalHudMode()).toBe(true);
  });

  it("forces API base to 127.0.0.1 when embedded port is set (ignores VITE)", () => {
    expect(resolveHudApiBaseUrl()).toBe("http://127.0.0.1:18473/api/v1");
  });

  it("forces transcript WS to local when embedded port is set", () => {
    expect(resolveTranscriptWsUrl()).toBe("ws://127.0.0.1:18473/ws/transcript");
  });
});
