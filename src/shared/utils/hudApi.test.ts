import { describe, it, expect } from "vitest";
import {
  getHudSessionUrl,
  getHudExportUrl,
  getAudioTranscribeUrl,
  getAuthHeaders,
} from "./hudApi";

const BASE = "http://localhost:3000/api/v1";

describe("getHudSessionUrl", () => {
  it("returns the session URL for a given sessionId", () => {
    expect(getHudSessionUrl("sess-abc")).toBe(`${BASE}/hud/sessions/sess-abc`);
  });

  it("embeds the sessionId verbatim for safe characters", () => {
    const id = "my-session-123";
    expect(getHudSessionUrl(id)).toContain(id);
  });

  it("percent-encodes special characters in sessionId (path injection guard)", () => {
    const url = getHudSessionUrl("sess/../../admin?foo=bar");
    expect(url).toContain("sess%2F..%2F..%2Fadmin%3Ffoo%3Dbar");
    expect(url).not.toContain("../../admin");
  });
});

describe("getHudExportUrl", () => {
  it("appends format=json query param", () => {
    const url = getHudExportUrl("sess-1", "json");
    expect(url).toContain("/export");
    expect(url).toContain("format=json");
  });

  it("appends format=csv query param", () => {
    const url = getHudExportUrl("sess-1", "csv");
    expect(url).toContain("format=csv");
  });

  it("includes the sessionId in the URL", () => {
    const url = getHudExportUrl("sess-xyz", "json");
    expect(url).toContain("sess-xyz");
  });
});

describe("getAudioTranscribeUrl", () => {
  it("returns the audio transcription endpoint", () => {
    expect(getAudioTranscribeUrl()).toBe(`${BASE}/hud/audio/transcribe`);
  });
});

describe("getAuthHeaders", () => {
  it("returns empty object for null token", () => {
    expect(getAuthHeaders(null)).toEqual({});
  });

  it("returns Authorization header for a real token", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.payload.sig";
    expect(getAuthHeaders(token)).toEqual({ Authorization: `Bearer ${token}` });
  });

  it("returns empty object for empty string", () => {
    expect(getAuthHeaders("")).toEqual({});
  });
});
