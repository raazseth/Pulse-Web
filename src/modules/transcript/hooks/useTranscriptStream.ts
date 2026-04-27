import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { DESKTOP_SENTINEL } from "@/shared/constants/auth";
import {
  createTranscriptSocket,
  sendTranscriptChunk,
  sendTranscriptTag,
} from "@/modules/transcript/services/transcriptSocket";
import {
  IdbTranscriptEntry,
  loadSession,
  saveSession,
} from "@/shared/services/sessionIdb";
import {
  TranscriptChunkInput,
  TranscriptItem,
  TranscriptSessionState,
  TranscriptSignalCue,
  TranscriptSocketPrompt,
  TranscriptSocketTag,
  TranscriptStreamStatus,
} from "@/modules/transcript/types";
import { formatClock } from "@/shared/utils/formatters";
import { resolveTranscriptWsUrl } from "@/shared/utils/hudApiBaseUrl";

const MAX_ITEMS = 800;

function capBeforeAppend<T>(items: T[]): T[] {
  return items.length >= MAX_ITEMS ? items.slice(-(MAX_ITEMS - 1)) : items;
}

interface UseTranscriptStreamOptions {
  sessionId: string;
  accessToken?: string | null;
  refreshAccessToken?: () => Promise<string | null>;
  onSessionState?: (state: TranscriptSessionState) => void;
  onTagCreated?: (tag: TranscriptSocketTag) => void;
}

function mapIdbEntry(entry: IdbTranscriptEntry): TranscriptItem {
  return {
    id: entry.id,
    text: entry.text,
    timestamp: entry.timestamp,
    speakerId: entry.speakerId,
    formattedTime: formatClock(entry.timestamp),
  };
}

function stampItem(item: Omit<TranscriptItem, "formattedTime"> & Partial<TranscriptItem>): TranscriptItem {
  return { ...item, formattedTime: item.formattedTime ?? formatClock(item.timestamp) };
}

export function useTranscriptStream({
  sessionId,
  accessToken,
  refreshAccessToken,
  onSessionState,
  onTagCreated,
}: UseTranscriptStreamOptions) {
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [prompts, setPrompts] = useState<TranscriptSocketPrompt[]>([]);
  const [signals, setSignals] = useState<TranscriptSignalCue[]>([]);
  const [status, setStatus] = useState<TranscriptStreamStatus>("connecting");
  const [errorMessage, setErrorMessage] = useState<string>();
  const reconnectTimer = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const idbSaveTimer = useRef<number | null>(null);
  const accessTokenRef = useRef<string | null>(accessToken ?? null);
  useEffect(() => { accessTokenRef.current = accessToken ?? null; });

  const refreshAccessTokenRef = useRef(refreshAccessToken);
  useEffect(() => { refreshAccessTokenRef.current = refreshAccessToken; });

  const optimisticPendingRef = useRef<{ clientId: string; text: string; speakerId: string }[]>([]);

  const handleState = useEffectEvent((state: TranscriptSessionState) => {
    optimisticPendingRef.current = [];
    startTransition(() => {
      setItems(state.transcriptEntries.map(stampItem));
      setPrompts(state.prompts);
      setSignals(state.signals ?? []);
    });
    onSessionState?.(state);
  });

  const handleTag = useEffectEvent((tag: TranscriptSocketTag) => {
    onTagCreated?.(tag);
  });

  const handleIncoming = useEffectEvent((message: {
    type: string;
    payload?: unknown;
  }) => {
    if (message.type === "session:state" && message.payload) {
      handleState(message.payload as TranscriptSessionState);
      return;
    }

    if (message.type === "transcript:chunk" && message.payload) {
      const item = stampItem(message.payload as TranscriptItem);
      const trimmedText = item.text.trim();
      const speaker = item.speakerId;
      startTransition(() => {
        setItems((current) => {
          const queue = optimisticPendingRef.current;
          const idx = queue.findIndex(
            (p) => p.text === trimmedText && p.speakerId === speaker,
          );
          let next = current;
          if (idx >= 0) {
            const { clientId } = queue[idx];
            queue.splice(idx, 1);
            next = next.filter((e) => e.id !== clientId);
          }
          if (next.some((e) => e.id === item.id)) return next;
          return [...capBeforeAppend(next), item];
        });
      });
      return;
    }

    if (message.type === "prompt:update" && message.payload) {
      const incoming = message.payload as TranscriptSocketPrompt[];
      setPrompts((current) => {
        if (
          current.length === incoming.length &&
          current.every((p, i) => p.id === incoming[i].id)
        ) {
          return current;
        }
        return incoming;
      });
      return;
    }

    if (message.type === "tag:created" && message.payload) {
      handleTag(message.payload as TranscriptSocketTag);
      return;
    }

    if (message.type === "signal:detected" && message.payload) {
      const incoming = message.payload as TranscriptSignalCue[];
      startTransition(() => {
        setSignals((current) => {
          const existingIds = new Set(current.map((s) => s.id));
          const next = incoming.filter((s) => !existingIds.has(s.id));
          return next.length ? [...current, ...next] : current;
        });
      });
      return;
    }

    if (message.type === "error" && message.payload) {
      setErrorMessage((message.payload as { message: string }).message);
      setStatus("error");
    }
  });

  useEffect(() => {
    let isStopped = false;

    const connect = () => {
      if (isStopped) return;

      setErrorMessage(undefined);
      setStatus((current) =>
        current === "connected" ? "connected" : "connecting",
      );

      const token = accessTokenRef.current;
      const socket = createTranscriptSocket({
        url: resolveTranscriptWsUrl(),
        sessionId,
        token: token === DESKTOP_SENTINEL ? null : token,
        onOpen: () => setStatus("connected"),
        onClose: (wasError) => {
          if (isStopped) {
            setStatus("disconnected");
            return;
          }
          if (!wasError) {
            setStatus("reconnecting");
          }
          reconnectTimer.current = window.setTimeout(() => {
            if (isStopped) return;
            const refresh = refreshAccessTokenRef.current;
            if (wasError && refresh) {
              refresh().catch(() => {}).finally(() => { if (!isStopped) connect(); });
            } else {
              connect();
            }
          }, 1600);
        },
        onError: () => setStatus("error"),
        onMessage: handleIncoming,
      });

      socketRef.current = socket;
    };

    connect();

    return () => {
      isStopped = true;
      if (reconnectTimer.current !== null) {
        window.clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    startTransition(() => {
      setItems([]);
      setPrompts([]);
      setSignals([]);
      setErrorMessage(undefined);
    });
  }, [sessionId]);

  useEffect(() => {
    loadSession(sessionId)
      .then((saved) => {
        if (saved && saved.transcript.length > 0) {
          startTransition(() => {
            setItems(saved.transcript.map(mapIdbEntry));
          });
        }
      })
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    if (items.length === 0) return;
    if (idbSaveTimer.current) clearTimeout(idbSaveTimer.current);
    idbSaveTimer.current = window.setTimeout(() => {
      saveSession({
        id: sessionId,
        transcript: items,
        tags: [],
        events: [],
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }, 2000);
    return () => {
      if (idbSaveTimer.current) clearTimeout(idbSaveTimer.current);
    };
  }, [sessionId, items]);

  const actions = useMemo(
    () => ({
      sendChunk(payload: TranscriptChunkInput) {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
          return false;
        }
        const text = payload.text.trim();
        if (!text) return false;
        const speakerId = payload.speakerId?.trim() || "speaker-1";
        const timestamp = payload.timestamp ?? new Date().toISOString();
        const pendingId = `client-pending:${crypto.randomUUID()}`;
        optimisticPendingRef.current.push({
          clientId: pendingId,
          text,
          speakerId,
        });
        startTransition(() => {
          setItems((current) => {
            const optimistic = stampItem({
              id: pendingId,
              text,
              timestamp,
              speakerId,
            });
            return [...capBeforeAppend(current), optimistic];
          });
        });
        sendTranscriptChunk(socketRef.current, sessionId, { ...payload, text, speakerId });
        return true;
      },
      createTag(payload: {
        label: string;
        transcriptId?: string;
        createdBy?: string;
        metadata?: Record<string, string>;
      }) {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
          return false;
        }
        sendTranscriptTag(socketRef.current, { sessionId, ...payload });
        return true;
      },
    }),
    [sessionId],
  );

  return { items, prompts, signals, status, errorMessage, ...actions };
}
