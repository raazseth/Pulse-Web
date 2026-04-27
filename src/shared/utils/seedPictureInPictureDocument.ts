export function seedPictureInPictureDocument(source: Document, target: Document): void {
  const head = target.head;
  const hrefSeen = new Set<string>();

  source.head.querySelectorAll('link[rel="stylesheet"]').forEach((node) => {
    const href = (node as HTMLLinkElement).href;
    if (!href || hrefSeen.has(href)) return;
    hrefSeen.add(href);
    const link = target.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    const crossOrigin = (node as HTMLLinkElement).crossOrigin;
    if (crossOrigin) link.crossOrigin = crossOrigin;
    head.append(link);
  });

  source.head.querySelectorAll("style").forEach((node) => {
    const text = node.textContent;
    if (!text?.trim()) return;
    const style = target.createElement("style");
    style.textContent = text;
    head.append(style);
  });
}
