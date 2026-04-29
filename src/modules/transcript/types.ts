export interface TranscriptItem {
  id: string;
  text: string;
  timestamp: string;
  speakerId: string;
                                                                               
  formattedTime: string;
}

export interface TranscriptChunkInput {
  text: string;
  speakerId?: string;
  timestamp?: string;
  context?: Record<string, string>;
}

export interface TranscriptSocketTag {
  id: string;
  sessionId: string;
  transcriptId?: string;
  label: string;
  createdAt: string;
  metadata?: Record<string, string>;
}

export interface TranscriptSocketPrompt {
  id: string;
  sessionId: string;
  title: string;
  text: string;
  timestamp: string;
  transcriptIds: string[];
  suggestionOrigin?: "model" | "local";
}

export interface TranscriptSignalCue {
  id: string;
  sessionId: string;
  transcriptId?: string;
  kind: "silence" | "sentiment-shift" | "keyword";
  label: string;
  timestamp: string;
}

export interface TranscriptSessionState {
  session: {
    id: string;
    context: Record<string, string>;
    createdAt: string;
    updatedAt: string;
  };
  transcriptEntries: Array<{
    id: string;
    sessionId: string;
    text: string;
    timestamp: string;
    speakerId: string;
  }>;
  tags: TranscriptSocketTag[];
  prompts: TranscriptSocketPrompt[];
  signals: TranscriptSignalCue[];
  events: Array<{
    id: string;
    sessionId: string;
    type: string;
    timestamp: string;
    payload: Record<string, unknown>;
  }>;
}

export type TranscriptSocketServerMessage =
  | { type: "connection:ready" }
  | { type: "session:state"; payload: TranscriptSessionState }
  | { type: "transcript:chunk"; payload: TranscriptItem }
  | { type: "prompt:update"; payload: TranscriptSocketPrompt[] }
  | { type: "tag:created"; payload: TranscriptSocketTag }
  | { type: "signal:detected"; payload: TranscriptSignalCue[] }
  | { type: "error"; payload: { message: string } }
  | { type: "TRANSCRIPT_PARTIAL"; payload: { id: string; sessionId: string; speakerId: string } }
  | { type: "TRANSCRIPT_PARTIAL_CANCEL"; payload: { id: string } }
  | { type: "TRANSCRIPT_FINAL"; payload: TranscriptItem & { partialId: string } }
  | { type: "AI_SUGGESTION"; payload: TranscriptSocketPrompt[] };

export type TranscriptStreamStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";
