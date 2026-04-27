import { SessionMetadata, SessionNote } from "../../modules/context/types";
import { TranscriptTag } from "../../modules/tagging/types";

export interface SessionSnapshot {
  sessionId: string;
  metadata: SessionMetadata;
  notes: SessionNote[];
  tags: TranscriptTag[];
  selectedTranscriptId?: string;
  focusedTagId: string;
}
