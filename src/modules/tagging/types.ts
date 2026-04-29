export interface TagOption {
  id: string;
  label: string;
  color: "default" | "primary" | "secondary" | "success" | "warning" | "error" | "info";                                    
  shortLabel?: string;
  shortcutDigit?: string;
}

export interface TranscriptTag {
  id: string;
  tagId: string;
  transcriptId?: string;
  timestamp: string;
  transcriptLineAt?: string;
  messagePreview?: string;
}
