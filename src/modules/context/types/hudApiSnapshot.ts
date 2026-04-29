import type { SessionStatus } from "@/modules/context/types";

/** GET /hud/sessions/:id full payload (matches server SessionSnapshot). */
export type HudApiFullSnapshot = {
  session: {
    id: string;
    context: Record<string, string>;
    title: string;
    facilitator: string;
    audience: string;
    role: string;
    status: SessionStatus;
    createdAt: string;
    updatedAt: string;
  };
  notes?: Array<{
    id: string;
    sessionId?: string;
    label?: string;
    body: string;
    linkedTagIds?: string[];
    createdAt?: string;
    updatedAt?: string;
  }>;
  tags: Array<{
    id: string;
    sessionId: string;
    transcriptId?: string;
    label: string;
    createdAt: string;
    metadata?: Record<string, string>;
  }>;
  transcriptEntries: unknown[];
  prompts: unknown[];
  events: unknown[];
  signals: unknown[];
};

export type HudSessionsListPayload = {
  sessions: Array<{
    id: string;
    title: string;
    status: SessionStatus;
    noteCount: number;
    createdAt: string;
    updatedAt?: string;
  }>;
  lastActiveSessionId: string | null;
  lastActiveSession?: {
    id: string;
    title: string;
    status: SessionStatus;
    noteCount: number;
    createdAt: string;
    updatedAt?: string;
  } | null;
};
