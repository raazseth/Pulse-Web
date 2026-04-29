/**
 * Interviewee = your microphone (answers). Interviewer = system/tab-captured call audio (them).
 * Transcript speakerId values in INTERVIEWEE_IDS drive AI follow-ups (when you speak).
 */
const INTERVIEWEE_IDS = new Set(
  [
    "interviewee",
    "candidate",
    "guest",
    "participant",
    "observer",
    "mic",
    "me",
    "self",
    "speaker-1", // legacy default — mic / interviewee for AI follow-ups
  ].map((s) => s.toLowerCase()),
);

export function isIntervieweeSpeaker(speakerId: string | undefined): boolean {
  const s = String(speakerId ?? "").trim().toLowerCase();
  return INTERVIEWEE_IDS.has(s);
}

export function intervieweeUiLabel(speakerId: string | undefined): string {
  const s = String(speakerId ?? "").trim().toLowerCase();
  if (s === "interviewee" || s === "mic" || s === "me" || s === "self" || s === "speaker-1") return "You (mic)";
  if (s) return s.charAt(0).toUpperCase() + s.slice(1);
  return "Interviewee";
}

/** Labels for system-captured or manually tagged interviewer lines. */
export function interviewerSideUiLabel(speakerId: string | undefined): string {
  const s = String(speakerId ?? "").trim().toLowerCase();
  if (s === "system") return "Interviewer (system audio)";
  if (s === "interviewer") return "Interviewer";
  if (s) return s.charAt(0).toUpperCase() + s.slice(1);
  return "Interviewer";
}
