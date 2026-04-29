
let claimCount = 0;

export function claimFloatingHudTagDigitShortcuts(): void {
  claimCount += 1;
}

export function releaseFloatingHudTagDigitShortcuts(): void {
  claimCount = Math.max(0, claimCount - 1);
}

export function floatingHudOwnsTagDigitShortcuts(): boolean {
  return claimCount > 0;
}
