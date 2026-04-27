import { useMemo } from "react";
import { SessionNote } from "@/modules/context/types";

export function useEditableNotes(notes: SessionNote[]) {
  return useMemo(
    () => notes.map((note, index) => ({ ...note, label: note.label ?? `Note ${index + 1}` })),
    [notes],
  );
}
