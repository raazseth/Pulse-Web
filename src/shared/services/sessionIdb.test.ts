import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
  type IdbSession,
} from "./sessionIdb";

// ---------------------------------------------------------------------------
// IDB mock design
//
// The functions under test call `await openDb()` internally, then synchronously
// set up tx.oncomplete / tx.onerror / tx.onabort handlers.  Because `await`
// always introduces a microtask boundary, we need to flush the queue (via
// `await Promise.resolve()`) between calling the function under test and
// firing the handlers.  Otherwise the handlers haven't been assigned yet.
//
// We capture live references to the handler slots so we don't need to look
// them up via `.mock.results`, which had the same timing problem.
// ---------------------------------------------------------------------------

interface HandlerSlots {
  oncomplete: (() => void) | null;
  onerror:    (() => void) | null;
  onabort:    (() => void) | null;
  reqOnsuccess: (() => void) | null;
  reqResult: unknown;
}

function makeIdbMock() {
  const slots: HandlerSlots = {
    oncomplete:   null,
    onerror:      null,
    onabort:      null,
    reqOnsuccess: null,
    reqResult:    undefined,
  };

  // A request whose handlers are captured into `slots`.
  const req = {
    get onsuccess() { return slots.reqOnsuccess; },
    set onsuccess(fn: (() => void) | null) { slots.reqOnsuccess = fn; },
    onerror:   null as (() => void) | null,
    get result() { return slots.reqResult; },
    set result(v: unknown) { slots.reqResult = v; },
    error: new DOMException("req mock error"),
  };

  const store = {
    put:    vi.fn().mockReturnValue(req),
    get:    vi.fn().mockReturnValue(req),
    delete: vi.fn().mockReturnValue(req),
    getAll: vi.fn().mockReturnValue(req),
  };

  // A transaction whose lifecycle handlers are captured into `slots`.
  const tx = {
    get oncomplete() { return slots.oncomplete; },
    set oncomplete(fn: (() => void) | null) { slots.oncomplete = fn; },
    get onerror() { return slots.onerror; },
    set onerror(fn: (() => void) | null) { slots.onerror = fn; },
    get onabort() { return slots.onabort; },
    set onabort(fn: (() => void) | null) { slots.onabort = fn; },
    error: new DOMException("tx mock error"),
    objectStore: vi.fn().mockReturnValue(store),
  };

  const db = {
    close: vi.fn(),
    transaction: vi.fn().mockReturnValue(tx),
  };

  // The open-request fires onsuccess synchronously when assigned —
  // this mirrors how our real code uses it and lets `openDb()` resolve
  // as a microtask without needing a separate trigger.
  const openReq = {
    onupgradeneeded: null as (() => void) | null,
    onerror:         null as (() => void) | null,
    result:          db,
    set onsuccess(fn: () => void) { fn(); },
  };

  vi.stubGlobal("indexedDB", { open: vi.fn().mockReturnValue(openReq) });

  // fire() lets tests trigger the terminal IDB event after microtasks flush.
  const fire = {
    success()   { slots.reqOnsuccess?.(); slots.oncomplete?.(); },
    txError()   { slots.onerror?.(); },
    txAbort()   { slots.onabort?.(); },
    reqSuccess(result: unknown) {
      slots.reqResult = result;
      slots.reqOnsuccess?.();
      slots.oncomplete?.();
    },
  };

  return { db, slots, fire };
}

// One flush is enough: openDb() resolves in the first microtask after
// the Promise executor fires onsuccess.
const flush = () => Promise.resolve();

let mock: ReturnType<typeof makeIdbMock>;

beforeEach(() => {
  mock = makeIdbMock();
});

// ---------------------------------------------------------------------------
// saveSession
// ---------------------------------------------------------------------------

describe("saveSession", () => {
  const session: IdbSession = {
    id: "s1", transcript: [], tags: [], events: [], updatedAt: "2024-01-01T00:00:00.000Z",
  };

  it("resolves when tx.oncomplete fires", async () => {
    const p = saveSession(session);
    await flush();
    mock.fire.success();
    await expect(p).resolves.toBeUndefined();
  });

  it("calls db.close() on success (tx.oncomplete)", async () => {
    const p = saveSession(session);
    await flush();
    mock.fire.success();
    await p;
    expect(mock.db.close).toHaveBeenCalledOnce();
  });

  it("rejects and calls db.close() on error (tx.onerror)", async () => {
    const p = saveSession(session);
    await flush();
    mock.fire.txError();
    await expect(p).rejects.toBeDefined();
    expect(mock.db.close).toHaveBeenCalledOnce();
  });

  it("rejects and calls db.close() on abort (tx.onabort)", async () => {
    const p = saveSession({ ...session, id: "s2" });
    await flush();
    mock.fire.txAbort();
    await expect(p).rejects.toThrow(/aborted/i);
    expect(mock.db.close).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// loadSession
// ---------------------------------------------------------------------------

describe("loadSession", () => {
  const stored: IdbSession = {
    id: "s1", transcript: [], tags: [], events: [], updatedAt: "t",
  };

  it("resolves with the session record on success", async () => {
    const p = loadSession("s1");
    await flush();
    mock.fire.reqSuccess(stored);
    await expect(p).resolves.toEqual(stored);
  });

  it("resolves with null when the record is missing", async () => {
    const p = loadSession("missing");
    await flush();
    mock.fire.reqSuccess(undefined); // IDB returns undefined for missing keys
    await expect(p).resolves.toBeNull();
  });

  it("calls db.close() on success", async () => {
    const p = loadSession("s1");
    await flush();
    mock.fire.reqSuccess(stored);
    await p;
    expect(mock.db.close).toHaveBeenCalledOnce();
  });

  it("rejects and calls db.close() on error", async () => {
    const p = loadSession("s1");
    await flush();
    mock.fire.txError();
    await expect(p).rejects.toBeDefined();
    expect(mock.db.close).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// deleteSession
// ---------------------------------------------------------------------------

describe("deleteSession", () => {
  it("resolves when tx.oncomplete fires", async () => {
    const p = deleteSession("s1");
    await flush();
    mock.fire.success();
    await expect(p).resolves.toBeUndefined();
  });

  it("calls db.close() on success", async () => {
    const p = deleteSession("s1");
    await flush();
    mock.fire.success();
    await p;
    expect(mock.db.close).toHaveBeenCalledOnce();
  });

  it("calls db.close() on error", async () => {
    const p = deleteSession("s1");
    await flush();
    mock.fire.txError();
    await expect(p).rejects.toBeDefined();
    expect(mock.db.close).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// listSessions
// ---------------------------------------------------------------------------

describe("listSessions", () => {
  it("resolves with the returned array on success", async () => {
    const sessions = [stored_s1()];
    const p = listSessions();
    await flush();
    mock.fire.reqSuccess(sessions);
    await expect(p).resolves.toEqual(sessions);
  });

  it("calls db.close() on success", async () => {
    const p = listSessions();
    await flush();
    mock.fire.reqSuccess([]);
    await p;
    expect(mock.db.close).toHaveBeenCalledOnce();
  });
});

function stored_s1(): IdbSession {
  return { id: "s1", transcript: [], tags: [], events: [], updatedAt: "t" };
}
