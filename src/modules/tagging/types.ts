export interface TagOption {
  id: string;
  label: string;
  color: "default" | "primary" | "secondary" | "success" | "warning" | "error" | "info";
  /** Abbreviation shown next to the tag label (e.g. "INS"). */
  shortLabel?: string;
  /** Shortcut digit 1–9 shown on the chip; defaults to order in the tag list. */
  shortcutDigit?: string;
}

export interface TranscriptTag {
  id: string;
  tagId: string;
  transcriptId?: string;
  timestamp: string;
}
