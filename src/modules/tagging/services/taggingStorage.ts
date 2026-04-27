import { TagOption } from "@/modules/tagging/types";

export const defaultTagOptions: TagOption[] = [
  { id: "insight", label: "Insight", color: "primary", shortLabel: "INS", shortcutDigit: "1" },
  { id: "follow-up", label: "Follow up", color: "secondary", shortLabel: "FU", shortcutDigit: "2" },
  { id: "risk", label: "Risk", color: "warning", shortLabel: "RSK", shortcutDigit: "3" },
  { id: "quote", label: "Quote", color: "success", shortLabel: "QUO", shortcutDigit: "4" },
  { id: "frustration", label: "Frustration", color: "error", shortLabel: "FRU", shortcutDigit: "5" },
  { id: "delight", label: "Delight", color: "info", shortLabel: "DLT", shortcutDigit: "6" },
];
