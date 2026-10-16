import type { DownloadState, ProviderType } from "@deliverator/shared";
import { cn } from "@/lib/cn";

export const STATE_LABEL: Record<DownloadState, string> = {
  downloading: "Downloading",
  queued: "Queued",
  paused: "Paused",
  checking: "Checking",
  repairing: "Repairing",
  extracting: "Extracting",
  seeding: "Seeding",
  completed: "Completed",
  failed: "Failed",
};

const STATE_TONE: Record<DownloadState, string> = {
  downloading: "text-down border-down/35 bg-down/10",
  queued: "text-muted border-line bg-panel-2",
  paused: "text-muted border-line bg-panel-2",
  checking: "text-warn border-warn/35 bg-warn/10",
  repairing: "text-warn border-warn/35 bg-warn/10",
  extracting: "text-warn border-warn/35 bg-warn/10",
  seeding: "text-up border-up/35 bg-up/10",
  completed: "text-ok border-ok/35 bg-ok/10",
  failed: "text-bad border-bad/35 bg-bad/10",
};

export const BAR_TONE: Record<DownloadState, string> = {
  downloading: "bg-down",
  queued: "bg-faint",
  paused: "bg-faint",
  checking: "bg-warn",
  repairing: "bg-warn",
  extracting: "bg-warn",
  seeding: "bg-up",
  completed: "bg-ok",
  failed: "bg-bad",
};

export function StatusPill({ state, label }: { state: DownloadState; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-bold", STATE_TONE[state])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label ?? STATE_LABEL[state]}
    </span>
  );
}

const PROVIDER_TAG: Record<ProviderType, { short: string; tone: string }> = {
  qbittorrent: { short: "qB", tone: "text-down border-down/35 bg-down/10" },
  sabnzbd: { short: "SAB", tone: "text-warn border-warn/35 bg-warn/10" },
};

export function ProviderTag({ type, title }: { type: ProviderType; title?: string }) {
  const t = PROVIDER_TAG[type];
  return (
    <span title={title} className={cn("inline-flex h-[18px] items-center rounded-[5px] border px-1.5 font-mono text-[10.5px] font-semibold tracking-wide", t.tone)}>
      {t.short}
    </span>
  );
}

export function ProgressBar({ value, state, animated }: { value: number; state: DownloadState; animated?: boolean }) {
  return (
    <div className="h-[5px] w-full overflow-hidden rounded-[3px] bg-track">
      <div
        className={cn("h-full rounded-[3px] transition-[width] duration-700", BAR_TONE[state], animated && "progress-shimmer")}
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

export function Dot({ ok }: { ok: boolean }) {
  return <span className={cn("inline-block size-2 rounded-full", ok ? "bg-ok shadow-[0_0_0_3px_color-mix(in_srgb,var(--ok)_20%,transparent)]" : "bg-bad shadow-[0_0_0_3px_color-mix(in_srgb,var(--bad)_20%,transparent)]")} aria-hidden="true" />;
}
