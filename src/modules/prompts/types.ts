export interface PromptSuggestion {
  id: string;
  sessionId?: string;
  title: string;
  body: string;
  transcriptId?: string;
  transcriptIds?: string[];
  /** ISO time; may be aligned to a referenced transcript line after enrichment. */
  timestamp: string;
  /** When set, prefer this for the time chip (matches transcript row clock). */
  transcriptTimeLabel?: string;
  /**
   * `model` — from the HUD / AI pipeline (WebSocket or API).
   * `local` — client-side keyword rules or static fallback text (no model call).
   */
  suggestionOrigin?: "model" | "local";
}
