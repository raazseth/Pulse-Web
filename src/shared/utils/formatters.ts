const clockFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function formatClock(timestamp: string): string {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "--:--:--";
  return clockFormatter.format(date);
}
