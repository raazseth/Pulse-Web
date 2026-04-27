import { describe, it, expect } from "vitest";
import { formatCtrlShortcut, indexForPaletteDigit, paletteDigitForTag } from "./paletteShortcut";
import type { TagOption } from "@/modules/tagging/types";

const sample: TagOption[] = [
  { id: "a", label: "A", color: "primary", shortcutDigit: "7" },
  { id: "b", label: "B", color: "secondary" },
];

describe("paletteShortcut", () => {
  it("paletteDigitForTag uses shortcutDigit when set", () => {
    expect(paletteDigitForTag(sample[0], 0)).toBe("7");
  });

  it("paletteDigitForTag falls back to 1-based index", () => {
    expect(paletteDigitForTag(sample[1], 1)).toBe("2");
  });

  it("indexForPaletteDigit resolves by displayed digit", () => {
    expect(indexForPaletteDigit(sample, "7")).toBe(0);
    expect(indexForPaletteDigit(sample, "2")).toBe(1);
  });

  it("formatCtrlShortcut uppercases single letter", () => {
    expect(formatCtrlShortcut("t")).toBe("Ctrl+T");
    expect(formatCtrlShortcut("1")).toBe("Ctrl+1");
  });
});
