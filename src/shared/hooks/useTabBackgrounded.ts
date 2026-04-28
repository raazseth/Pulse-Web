import { useSyncExternalStore } from "react";

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
