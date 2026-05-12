export function formatRelativeRo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "acum câteva secunde";
  if (diffMin < 60) return `acum ${diffMin} ${diffMin === 1 ? "minut" : "minute"}`;
  if (diffHours < 24) return `acum ${diffHours} ${diffHours === 1 ? "oră" : "ore"}`;
  if (diffDays < 7) return `acum ${diffDays} ${diffDays === 1 ? "zi" : "zile"}`;

  return (
    "pe " +
    d.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })
  );
}

export function formatAbsoluteRo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return (
    d.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })
  );
}
