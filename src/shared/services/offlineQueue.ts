
const DB_NAME = "pulse-hud-queue";
const DB_VERSION = 1;
const STORE_NAME = "mutations";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type QueuedMutation =
  | {
      id: string;
      type: "transcript:chunk";
      sessionId: string;
      enqueuedAt: string;
      payload: {
        text: string;
        speakerId?: string;
        timestamp?: string;
        context?: Record<string, string>;
      };
    }
  | {
      id: string;
      type: "tag:create";
      sessionId: string;
      enqueuedAt: string;
      payload: {
        label: string;
        transcriptId?: string;
        createdBy?: string;
        metadata?: Record<string, string>;
      };
    };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("by_session", ["sessionId", "enqueuedAt"], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueOfflineMutation(
  mutation: Omit<QueuedMutation, "id" | "enqueuedAt">,
): Promise<void> {
  const entry: QueuedMutation = {
    ...mutation,
    id: crypto.randomUUID(),
    enqueuedAt: new Date().toISOString(),
  } as QueuedMutation;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function drainOfflineQueue(sessionId: string): Promise<QueuedMutation[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const all = store.getAll();
    all.onsuccess = () => {
      const now = Date.now();
      const rows = (all.result as QueuedMutation[])
        .filter((m) => m.sessionId === sessionId)
        .filter((m) => now - Date.parse(m.enqueuedAt) < MAX_AGE_MS)
        .sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));

      const toDelete = (all.result as QueuedMutation[]).filter(
        (m) => m.sessionId === sessionId,
      );
      for (const m of toDelete) store.delete(m.id);
      tx.oncomplete = () => { db.close(); resolve(rows); };
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(new Error("drainOfflineQueue aborted")); };
  });
}

export async function clearOfflineQueue(sessionId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const all = store.getAll();
    all.onsuccess = () => {
      for (const m of all.result as QueuedMutation[]) {
        if (m.sessionId === sessionId) store.delete(m.id);
      }
      tx.oncomplete = () => { db.close(); resolve(); };
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
