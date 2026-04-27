import { TranscriptTag } from "../tagging/types";

export type SessionStatus = "active" | "paused" | "ended";

export interface SessionNote {
  id: string;
  label?: string;
  body: string;
  linkedTagIds?: string[];
}

export interface SessionMetadata {
  title: string;
  facilitator: string;
  audience: string;
  role: string;
}

export interface SessionStoreState {
  sessionId: string;
  sessionStatus: SessionStatus;
  metadata: SessionMetadata;
  notes: SessionNote[];
  tags: TranscriptTag[];
  selectedTranscriptId?: string;
  focusedTagId: string;
}
