const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

/** Human size, decimal units (matches what most clients show). */
export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const i = Math.min(UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1000)));
  const v = bytes / 1000 ** i;
  return `${v.toFixed(i === 0 ? 0 : digits)} ${UNITS[i]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "0 B/s";
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds > 100 * 24 * 3600) return "∞";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

export function formatRelative(ms: number | null, now = Date.now()): string {
  if (ms === null) return "—";
  const diff = Math.max(0, now - ms);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}

/** Parse "5 MB/s", "500k", "2mb" into bytes/second; returns null when unparseable. */
export function parseSpeed(input: string): number | null {
  const m = input.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([kmgt]?)(?:i?b)?(?:\/s)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const mult = { "": 1, k: 1000, m: 1000 ** 2, g: 1000 ** 3, t: 1000 ** 4 }[m[2] ?? ""] ?? 1;
  return Math.round(n * mult);
}
