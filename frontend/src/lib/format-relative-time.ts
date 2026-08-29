/** e.g. "4 mins ago", "2 days ago" */
export function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";

  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 45) return "Just now";

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? "" : "s"} ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;

  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;

  const week = Math.floor(day / 7);
  if (week < 5) return `${week} week${week === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

/** Compact for list right column: "2hrs", "4mins", "1d" */
export function formatRelativeTimeShort(dateStr?: string): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";

  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 45) return "now";

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min${min === 1 ? "" : "s"}`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}hr${hr === 1 ? "" : "s"}`;

  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;

  const week = Math.floor(day / 7);
  if (week < 5) return `${week}w`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
