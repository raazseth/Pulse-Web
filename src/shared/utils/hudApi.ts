import { DESKTOP_SENTINEL } from "@/shared/constants/auth";
import { resolveHudApiBaseUrl } from "@/shared/utils/hudApiBaseUrl";

/** Resolve at call time — required for Electron `file://` + `window.api.serverPort`. */
function apiBase(): string {
  return resolveHudApiBaseUrl();
}

const hud = (path: string) => `${apiBase()}/hud${path}`;
const session = (sessionId: string) => hud(`/sessions/${encodeURIComponent(sessionId)}`);

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const getHudSessionsUrl    = ()                                   => hud("/sessions");
export const getHudSessionUrl     = (sessionId: string)                  => session(sessionId);
export const getHudSessionStatusUrl = (sessionId: string)                => `${session(sessionId)}/status`;
export const getHudContextUrl     = (sessionId: string)                  => `${session(sessionId)}/context`;
export const getHudExportUrl      = (sessionId: string, format: "json" | "csv") => {
  const search = new URLSearchParams({ format });
  return `${session(sessionId)}/export?${search.toString()}`;
};

// ─── Transcript & Tags ────────────────────────────────────────────────────────

export const getHudTranscriptUrl  = (sessionId: string)                  => `${session(sessionId)}/transcript`;
export const getHudTagsUrl        = (sessionId: string)                  => `${session(sessionId)}/tags`;

// ─── Notes ────────────────────────────────────────────────────────────────────

export const getHudNotesUrl       = (sessionId: string)                  => `${session(sessionId)}/notes`;
export const getHudNoteUrl        = (sessionId: string, noteId: string)  => `${session(sessionId)}/notes/${encodeURIComponent(noteId)}`;

// ─── AI Prompts ───────────────────────────────────────────────────────────────

export const getHudPromptsUrl     = (sessionId: string)                  => `${session(sessionId)}/prompts`;
export const getHudPromptUrl      = (sessionId: string, promptId: string) => `${session(sessionId)}/prompts/${encodeURIComponent(promptId)}`;

// ─── Note-Tag Linking ─────────────────────────────────────────────────────────

export const getHudNoteTagsUrl    = (sessionId: string, noteId: string)  => `${getHudNoteUrl(sessionId, noteId)}/tags`;
export const getHudNoteTagUrl     = (sessionId: string, noteId: string, tagId: string) => `${getHudNoteUrl(sessionId, noteId)}/tags/${encodeURIComponent(tagId)}`;

// ─── Audio ────────────────────────────────────────────────────────────────────

export const getAudioTranscribeUrl = () => hud("/audio/transcribe");

// ─── Auth headers ─────────────────────────────────────────────────────────────

export function getAuthHeaders(accessToken: string | null): Record<string, string> {
  if (!accessToken || accessToken === DESKTOP_SENTINEL) return {};
  return { Authorization: `Bearer ${accessToken}` };
}
