import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createTranscriptSocket,
  sendTranscriptChunk,
  sendTranscriptTag,
} from "./transcriptSocket";





type EventHandler = (event?: unknown) => void;

class MockWebSocket {
  readyState: number = WebSocket.CONNECTING;
  private listeners = new Map<string, EventHandler[]>();
  readonly sentMessages: string[] = [];

  addEventListener(type: string, handler: EventHandler) {
    const list = this.listeners.get(type) ?? [];
    list.push(handler);
    this.listeners.set(type, list);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
  }

  
  trigger(type: string, event?: unknown) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler(event);
    }
  }
}

let mockSocket: MockWebSocket;

beforeEach(() => {
  mockSocket = new MockWebSocket();
  
  const MockWS = Object.assign(function () { return mockSocket; }, {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  });
  vi.stubGlobal("WebSocket", MockWS);
});

afterEach(() => {
  vi.unstubAllGlobals();
});





describe("createTranscriptSocket — URL construction", () => {
  it("connects to the plain URL when no token is supplied", () => {
    let capturedUrl = "";
    vi.stubGlobal("WebSocket", Object.assign(
      function (url: string) { capturedUrl = url; return mockSocket; },
      { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 },
    ));
    createTranscriptSocket({ url: "ws://host/ws", sessionId: "s", onOpen: vi.fn(), onClose: vi.fn(), onError: vi.fn(), onMessage: vi.fn() });
    expect(capturedUrl).toBe("ws://host/ws");
  });

  it("appends ?token= when a token is provided", () => {
    let capturedUrl = "";
    vi.stubGlobal("WebSocket", Object.assign(
      function (url: string) { capturedUrl = url; return mockSocket; },
      { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 },
    ));
    createTranscriptSocket({ url: "ws://host/ws", sessionId: "s", token: "tok-abc", onOpen: vi.fn(), onClose: vi.fn(), onError: vi.fn(), onMessage: vi.fn() });
    expect(capturedUrl).toContain("token=tok-abc");
  });

  it("does NOT append token param when token is null", () => {
    let capturedUrl = "";
    vi.stubGlobal("WebSocket", Object.assign(
      function (url: string) { capturedUrl = url; return mockSocket; },
      { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 },
    ));
    createTranscriptSocket({ url: "ws://host/ws", sessionId: "s", token: null, onOpen: vi.fn(), onClose: vi.fn(), onError: vi.fn(), onMessage: vi.fn() });
    expect(capturedUrl).not.toContain("token");
  });
});





describe("createTranscriptSocket — open", () => {
  it("calls onOpen when the socket opens", () => {
    const onOpen = vi.fn();
    createTranscriptSocket({ url: "ws://x", sessionId: "s1", onOpen, onClose: vi.fn(), onError: vi.fn(), onMessage: vi.fn() });
    mockSocket.trigger("open");
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("sends session:subscribe immediately after open", () => {
    createTranscriptSocket({ url: "ws://x", sessionId: "abc", onOpen: vi.fn(), onClose: vi.fn(), onError: vi.fn(), onMessage: vi.fn() });
    mockSocket.trigger("open");
    expect(mockSocket.sentMessages).toHaveLength(1);
    const msg = JSON.parse(mockSocket.sentMessages[0]) as { type: string; payload: { sessionId: string } };
    expect(msg.type).toBe("session:subscribe");
    expect(msg.payload.sessionId).toBe("abc");
  });
});

describe("createTranscriptSocket — message handling", () => {
  it("parses valid JSON and calls onMessage", () => {
    const onMessage = vi.fn();
    createTranscriptSocket({ url: "ws://x", sessionId: "s", onOpen: vi.fn(), onClose: vi.fn(), onError: vi.fn(), onMessage });
    mockSocket.trigger("message", { data: JSON.stringify({ type: "connection:ready" }) });
    expect(onMessage).toHaveBeenCalledWith({ type: "connection:ready" });
  });

  it("calls onError and does NOT crash on malformed JSON", () => {
    const onError = vi.fn();
    const onMessage = vi.fn();
    createTranscriptSocket({ url: "ws://x", sessionId: "s", onOpen: vi.fn(), onClose: vi.fn(), onError, onMessage });
    expect(() => {
      mockSocket.trigger("message", { data: "{{not-json}}" });
    }).not.toThrow();
    expect(onError).toHaveBeenCalledOnce();
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("does NOT call onMessage after a parse error", () => {
    const onMessage = vi.fn();
    createTranscriptSocket({ url: "ws://x", sessionId: "s", onOpen: vi.fn(), onClose: vi.fn(), onError: vi.fn(), onMessage });
    mockSocket.trigger("message", { data: "bad" });
    expect(onMessage).not.toHaveBeenCalled();
  });
});

describe("createTranscriptSocket — error and close ordering", () => {
  it("calls onError before onClose when an error occurs", () => {
    const calls: string[] = [];
    createTranscriptSocket({
      url: "ws://x",
      sessionId: "s",
      onOpen: vi.fn(),
      onError: () => calls.push("error"),
      onClose: () => calls.push("close"),
      onMessage: vi.fn(),
    });
    mockSocket.trigger("error");
    mockSocket.trigger("close");
    expect(calls).toEqual(["error", "close"]);
  });

  it("passes wasError=true to onClose when preceded by an error event", () => {
    const onClose = vi.fn();
    createTranscriptSocket({ url: "ws://x", sessionId: "s", onOpen: vi.fn(), onError: vi.fn(), onClose, onMessage: vi.fn() });
    mockSocket.trigger("error");
    mockSocket.trigger("close");
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("passes wasError=false to onClose on a clean disconnect", () => {
    const onClose = vi.fn();
    createTranscriptSocket({ url: "ws://x", sessionId: "s", onOpen: vi.fn(), onError: vi.fn(), onClose, onMessage: vi.fn() });
    mockSocket.trigger("close");
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("resets hasErrored after a successful reconnect open", () => {
    const onClose = vi.fn();
    createTranscriptSocket({ url: "ws://x", sessionId: "s", onOpen: vi.fn(), onError: vi.fn(), onClose, onMessage: vi.fn() });
    mockSocket.trigger("error");
    mockSocket.trigger("close");
    
    mockSocket.trigger("open");
    
    mockSocket.trigger("close");
    expect(onClose).toHaveBeenNthCalledWith(1, true);
    expect(onClose).toHaveBeenNthCalledWith(2, false);
  });
});





describe("sendTranscriptChunk", () => {
  it("sends the message when socket is OPEN", () => {
    mockSocket.readyState = WebSocket.OPEN;
    sendTranscriptChunk(mockSocket as unknown as WebSocket, "sess-1", { text: "hello" });
    expect(mockSocket.sentMessages).toHaveLength(1);
    const msg = JSON.parse(mockSocket.sentMessages[0]) as { type: string; payload: { sessionId: string; text: string } };
    expect(msg.type).toBe("transcript:chunk");
    expect(msg.payload.sessionId).toBe("sess-1");
    expect(msg.payload.text).toBe("hello");
  });

  it("does NOT send when socket is CONNECTING", () => {
    mockSocket.readyState = WebSocket.CONNECTING;
    sendTranscriptChunk(mockSocket as unknown as WebSocket, "sess-1", { text: "hello" });
    expect(mockSocket.sentMessages).toHaveLength(0);
  });

  it("does NOT send when socket is CLOSED", () => {
    mockSocket.readyState = WebSocket.CLOSED;
    sendTranscriptChunk(mockSocket as unknown as WebSocket, "sess-1", { text: "hello" });
    expect(mockSocket.sentMessages).toHaveLength(0);
  });
});

describe("sendTranscriptTag", () => {
  it("sends the message when socket is OPEN", () => {
    mockSocket.readyState = WebSocket.OPEN;
    sendTranscriptTag(mockSocket as unknown as WebSocket, { sessionId: "s", label: "insight" });
    expect(mockSocket.sentMessages).toHaveLength(1);
    const msg = JSON.parse(mockSocket.sentMessages[0]) as { type: string; payload: { label: string } };
    expect(msg.type).toBe("tag:create");
    expect(msg.payload.label).toBe("insight");
  });

  it("does NOT send when socket is not OPEN", () => {
    mockSocket.readyState = WebSocket.CLOSING;
    sendTranscriptTag(mockSocket as unknown as WebSocket, { sessionId: "s", label: "risk" });
    expect(mockSocket.sentMessages).toHaveLength(0);
  });
});
