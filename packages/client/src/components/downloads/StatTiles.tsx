import { formatBytes, formatSpeed, type Download } from "@deliverator/shared";
import { cn } from "@/lib/cn";

function Tile({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: string }) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-[10px] border border-line bg-panel px-3.5 py-2.5">
      <span className="label-caps">{label}</span>
      <span className={cn("flex items-baseline gap-2 text-[22px] font-extrabold tracking-tight tnum", tone)}>
        {value}
        {sub ? <small className="font-mono text-[12px] font-semibold text-muted">{sub}</small> : null}
      </span>
    </div>
  );
}

export function StatTiles({ downloads, totalDown, totalUp }: { downloads: Download[]; totalDown: number; totalUp: number }) {
  const downloading = downloads.filter((d) => d.state === "downloading");
  const queued = downloads.filter((d) => d.state === "queued");
  const processing = downloads.filter((d) => d.state === "repairing" || d.state === "extracting" || d.state === "checking");
  const seeding = downloads.filter((d) => d.state === "seeding");
  const failed = downloads.filter((d) => d.state === "failed");
  const queuedBytes = queued.reduce((s, d) => s + Math.max(0, d.size - d.downloaded), 0);
  return (
    <section className="grid min-w-0 grid-cols-2 gap-2.5 lg:grid-cols-4" aria-label="Summary">
      <Tile label="Downloading" value={downloading.length} sub={formatSpeed(totalDown)} />
      <Tile label="Queued" value={queued.length + processing.length} sub={queuedBytes > 0 ? `${formatBytes(queuedBytes)} left` : processing.length > 0 ? "processing" : undefined} />
      <Tile label="Seeding" value={seeding.length} sub={totalUp > 0 ? formatSpeed(totalUp) : undefined} />
      <Tile label="Needs attention" value={failed.length} sub={failed.length > 0 ? "failed" : "all good"} tone={failed.length > 0 ? "text-bad" : undefined} />
    </section>
  );
}
