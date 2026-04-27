import { useSyncExternalStore } from "react";

/**
 * True when this browsing context is not the active, visible tab (or is prerender).
 * Uses Page Visibility + `pageshow` (bfcache). Does not use `document.hasFocus()` — that is
 * often false on first paint and would flash the float on load.
 *
 * For “another OS window has focus but this tab still looks selected”, most browsers still
 * transition `visibilityState` to `hidden` when the browser loses foreground; if not, use
 * Document PiP (`FloatingPulseHud` “Always on top” action).
 */
function subscribe(onStoreChange: () => void) {
  const doc = document;
  const run = () => onStoreChange();
  doc.addEventListener("visibilitychange", run);
  window.addEventListener("pageshow", run);
  return () => {
    doc.removeEventListener("visibilitychange", run);
    window.removeEventListener("pageshow", run);
  };
}

function getSnapshot(): boolean {
  return docIsBackgrounded();
}

function getServerSnapshot(): boolean {
  return false;
}

export function docIsBackgrounded(): boolean {
  if (typeof document === "undefined") return false;
  if (document.visibilityState === "hidden") return true;
  if (document.hidden === true) return true;
  if ((document.visibilityState as string) === "prerender") return true;
  return false;
}

export function useTabBackgrounded(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
