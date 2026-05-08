export function fmtBytes(bytes: number): string {
  const KB = 1024, MB = KB * 1024, GB = MB * 1024;
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function fmtUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

export function pctColor(pct: number): string {
  if (pct >= 85) return "text-red-400";
  if (pct >= 60) return "text-amber-400";
  return "text-emerald-400";
}

export function barColor(pct: number): string {
  if (pct >= 85) return "bg-red-500";
  if (pct >= 60) return "bg-amber-400";
  return "bg-brand-400";
}

export function healthColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-400";
  return "bg-red-500";
}

export function healthLabel(pct: number): string {
  if (pct >= 80) return "Good";
  if (pct >= 50) return "Fair — consider replacing soon";
  return "Poor — replace battery";
}
