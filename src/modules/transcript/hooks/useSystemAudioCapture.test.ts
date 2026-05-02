import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/shared/utils/fetchWithAuth", () => ({
  fetchWithAuth: vi.fn(),
}));
vi.mock("@/shared/utils/hudApi", () => ({
  getAudioTranscribeUrl: vi.fn().mockReturnValue("http://localhost:3000/api/transcribe"),
}));

import { useSystemAudioCapture } from "./useSystemAudioCapture";

class MockMediaRecorder {
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void) | null = null;
  state: "inactive" | "recording" = "inactive";
  start = vi.fn(() => { this.state = "recording"; });
  stop = vi.fn(() => { this.state = "inactive"; });
  static isTypeSupported = vi.fn().mockReturnValue(true);
  static instances: MockMediaRecorder[] = [];
  constructor(_stream: unknown, _opts?: unknown) {
    MockMediaRecorder.instances.push(this);
  }
}

class MockMediaStream {
  private _tracks: ReturnType<typeof makeFakeTrack>[];
  constructor(tracks: ReturnType<typeof makeFakeTrack>[] = []) {
    this._tracks = tracks;
  }
  getAudioTracks() { return this._tracks.filter((t) => t.kind === "audio"); }
  getVideoTracks() { return this._tracks.filter((t) => t.kind === "video"); }
  getTracks() { return this._tracks; }
}

function makeFakeTrack(kind: string) {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    kind,
    stop: vi.fn(),
    addEventListener: vi.fn((event: string, cb: () => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    }),
    _fire: (event: string) => {
      (listeners[event] ?? []).forEach((cb) => cb());
    },
  };
}

function makeStream(hasAudio = true, hasVideo = false) {
  const tracks = [
    ...(hasAudio ? [makeFakeTrack("audio")] : []),
    ...(hasVideo ? [makeFakeTrack("video")] : []),
  ];
  return new MockMediaStream(tracks);
}

const mockGetDisplayMedia = vi.fn();

describe("useSystemAudioCapture — isSupported detection", () => {
  it("isSupported is false in jsdom where getDisplayMedia is not available", () => {
    const { result } = renderHook(() =>
      useSystemAudioCapture({ onChunk: vi.fn() }),
    );
    expect(result.current.isSupported).toBe(false);
  });
});

describe("useSystemAudioCapture — with media APIs", () => {
  let originalMediaDevices: unknown;

  beforeEach(() => {
    MockMediaRecorder.instances = [];
    mockGetDisplayMedia.mockReset();
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    vi.stubGlobal("MediaStream", MockMediaStream);

    // Preserve original mediaDevices if any
    originalMediaDevices = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(navigator),
      "mediaDevices",
    );
    Object.defineProperty(navigator, "mediaDevices", {
      writable: true,
      configurable: true,
      value: { getDisplayMedia: mockGetDisplayMedia },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalMediaDevices) {
      Object.defineProperty(
        Object.getPrototypeOf(navigator),
        "mediaDevices",
        originalMediaDevices as PropertyDescriptor,
      );
    }
  });

  it("isSupported is true when getDisplayMedia and MediaRecorder are available", () => {
    const { result } = renderHook(() =>
      useSystemAudioCapture({ onChunk: vi.fn() }),
    );
    expect(result.current.isSupported).toBe(true);
  });

  it("starts with isListening=false and no error", () => {
    const { result } = renderHook(() =>
      useSystemAudioCapture({ onChunk: vi.fn() }),
    );
    expect(result.current.isListening).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it("sets error when getDisplayMedia throws NotAllowedError (permission denied)", async () => {
    const notAllowed = new DOMException("denied", "NotAllowedError");
    mockGetDisplayMedia.mockRejectedValue(notAllowed);
    const { result } = renderHook(() =>
      useSystemAudioCapture({ onChunk: vi.fn() }),
    );
    await act(async () => { await result.current.start(); });
    expect(result.current.error).toBe("Screen-share permission denied");
    expect(result.current.isListening).toBe(false);
  });

  it("sets error when stream has no audio tracks", async () => {
    mockGetDisplayMedia.mockResolvedValue(makeStream(false, false));
    const { result } = renderHook(() =>
      useSystemAudioCapture({ onChunk: vi.fn() }),
    );
    await act(async () => { await result.current.start(); });
    expect(result.current.error).toMatch(/No audio track/i);
    expect(result.current.isListening).toBe(false);
  });

  it("sets isListening=true after successful start and creates a recorder", async () => {
    const stream = makeStream(true, false);
    mockGetDisplayMedia.mockResolvedValue(stream);
    const { result } = renderHook(() =>
      useSystemAudioCapture({ onChunk: vi.fn(), chunkIntervalMs: 30_000 }),
    );
    await act(async () => { await result.current.start(); });
    expect(result.current.isListening).toBe(true);
    expect(MockMediaRecorder.instances).toHaveLength(1);
    expect(MockMediaRecorder.instances[0].start).toHaveBeenCalled();
  });

  it("stop() sets isListening=false and aborts in-flight work", async () => {
    const stream = makeStream(true, false);
    mockGetDisplayMedia.mockResolvedValue(stream);
    const { result } = renderHook(() =>
      useSystemAudioCapture({ onChunk: vi.fn(), chunkIntervalMs: 30_000 }),
    );
    await act(async () => { await result.current.start(); });
    expect(result.current.isListening).toBe(true);
    act(() => result.current.stop());
    expect(result.current.isListening).toBe(false);
  });

  it("calls sendAudioChunk with the blob when it is provided and returns true", async () => {
    const sendAudioChunk = vi.fn().mockResolvedValue(true);
    const stream = makeStream(true, false);
    mockGetDisplayMedia.mockResolvedValue(stream);
    const onChunk = vi.fn();
    const { result } = renderHook(() =>
      useSystemAudioCapture({ onChunk, sendAudioChunk, chunkIntervalMs: 3000 }),
    );
    await act(async () => { await result.current.start(); });
    const recorder = MockMediaRecorder.instances[0];
    expect(recorder).toBeDefined();

    // Fire a large-enough data chunk (> silence threshold of 600 bytes/s × 3s = 1800)
    await act(async () => {
      recorder.ondataavailable!({
        data: new Blob([new Uint8Array(5000)], { type: "audio/webm" }),
      });
      await Promise.resolve(); // settle microtasks
    });

    expect(sendAudioChunk).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.stringContaining("audio"),
    );
    // WS path succeeded — HTTP fallback should not have been called
    expect(onChunk).not.toHaveBeenCalled();
  });
});
