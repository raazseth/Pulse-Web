import {
  TranscriptChunkInput,
  TranscriptSocketServerMessage,
} from "@/modules/transcript/types";

export interface TranscriptSocketOptions {
  url: string;
  sessionId: string;
  /** JWT access token appended as ?token=<value>. Omit or pass null for
   *  unauthenticated / desktop connections. */
  token?: string | null;
  onMessage: (message: TranscriptSocketServerMessage) => void;
  onOpen: () => void;
  /** wasError=true when close follows a socket error, so callers can preserve
   *  the "error" status instead of overriding it with "reconnecting". */
  onClose: (wasError: boolean) => void;
  onError: () => void;
}

export function createTranscriptSocket({
  url,
  sessionId,
  token,
  onClose,
  onError,
  onMessage,
  onOpen,
}: TranscriptSocketOptions) {
  const wsUrl = new URL(url);
  if (token) {
    wsUrl.searchParams.set("token", token);
  }
  const socket = new WebSocket(wsUrl.toString());
  let hasErrored = false;

  // Single "open" listener: call onOpen then send the subscription message.
  // This guarantees ordering — subscription is sent only after onOpen resolves.
  socket.addEventListener("open", () => {
    hasErrored = false;
    onOpen();
    socket.send(
      JSON.stringify({
        type: "session:subscribe",
        payload: { sessionId },
      }),
    );
  });

  // "error" always fires before "close" on connection failures.
  // Track the flag so the close handler can communicate the cause to callers.
  socket.addEventListener("error", () => {
    hasErrored = true;
    onError();
  });

  // Pass wasError so callers can decide whether to update status to
  // "reconnecting" (normal drop) or keep "error" (protocol/connection error).
  socket.addEventListener("close", () => {
    onClose(hasErrored);
  });

  socket.addEventListener("message", (event) => {
    let payload: TranscriptSocketServerMessage;
    try {
      payload = JSON.parse(event.data as string) as TranscriptSocketServerMessage;
    } catch {
      // Malformed frame — treat as a transient error, don't crash the handler.
      onError();
      return;
    }
    onMessage(payload);
  });

  return socket;
}

export function sendTranscriptChunk(
  socket: WebSocket,
  sessionId: string,
  payload: TranscriptChunkInput,
) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(
    JSON.stringify({
      type: "transcript:chunk",
      payload: { sessionId, ...payload },
    }),
  );
}

export function sendTranscriptTag(
  socket: WebSocket,
  payload: {
    sessionId: string;
    label: string;
    transcriptId?: string;
    createdBy?: string;
    metadata?: Record<string, string>;
  },
) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(
    JSON.stringify({
      type: "tag:create",
      payload,
    }),
  );
}
