import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMicCapture } from "./useMicCapture";








interface RecorderSlots {
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onerror: (() => void) | null;
  onstop: (() => void) | null;
}

function makeRecorderMock() {
  const slots: RecorderSlots = { ondataavailable: null, onerror: null, onstop: null };

  const rec = {
    start: vi.fn(),
    
    stop: vi.fn().mockImplementation(() => slots.onstop?.()),
    get ondataavailable() { return slots.ondataavailable; },
    set ondataavailable(fn: RecorderSlots["ondataavailable"]) { slots.ondataavailable = fn; },
    get onerror() { return slots.onerror; },
    set onerror(fn: RecorderSlots["onerror"]) { slots.onerror = fn; },
    get onstop() { return slots.onstop; },
    set onstop(fn: RecorderSlots["onstop"]) { slots.onstop = fn; },
  };

  
  
  
  const Ctor = Object.assign(
    function MockMediaRecorder() { return rec; },
    { isTypeSupported: vi.fn(() => true) },
  );

  return { rec, slots, Ctor };
}

function makeStreamMock() {
  return { getTracks: () => [{ stop: vi.fn() }] };
}





let recorder: ReturnType<typeof makeRecorderMock>;

beforeEach(() => {
  recorder = makeRecorderMock();
  vi.stubGlobal("MediaRecorder", recorder.Ctor);
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(makeStreamMock()),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});





describe("useMicCapture — initial state", () => {
  it("starts not-listening with no error", () => {
    const { result } = renderHook(() => useMicCapture({ onChunk: vi.fn() }));
    expect(result.current.isListening).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it("reports isSupported=true when MediaRecorder is available", () => {
    const { result } = renderHook(() => useMicCapture({ onChunk: vi.fn() }));
    expect(result.current.isSupported).toBe(true);
  });

  it("reports isSupported=false when MediaRecorder is not available", () => {
    vi.stubGlobal("MediaRecorder", undefined);
    const { result } = renderHook(() => useMicCapture({ onChunk: vi.fn() }));
    expect(result.current.isSupported).toBe(false);
  });
});





describe("useMicCapture — start()", () => {
  it("does not start the recorder if stop() runs while getUserMedia is pending", async () => {
    let resolveMedia!: (s: MediaStream) => void;
    const mediaPromise = new Promise<MediaStream>((r) => {
      resolveMedia = r;
    });
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockReturnValue(mediaPromise),
      },
    });

    const { result } = renderHook(() => useMicCapture({ onChunk: vi.fn() }));
    act(() => { void result.current.start(); });

    act(() => { result.current.stop(); });

    await act(async () => {
      resolveMedia(makeStreamMock() as unknown as MediaStream);
      await Promise.resolve();
    });

    expect(recorder.rec.start).not.toHaveBeenCalled();
    expect(result.current.isListening).toBe(false);
  });

  it("sets isListening=true and calls recorder.start after successful getUserMedia", async () => {
    const { result } = renderHook(() => useMicCapture({ onChunk: vi.fn() }));
    await act(async () => { await result.current.start(); });

    expect(result.current.isListening).toBe(true);
    expect(recorder.rec.start).toHaveBeenCalledOnce();
  });

  it("sets error='Microphone permission denied' when getUserMedia rejects with NotAllowedError", async () => {
    
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(
          new DOMException("Permission denied", "NotAllowedError"),
        ),
      },
    });

    const { result } = renderHook(() => useMicCapture({ onChunk: vi.fn() }));
    await act(async () => { await result.current.start(); });

    expect(result.current.isListening).toBe(false);
    expect(result.current.error).toBe("Microphone permission denied");
  });

  it("sets a generic error when getUserMedia rejects with a non-permission error", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new Error("Device unavailable")),
      },
    });

    const { result } = renderHook(() => useMicCapture({ onChunk: vi.fn() }));
    await act(async () => { await result.current.start(); });

    expect(result.current.isListening).toBe(false);
    expect(result.current.error).toBe("Device unavailable");
  });
});





describe("useMicCapture — stop() aborts in-flight requests", () => {
  it("aborts the fetch signal for an active audio upload when stop() is called", async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      capturedSignal = opts.signal as AbortSignal;
      return new Promise(() => {}); 
    }));

    const { result } = renderHook(() => useMicCapture({ onChunk: vi.fn() }));
    await act(async () => { await result.current.start(); });

    
    
    
    
    
    await act(async () => {
      recorder.slots.ondataavailable?.({
        data: new Blob(["x".repeat(200)], { type: "audio/webm" }),
      });
      await Promise.resolve(); 
    });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal!.aborted).toBe(false); 

    act(() => { result.current.stop(); });

    expect(capturedSignal!.aborted).toBe(true); 
    expect(result.current.isListening).toBe(false);
  });

  it("does NOT fetch for chunks smaller than 100 bytes", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMicCapture({ onChunk: vi.fn() }));
    await act(async () => { await result.current.start(); });

    await act(async () => {
      recorder.slots.ondataavailable?.({ data: new Blob(["tiny"]) }); 
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});





describe("useMicCapture — onChunk callback", () => {
  it("calls onChunk with trimmed text when fetch returns a transcription", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { text: "  hello world  " } }),
    }));

    const onChunk = vi.fn();
    const { result } = renderHook(() => useMicCapture({ onChunk }));
    await act(async () => { await result.current.start(); });

    await act(async () => {
      recorder.slots.ondataavailable?.({
        data: new Blob(["x".repeat(200)], { type: "audio/webm" }),
      });
    });
    await act(async () => {}); 

    expect(onChunk).toHaveBeenCalledWith("hello world");
  });

  it("does not call onChunk when the transcribed text is empty after trim", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { text: "   " } }),
    }));

    const onChunk = vi.fn();
    const { result } = renderHook(() => useMicCapture({ onChunk }));
    await act(async () => { await result.current.start(); });

    await act(async () => {
      recorder.slots.ondataavailable?.({
        data: new Blob(["x".repeat(200)], { type: "audio/webm" }),
      });
    });
    await act(async () => {});

    expect(onChunk).not.toHaveBeenCalled();
  });

  it("does not call onChunk when the fetch response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }));

    const onChunk = vi.fn();
    const { result } = renderHook(() => useMicCapture({ onChunk }));
    await act(async () => { await result.current.start(); });

    await act(async () => {
      recorder.slots.ondataavailable?.({
        data: new Blob(["x".repeat(200)], { type: "audio/webm" }),
      });
    });
    await act(async () => {});

    expect(onChunk).not.toHaveBeenCalled();
  });

  it("calls onVoiceBackendError when fetch returns non-ok and the user did not stop", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }));

    const onVoiceBackendError = vi.fn();
    const { result } = renderHook(() =>
      useMicCapture({ onChunk: vi.fn(), onVoiceBackendError }),
    );
    await act(async () => { await result.current.start(); });

    await act(async () => {
      recorder.slots.ondataavailable?.({
        data: new Blob(["x".repeat(200)], { type: "audio/webm" }),
      });
    });
    await act(async () => {});

    expect(onVoiceBackendError).toHaveBeenCalledOnce();
  });

  it("does not call onVoiceBackendError when stop() runs before a non-ok response arrives", async () => {
    let resolveFetch!: (v: Response) => void;
    const fetchPromise = new Promise<Response>((r) => {
      resolveFetch = r;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(fetchPromise));

    const onVoiceBackendError = vi.fn();
    const { result } = renderHook(() =>
      useMicCapture({ onChunk: vi.fn(), onVoiceBackendError }),
    );
    await act(async () => { await result.current.start(); });

    await act(async () => {
      recorder.slots.ondataavailable?.({
        data: new Blob(["x".repeat(200)], { type: "audio/webm" }),
      });
      await Promise.resolve();
    });

    act(() => { result.current.stop(); });

    await act(async () => {
      resolveFetch({
        ok: false,
        json: async () => ({}),
      } as Response);
      await Promise.resolve();
    });

    expect(onVoiceBackendError).not.toHaveBeenCalled();
  });

  it("does not call onChunk when stop() runs before an ok response arrives", async () => {
    let resolveFetch!: (v: Response) => void;
    const fetchPromise = new Promise<Response>((r) => {
      resolveFetch = r;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(fetchPromise));

    const onChunk = vi.fn();
    const { result } = renderHook(() => useMicCapture({ onChunk }));
    await act(async () => { await result.current.start(); });

    await act(async () => {
      recorder.slots.ondataavailable?.({
        data: new Blob(["x".repeat(200)], { type: "audio/webm" }),
      });
      await Promise.resolve();
    });

    act(() => { result.current.stop(); });

    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({ success: true, data: { text: "late" } }),
      } as Response);
      await Promise.resolve();
    });

    expect(onChunk).not.toHaveBeenCalled();
  });
});
