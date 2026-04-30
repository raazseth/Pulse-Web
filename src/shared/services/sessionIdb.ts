const DB_NAME = "pulse-hud";
const DB_VERSION = 1;
const STORE_NAME = "sessions";

export interface IdbTranscriptEntry {
  id: string;
  text: string;
  timestamp: string;
  speakerId: string;
}

export interface IdbSessionTag {
  id: string;
  label: string;
  transcriptId?: string;
  timestamp: string;
  metadata?: Record<string, string>;
}

export interface IdbSessionEvent {
  id: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface IdbSession {
  id: string;
  transcript: IdbTranscriptEntry[];
  tags: IdbSessionTag[];
  events: IdbSessionEvent[];
  metadata?: Record<string, unknown>;
  updatedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSession(session: IdbSession): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({
      ...session,
      updatedAt: session.updatedAt || new Date().toISOString(),
    });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(new Error("saveSession: transaction aborted")); };
  });
}

export async function loadSession(sessionId: string): Promise<IdbSession | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(sessionId);

    req.onsuccess = () => resolve((req.result as IdbSession) ?? null);
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(new Error("loadSession: transaction aborted")); };
  });
}

export async function listSessions(): Promise<IdbSession[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();

    req.onsuccess = () => resolve(req.result as IdbSession[]);
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(new Error("listSessions: transaction aborted")); };
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(sessionId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(new Error("deleteSession: transaction aborted")); };
  });
}

export function deleteTranscriptDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("deleteDatabase failed"));
    req.onblocked = () => resolve();
  });
}

