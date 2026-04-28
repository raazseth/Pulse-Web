import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
  type IdbSession,
} from "./sessionIdb";

interface HandlerSlots {
  oncomplete: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  reqOnsuccess: (() => void) | null;
  reqResult: unknown;
}

function makeIdbMock() {
  const slots: HandlerSlots = {
    oncomplete: null,
    onerror: null,
    onabort: null,
    reqOnsuccess: null,
    reqResult: undefined,
  };

  const req = {
    get onsuccess() {
      return slots.reqOnsuccess;
    },
    set onsuccess(fn: (() => void) | null) {
      slots.reqOnsuccess = fn;
    },
    onerror: null as (() => void) | null,
    get result() {
      return slots.reqResult;
    },
    set result(v: unknown) {
      slots.reqResult = v;
    },
    error: new DOMException("req mock error"),
  };

  const store = {
    put: vi.fn().mockReturnValue(req),
    get: vi.fn().mockReturnValue(req),
    delete: vi.fn().mockReturnValue(req),
    getAll: vi.fn().mockReturnValue(req),
  };

  const tx = {
    get oncomplete() {
      return slots.oncomplete;
    },
    set oncomplete(fn: (() => void) | null) {
      slots.oncomplete = fn;
    },
    get onerror() {
      return slots.onerror;
    },
    set onerror(fn: (() => void) | null) {
      slots.onerror = fn;
    },
    get onabort() {
      return slots.onabort;
    },
    set onabort(fn: (() => void) | null) {
      slots.onabort = fn;
    },
    error: new DOMException("tx mock error"),
    objectStore: vi.fn().mockReturnValue(store),
  };

  const db = {
    close: vi.fn(),
    transaction: vi.fn().mockReturnValue(tx),
  };

  const openReq = {
    onupgradeneeded: null as (() => void) | null,
    onerror: null as (() => void) | null,
    result: db,
    set onsuccess(fn: () => void) {
      fn();
    },
  };

  vi.stubGlobal("indexedDB", { open: vi.fn().mockReturnValue(openReq) });

  const fire = {
    success() {
      slots.reqOnsuccess?.();
      slots.oncomplete?.();
    },
    txError() {
      slots.onerror?.();
    },
    txAbort() {
      slots.onabort?.();
    },
    reqSuccess(result: unknown) {
      slots.reqResult = result;
      slots.reqOnsuccess?.();
      slots.oncomplete?.();
    },
  };

  return { db, slots, fire };
}

const flush = () => Promise.resolve();

let mock: ReturnType<typeof makeIdbMock>;

beforeEach(() => {
  mock = makeIdbMock();
});

describe("saveSession", () => {
  const session: IdbSession = {
    id: "s1",
    transcript: [],
    tags: [],
    events: [],
    updatedAt: "2024-01-01T00:00:00.000Z",
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

describe("loadSession", () => {
  const stored: IdbSession = {
    id: "s1",
    transcript: [],
    tags: [],
    events: [],
    updatedAt: "t",
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
    mock.fire.reqSuccess(undefined);
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
