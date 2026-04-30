const LEGACY_SESSION_KEY = "pulse-hud-session";
const SESSION_PREFIX = "pulse-hud-session:";
const LAST_SESSION_PREFIX = "pulse-hud-last-session:";

export function clearHudLocalStorageForUser(userId: string | undefined): void {
  try {
    localStorage.removeItem(LEGACY_SESSION_KEY);
    const uid = userId?.trim();
    if (uid) {
      localStorage.removeItem(`${SESSION_PREFIX}${uid}`);
      localStorage.removeItem(`${LAST_SESSION_PREFIX}${uid}`);
    }
  } catch {
    /* noop */
  }
}
