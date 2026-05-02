import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTranscriptMainBridge, useTranscriptPipBridge } from "./useTranscriptBridge";

const handlers = new Map<string, Set<(e: { data: unknown }) => void>>();

class MockBroadcastChannel {
  name: string;
  private _onmessage: ((e: { data: unknown }) => void) | null = null;
  private _ownHandlers = new Set<(e: { data: unknown }) => void>();

  get onmessage() { return this._onmessage; }
  set onmessage(cb: ((e: { data: unknown }) => void) | null) {
    if (this._onmessage) {
      handlers.get(this.name)?.delete(this._onmessage);
      this._ownHandlers.delete(this._onmessage);
    }
    this._onmessage = cb;
    if (cb) {
      handlers.get(this.name)?.add(cb);
      this._ownHandlers.add(cb);
    }
  }

  constructor(name: string) {
    this.name = name;
    if (!handlers.has(name)) handlers.set(name, new Set());
  }

  postMessage(data: unknown) {
    const set = handlers.get(this.name);
    if (!set) return;
    for (const h of set) {
      if (!this._ownHandlers.has(h)) h({ data });
    }
  }

  addEventListener(_: string, cb: (e: { data: unknown }) => void) {
    handlers.get(this.name)?.add(cb);
    this._ownHandlers.add(cb);
  }

  close() {
    for (const h of this._ownHandlers) {
      handlers.get(this.name)?.delete(h);
    }
    this._ownHandlers.clear();
    this._onmessage = null;
  }
}

vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);

beforeEach(() => {
  handlers.clear();
});

describe("useTranscriptMainBridge", () => {
  it("posts state to channel on every render when enabled", () => {
    const sendChunk = vi.fn().mockReturnValue(true);
    const items = [{ id: "1", text: "hello", timestamp: "t", speakerId: "sp", formattedTime: "12:00" }];

    const { result } = renderHook(() =>
      useTranscriptMainBridge(true, items, [], [], "connected", sendChunk),
    );
    expect(result.current).toBeUndefined();

    const pipHook = renderHook(() => useTranscriptPipBridge(true));
    expect(pipHook.result.current.items).toHaveLength(1);
  });

  it("calls sendChunk when a send-chunk message arrives from satellite", () => {
    const sendChunk = vi.fn().mockReturnValue(true);
    renderHook(() =>
      useTranscriptMainBridge(true, [], [], [], "connected", sendChunk),
    );

    // Simulate satellite posting a send-chunk message
    const ch = new MockBroadcastChannel("pulse-transcript-bridge-v1");
    act(() => {
      ch.postMessage({ type: "send-chunk", payload: { text: "hello", speakerId: "sp" } });
    });

    expect(sendChunk).toHaveBeenCalledWith({ text: "hello", speakerId: "sp" });
  });

  it("does nothing when disabled=false", () => {
    const sendChunk = vi.fn();
    renderHook(() =>
      useTranscriptMainBridge(false, [], [], [], "disconnected", sendChunk),
    );
    const ch = new MockBroadcastChannel("pulse-transcript-bridge-v1");
    act(() => {
      ch.postMessage({ type: "send-chunk", payload: { text: "x", speakerId: "sp" } });
    });
    expect(sendChunk).not.toHaveBeenCalled();
  });
});

describe("useTranscriptPipBridge", () => {
  it("sends request-state on mount and applies incoming state", () => {
    const pipHook = renderHook(() => useTranscriptPipBridge(true));
    expect(pipHook.result.current.status).toBe("connecting");

    // Simulate main window responding to request-state
    const ch = new MockBroadcastChannel("pulse-transcript-bridge-v1");
    act(() => {
      ch.postMessage({
        type: "state",
        items: [{ id: "1", text: "hi", timestamp: "t", speakerId: "sp", formattedTime: "12:00" }],
        prompts: [],
        signals: [],
        status: "connected",
      });
    });

    expect(pipHook.result.current.status).toBe("connected");
    expect(pipHook.result.current.items).toHaveLength(1);
    expect(pipHook.result.current.items[0].text).toBe("hi");
  });

  it("sendChunk posts send-chunk message to channel", () => {
    const postSpy = vi.spyOn(MockBroadcastChannel.prototype, "postMessage");
    const { result } = renderHook(() => useTranscriptPipBridge(true));

    act(() => {
      result.current.sendChunk({ text: "world", speakerId: "sp" });
    });

    const sendChunkCall = postSpy.mock.calls.find(
      ([data]) => (data as { type: string }).type === "send-chunk",
    );
    expect(sendChunkCall).toBeDefined();
    expect((sendChunkCall![0] as { payload: { text: string } }).payload.text).toBe("world");
  });

  it("ignores messages with wrong type", () => {
    const { result } = renderHook(() => useTranscriptPipBridge(true));
    const ch = new MockBroadcastChannel("pulse-transcript-bridge-v1");
    act(() => {
      ch.postMessage({ type: "unknown", items: [{}] });
    });
    expect(result.current.items).toHaveLength(0);
  });

  it("returns false from sendChunk when disabled and no channel", () => {
    const { result } = renderHook(() => useTranscriptPipBridge(false));
    let sent: boolean;
    act(() => {
      sent = result.current.sendChunk({ text: "x", speakerId: "sp" });
    });
    expect(sent!).toBe(false);
  });
});
