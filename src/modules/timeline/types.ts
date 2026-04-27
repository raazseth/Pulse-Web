export type TimelineMarkerKind = "transcript" | "tag" | "prompt" | "signal";

export interface TimelineMarker {
  id: string;
  itemId?: string;
  kind: TimelineMarkerKind;
  label: string;
  timestamp: string;
}
