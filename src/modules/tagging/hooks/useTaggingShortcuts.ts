import { useEffect, useEffectEvent } from "react";
import type { TagOption } from "@/modules/tagging/types";
import { indexForPaletteDigit } from "@/modules/tagging/utils/paletteShortcut";

interface UseTaggingShortcutsOptions {
  onTagLatest: () => void;
  tagPalette?: TagOption[];
  /** Ctrl+1…Ctrl+9: palette index (0-based). Caller may focus, attach, or both. */
  onFocusTagByIndex?: (index: number) => void;
}

export function useTaggingShortcuts({
  onTagLatest,
  tagPalette,
  onFocusTagByIndex,
}: UseTaggingShortcutsOptions) {
  const handleTagLatest = useEffectEvent(onTagLatest);
  const handleFocusByIndex = useEffectEvent((index: number) => {
    onFocusTagByIndex?.(index);
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.getAttribute("contenteditable") === "true";

      if (isTyping) {
        return;
      }

      if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return;
      }

      const keyLower = event.key.toLowerCase();

      if (keyLower === "t") {
        event.preventDefault();
        handleTagLatest();
        return;
      }

      if (/^[1-9]$/.test(event.key) && tagPalette && tagPalette.length > 0 && onFocusTagByIndex) {
        const idx = indexForPaletteDigit(tagPalette, event.key);
        if (idx >= 0) {
          event.preventDefault();
          handleFocusByIndex(idx);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleTagLatest, handleFocusByIndex, tagPalette]);
}
