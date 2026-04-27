import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { DESKTOP_SENTINEL } from "@/shared/constants/auth";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before importing the hook
// ---------------------------------------------------------------------------

vi.mock("@/modules/transcript/services/transcriptSocket", () => ({
  createTranscriptSocket: vi.fn(),
  sendTranscriptChunk: vi.fn(),
  sendTranscriptTag: vi.fn(),
}));

vi.mock("@/shared/services/sessionIdb", () => ({
  loadSession: vi.fn().mockResolvedValue(null),
  saveSession: vi.fn().mockResolvedValue(undefined),
}));

import {
  createTranscriptSocket,
  sendTranscriptChunk,
  sendTranscriptTag,
} from "@/modules/transcript/services/transcriptSocket";
import { loadSession, saveSession } from "@/shared/services/sessionIdb";
import type {
  TranscriptItem,
  TranscriptSessionState,
  TranscriptSocketServerMessage,
  TranscriptSocketPrompt,
  TranscriptSignalCue,
} from "@/modules/transcript/types";
import { useTranscriptStream } from "./useTranscriptStream";

// ---------------------------------------------------------------------------
// Socket mock helpers
// ---------------------------------------------------------------------------

type MsgHandler = (msg: TranscriptSocketServerMessage) => void;

interface SocketCallbacks {
  onOpen: () => void;
  onClose: (wasError: boolean) => void;
  onError: () => void;
  onMessage: MsgHandler;
}

let callbacks: SocketCallbacks;
let mockClose: ReturnType<typeof vi.fn>;

function makeItem(id: string): TranscriptItem {
  return { id, text: `text-${id}`, timestamp: "2024-01-01T12:00:00.000Z", speakerId: "sp1", formattedTime: "12:00:00 PM" };
}

function makeSessionState(items: TranscriptItem[] = []): TranscriptSessionState {
  return {
    session: { id: "s1", context: {}, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    transcriptEntries: items.map((i) => ({ ...i, sessionId: "s1" })),
    tags: [],
    prompts: [],
    signals: [],
    events: [],
  };
}

const mockSocket = {
  readyState: WebSocket.OPEN as number,
  close: undefined as unknown as ReturnType<typeof vi.fn>,
};

beforeEach(() => {
  vi.useFakeTimers();
  mockClose = vi.fn();
  mockSocket.readyState = WebSocket.OPEN;
  mockSocket.close = mockClose;

  vi.mocked(createTranscriptSocket).mockImplementation((opts) => {
    callbacks = {
      onOpen: opts.onOpen,
      onClose: opts.onClose,
      onError: opts.onError,
      onMessage: opts.onMessage,
    };
    return mockSocket as unknown as WebSocket;
  });

  vi.mocked(loadSession).mockResolvedValue(null);
  vi.mocked(saveSession).mockResolvedValue(undefined);
  vi.mocked(sendTranscriptChunk).mockClear();
  vi.mocked(sendTranscriptTag).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Connection lifecycle
// ---------------------------------------------------------------------------

describe("useTranscriptStream — connection lifecycle", () => {
  it("starts with status 'connecting'", () => {
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    expect(result.current.status).toBe("connecting");
  });

  it("sets status 'connected' when socket opens", async () => {
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    await act(async () => { callbacks.onOpen(); });
    expect(result.current.status).toBe("connected");
  });

  it("calls createTranscriptSocket with sessionId", () => {
    renderHook(() => useTranscriptStream({ sessionId: "abc" }));
    expect(createTranscriptSocket).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "abc" }),
    );
  });

  it("passes accessToken as token option when provided", () => {
    renderHook(() =>
      useTranscriptStream({ sessionId: "s1", accessToken: "tok-xyz" }),
    );
    expect(createTranscriptSocket).toHaveBeenCalledWith(
      expect.objectContaining({ token: "tok-xyz" }),
    );
  });

  it("passes null as token when accessToken is DESKTOP_SENTINEL", () => {
    renderHook(() =>
      useTranscriptStream({ sessionId: "s1", accessToken: DESKTOP_SENTINEL }),
    );
    expect(createTranscriptSocket).toHaveBeenCalledWith(
      expect.objectContaining({ token: null }),
    );
  });

  it("closes socket on unmount", () => {
    const { unmount } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    unmount();
    expect(mockClose).toHaveBeenCalledOnce();
  });

});

// ---------------------------------------------------------------------------
// Reconnect logic
// ---------------------------------------------------------------------------

describe("useTranscriptStream — reconnect", () => {
  it("sets status 'reconnecting' on clean close", async () => {
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    await act(async () => { callbacks.onClose(false); });
    expect(result.current.status).toBe("reconnecting");
  });

  it("keeps status 'error' (not 'reconnecting') when close follows an error", async () => {
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    await act(async () => { callbacks.onError(); });
    await act(async () => { callbacks.onClose(true); });
    expect(result.current.status).toBe("error");
  });

  it("creates a new socket after the 1600 ms reconnect timer fires", async () => {
    renderHook(() => useTranscriptStream({ sessionId: "s1" }));
    expect(createTranscriptSocket).toHaveBeenCalledTimes(1);

    await act(async () => { callbacks.onClose(false); });
    await act(async () => { vi.advanceTimersByTime(1600); });

    expect(createTranscriptSocket).toHaveBeenCalledTimes(2);
  });

  it("cancels the reconnect timer on unmount (isStopped guard)", async () => {
    const { unmount } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    await act(async () => { callbacks.onClose(false); });
    unmount();

    // Advancing past the timer should NOT create a second socket
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(createTranscriptSocket).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Token rotation — no reconnect when accessToken prop changes
// ---------------------------------------------------------------------------

describe("useTranscriptStream — token rotation", () => {
  it("does NOT create a new socket when accessToken prop changes", () => {
    const { rerender } = renderHook(
      ({ token }: { token: string }) =>
        useTranscriptStream({ sessionId: "s1", accessToken: token }),
      { initialProps: { token: "token-v1" } },
    );

    rerender({ token: "token-v2" });
    // Only the initial connect — no second createTranscriptSocket call
    expect(createTranscriptSocket).toHaveBeenCalledTimes(1);
  });

  it("uses updated token on the next reconnect after rotation", async () => {
    const { rerender } = renderHook(
      ({ token }: { token: string }) =>
        useTranscriptStream({ sessionId: "s1", accessToken: token }),
      { initialProps: { token: "token-v1" } },
    );

    rerender({ token: "token-v2" });

    // Trigger reconnect
    await act(async () => { callbacks.onClose(false); });
    await act(async () => { vi.advanceTimersByTime(1600); });

    const secondCall = vi.mocked(createTranscriptSocket).mock.calls[1]?.[0];
    expect(secondCall?.token).toBe("token-v2");
  });
});

// ---------------------------------------------------------------------------
// Incoming message handling
// ---------------------------------------------------------------------------

describe("useTranscriptStream — session:state", () => {
  it("populates items from session:state payload", async () => {
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    await act(async () => {
      callbacks.onMessage({
        type: "session:state",
        payload: makeSessionState([makeItem("i1"), makeItem("i2")]),
      });
    });
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].id).toBe("i1");
  });

  it("calls onSessionState callback with the payload", async () => {
    const onSessionState = vi.fn();
    renderHook(() =>
      useTranscriptStream({ sessionId: "s1", onSessionState }),
    );
    const state = makeSessionState();
    await act(async () => {
      callbacks.onMessage({ type: "session:state", payload: state });
    });
    expect(onSessionState).toHaveBeenCalledWith(state);
  });
});

describe("useTranscriptStream — transcript:chunk", () => {
  it("appends a new item when a transcript:chunk arrives", async () => {
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    await act(async () => {
      callbacks.onMessage({ type: "transcript:chunk", payload: makeItem("i1") });
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe("i1");
  });

  it("deduplicates items with the same id", async () => {
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    await act(async () => {
      callbacks.onMessage({ type: "transcript:chunk", payload: makeItem("dup") });
      callbacks.onMessage({ type: "transcript:chunk", payload: makeItem("dup") });
    });
    expect(result.current.items).toHaveLength(1);
  });

  it("caps items at 800 (never exceeds MAX_ITEMS)", async () => {
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    // Load 800 items via session:state
    const items = Array.from({ length: 800 }, (_, i) => makeItem(`i${i}`));
    await act(async () => {
      callbacks.onMessage({ type: "session:state", payload: makeSessionState(items) });
    });
    // Add one more via chunk
    await act(async () => {
      callbacks.onMessage({ type: "transcript:chunk", payload: makeItem("overflow") });
    });
    expect(result.current.items).toHaveLength(800);
    expect(result.current.items[799].id).toBe("overflow");
  });
});

describe("useTranscriptStream — prompt:update", () => {
  function makePrompts(ids: string[]): TranscriptSocketPrompt[] {
    return ids.map((id) => ({
      id,
      sessionId: "s1",
      title: `Prompt ${id}`,
      text: "text",
      timestamp: "2024-01-01T00:00:00Z",
      transcriptIds: [],
    }));
  }

  it("updates prompts from prompt:update", async () => {
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    await act(async () => {
      callbacks.onMessage({ type: "prompt:update", payload: makePrompts(["p1", "p2"]) });
    });
    expect(result.current.prompts).toHaveLength(2);
  });

  it("preserves array identity when incoming prompt IDs are unchanged", async () => {
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    await act(async () => {
      callbacks.onMessage({ type: "prompt:update", payload: makePrompts(["p1"]) });
    });
    const ref1 = result.current.prompts;
    await act(async () => {
      callbacks.onMessage({ type: "prompt:update", payload: makePrompts(["p1"]) });
    });
    expect(result.current.prompts).toBe(ref1);
  });

  it("replaces array reference when prompt IDs change", async () => {
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    await act(async () => {
      callbacks.onMessage({ type: "prompt:update", payload: makePrompts(["p1"]) });
    });
    const ref1 = result.current.prompts;
    await act(async () => {
      callbacks.onMessage({ type: "prompt:update", payload: makePrompts(["p2"]) });
    });
    expect(result.current.prompts).not.toBe(ref1);
  });
});

describe("useTranscriptStream — signal:detected", () => {
  function makeSignal(id: string): TranscriptSignalCue {
    return { id, sessionId: "s1", kind: "keyword", label: "label", timestamp: "t" };
  }

  it("adds incoming signals", async () => {
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    await act(async () => {
      callbacks.onMessage({ type: "signal:detected", payload: [makeSignal("sig1")] });
    });
    expect(result.current.signals).toHaveLength(1);
  });

  it("deduplicates signals with the same id", async () => {
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    await act(async () => {
      callbacks.onMessage({ type: "signal:detected", payload: [makeSignal("dup")] });
    });
    await act(async () => {
      callbacks.onMessage({ type: "signal:detected", payload: [makeSignal("dup")] });
    });
    expect(result.current.signals).toHaveLength(1);
  });
});

describe("useTranscriptStream — tag:created", () => {
  it("calls onTagCreated callback", async () => {
    const onTagCreated = vi.fn();
    renderHook(() =>
      useTranscriptStream({ sessionId: "s1", onTagCreated }),
    );
    const tag = { id: "t1", sessionId: "s1", label: "risk", createdAt: "t" };
    await act(async () => {
      callbacks.onMessage({ type: "tag:created", payload: tag });
    });
    expect(onTagCreated).toHaveBeenCalledWith(tag);
  });
});

describe("useTranscriptStream — error message", () => {
  it("sets errorMessage and status 'error' on server error message", async () => {
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    await act(async () => {
      callbacks.onMessage({ type: "error", payload: { message: "session not found" } });
    });
    expect(result.current.errorMessage).toBe("session not found");
    expect(result.current.status).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// sessionId change — clear and reload
// ---------------------------------------------------------------------------

describe("useTranscriptStream — sessionId change", () => {
  it("clears items immediately when sessionId changes", async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useTranscriptStream({ sessionId: id }),
      { initialProps: { id: "s1" } },
    );
    await act(async () => {
      callbacks.onMessage({ type: "transcript:chunk", payload: makeItem("i1") });
    });
    expect(result.current.items).toHaveLength(1);

    await act(async () => { rerender({ id: "s2" }); });
    expect(result.current.items).toHaveLength(0);
  });

  it("creates a new socket for the new sessionId", async () => {
    const { rerender } = renderHook(
      ({ id }: { id: string }) => useTranscriptStream({ sessionId: id }),
      { initialProps: { id: "s1" } },
    );
    await act(async () => { rerender({ id: "s2" }); });
    expect(createTranscriptSocket).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createTranscriptSocket).mock.calls[1][0].sessionId).toBe("s2");
  });
});

// ---------------------------------------------------------------------------
// IDB restore and save
// ---------------------------------------------------------------------------

describe("useTranscriptStream — IDB restore", () => {
  it("calls loadSession with the current sessionId on mount", async () => {
    renderHook(() => useTranscriptStream({ sessionId: "s-idb" }));
    await act(async () => {});
    expect(loadSession).toHaveBeenCalledWith("s-idb");
  });

  it("restores items from IDB when a saved session is found", async () => {
    vi.mocked(loadSession).mockResolvedValueOnce({
      id: "s1",
      transcript: [{ id: "old1", text: "old text", timestamp: "t", speakerId: "sp" }],
      tags: [],
      events: [],
      updatedAt: "t",
    });
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    await act(async () => {});
    expect(result.current.items[0]?.id).toBe("old1");
  });

  it("does not set items when IDB returns null", async () => {
    vi.mocked(loadSession).mockResolvedValueOnce(null);
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    await act(async () => {});
    expect(result.current.items).toHaveLength(0);
  });
});

describe("useTranscriptStream — IDB save debounce", () => {
  it("calls saveSession after 2000 ms debounce when items arrive", async () => {
    const { } = renderHook(() => useTranscriptStream({ sessionId: "s1" }));
    await act(async () => {
      callbacks.onMessage({ type: "transcript:chunk", payload: makeItem("i1") });
    });
    expect(saveSession).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(saveSession).toHaveBeenCalledOnce();
    expect(vi.mocked(saveSession).mock.calls[0][0].id).toBe("s1");
  });

  it("resets the debounce timer when items arrive again before 2000 ms", async () => {
    renderHook(() => useTranscriptStream({ sessionId: "s1" }));
    await act(async () => {
      callbacks.onMessage({ type: "transcript:chunk", payload: makeItem("i1") });
    });
    await act(async () => { vi.advanceTimersByTime(1000); });

    await act(async () => {
      callbacks.onMessage({ type: "transcript:chunk", payload: makeItem("i2") });
    });
    await act(async () => { vi.advanceTimersByTime(1000); });
    // Total elapsed 2000ms but timer was reset — not yet 2000ms since last chunk
    expect(saveSession).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(saveSession).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// sendChunk action
// ---------------------------------------------------------------------------

describe("useTranscriptStream — sendChunk", () => {
  it("returns false and does not send when socket is not OPEN", () => {
    mockSocket.readyState = WebSocket.CONNECTING;
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    const sent = result.current.sendChunk({ text: "hello" });
    expect(sent).toBe(false);
    expect(sendTranscriptChunk).not.toHaveBeenCalled();
  });

  it("returns true, appends optimistic item, then calls sendTranscriptChunk when socket is OPEN", async () => {
    mockSocket.readyState = WebSocket.OPEN;
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    let sent = false;
    await act(async () => {
      sent = result.current.sendChunk({ text: "hello" });
    });
    expect(sent).toBe(true);
    expect(sendTranscriptChunk).toHaveBeenCalledWith(
      mockSocket,
      "s1",
      { text: "hello", speakerId: "speaker-1" },
    );
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].text).toBe("hello");
    expect(result.current.items[0].id.startsWith("client-pending:")).toBe(true);
  });

  it("returns false for whitespace-only text", async () => {
    mockSocket.readyState = WebSocket.OPEN;
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    let sent = true;
    await act(async () => {
      sent = result.current.sendChunk({ text: "   " });
    });
    expect(sent).toBe(false);
    expect(sendTranscriptChunk).not.toHaveBeenCalled();
  });

  it("replaces optimistic row when transcript:chunk echoes from server", async () => {
    mockSocket.readyState = WebSocket.OPEN;
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    await act(async () => {
      result.current.sendChunk({ text: "hi", speakerId: "a" });
    });
    const pendingId = result.current.items[0].id;
    await act(async () => {
      callbacks.onMessage({
        type: "transcript:chunk",
        payload: {
          id: "server-uuid-1",
          text: "hi",
          timestamp: "2024-01-02T00:00:00.000Z",
          speakerId: "a",
          formattedTime: "12:00:00 AM",
        },
      });
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe("server-uuid-1");
    expect(result.current.items[0].id).not.toBe(pendingId);
  });
});

// ---------------------------------------------------------------------------
// createTag action
// ---------------------------------------------------------------------------

describe("useTranscriptStream — createTag", () => {
  it("returns false and does not send when socket is not OPEN", () => {
    mockSocket.readyState = WebSocket.CLOSED;
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    const sent = result.current.createTag({ label: "insight" });
    expect(sent).toBe(false);
    expect(sendTranscriptTag).not.toHaveBeenCalled();
  });

  it("returns true and calls sendTranscriptTag when socket is OPEN", () => {
    mockSocket.readyState = WebSocket.OPEN;
    const { result } = renderHook(() =>
      useTranscriptStream({ sessionId: "s1" }),
    );
    const sent = result.current.createTag({ label: "insight", createdBy: "user1" });
    expect(sent).toBe(true);
    expect(sendTranscriptTag).toHaveBeenCalledWith(
      mockSocket,
      expect.objectContaining({ sessionId: "s1", label: "insight", createdBy: "user1" }),
    );
  });
});
