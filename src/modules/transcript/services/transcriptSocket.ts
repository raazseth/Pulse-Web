import {
  TranscriptChunkInput,
  TranscriptSocketServerMessage,
} from "@/modules/transcript/types";

export interface TranscriptSocketOptions {
  url: string;
  sessionId: string;
                                                                        
                                               
  token?: string | null;
  onMessage: (message: TranscriptSocketServerMessage) => void;
  onOpen: () => void;
                                                                              
                                                                         
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

  
  
  socket.addEventListener("error", () => {
    hasErrored = true;
    onError();
  });

  
  
  socket.addEventListener("close", () => {
    onClose(hasErrored);
  });

  socket.addEventListener("message", (event) => {
    let payload: TranscriptSocketServerMessage;
    try {
      payload = JSON.parse(event.data as string) as TranscriptSocketServerMessage;
    } catch {
      
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

export async function sendAudioChunk(
  socket: WebSocket,
  sessionId: string,
  payload: {
    audio: Blob;
    mimeType: string;
    speakerId?: string;
    lang?: string;
    context?: Record<string, string>;
  },
): Promise<void> {
  if (socket.readyState !== WebSocket.OPEN) return;
  const ab = await payload.audio.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...(bytes.subarray(i, i + CHUNK) as unknown as number[]));
  }
  socket.send(
    JSON.stringify({
      type: "audio:chunk",
      payload: {
        sessionId,
        audio: btoa(binary),
        mimeType: payload.mimeType,
        speakerId: payload.speakerId,
        lang: payload.lang,
        context: payload.context,
      },
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
