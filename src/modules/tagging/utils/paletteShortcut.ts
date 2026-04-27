import type { TagOption } from "@/modules/tagging/types";

export function paletteDigitForTag(tag: TagOption, index: number): string | null {
  return tag.shortcutDigit ?? (index < 9 ? String(index + 1) : null);
}

export function indexForPaletteDigit(palette: TagOption[], digit: string): number {
  return palette.findIndex((tag, i) => paletteDigitForTag(tag, i) === digit);
}

export function formatCtrlShortcut(key: string) {
  const k = key.length === 1 ? key.toUpperCase() : key;
  return `Ctrl+${k}`;
}
