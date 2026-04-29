import { resolveHudApiBaseUrl } from "@/shared/utils/hudApiBaseUrl";

function apiBase(): string {
  return resolveHudApiBaseUrl();
}

const hud = (path: string) => `${apiBase()}/hud${path}`;
const session = (sessionId: string) => hud(`/sessions/${encodeURIComponent(sessionId)}`);

export const getHudSessionsUrl = () => hud("/sessions");
export const getHudSessionUrl = (sessionId: string) => session(sessionId);
export const getHudSessionStatusUrl = (sessionId: string) => `${session(sessionId)}/status`;
export const getHudContextUrl = (sessionId: string) => `${session(sessionId)}/context`;
export const getHudExportUrl = (sessionId: string, format: "json" | "csv") => {
  const search = new URLSearchParams({ format });
  return `${session(sessionId)}/export?${search.toString()}`;
};

export const getHudTranscriptUrl = (sessionId: string) => `${session(sessionId)}/transcript`;
export const getHudTagsUrl = (sessionId: string) => `${session(sessionId)}/tags`;

export const getHudNotesUrl = (sessionId: string) => `${session(sessionId)}/notes`;
export const getHudNoteUrl = (sessionId: string, noteId: string) => `${session(sessionId)}/notes/${encodeURIComponent(noteId)}`;

export const getHudPromptsUrl = (sessionId: string) => `${session(sessionId)}/prompts`;
export const getHudPromptUrl = (sessionId: string, promptId: string) => `${session(sessionId)}/prompts/${encodeURIComponent(promptId)}`;

export const getHudNoteTagsUrl = (sessionId: string, noteId: string) => `${getHudNoteUrl(sessionId, noteId)}/tags`;
export const getHudNoteTagUrl = (sessionId: string, noteId: string, tagId: string) => `${getHudNoteUrl(sessionId, noteId)}/tags/${encodeURIComponent(tagId)}`;

export const getAudioTranscribeUrl = () => hud("/audio/transcribe");

export const getHudSessionStartUrl = (sessionId: string) => `${session(sessionId)}/start`;
export const getHudSessionStopUrl = (sessionId: string) => `${session(sessionId)}/stop`;

export function getAuthHeaders(accessToken: string | null): Record<string, string> {
  if (!accessToken) return {};
  return { Authorization: `Bearer ${accessToken}` };
}
