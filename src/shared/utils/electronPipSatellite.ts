export function hasPipQuery(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).has("pip")) return true;
  const hash = window.location.hash;
  if (!hash.includes("?")) return false;
  return new URLSearchParams(hash.slice(hash.indexOf("?"))).has("pip");
}

export function isElectronPipSatellite(): boolean {
  return typeof window !== "undefined" && "api" in window && hasPipQuery();
}
