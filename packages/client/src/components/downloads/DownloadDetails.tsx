import { useQuery } from "@tanstack/react-query";
import { formatBytes, formatEta, type Download, type DownloadFile, type ProviderSummary } from "@deliverator/shared";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { NativeSelect } from "@/components/ui/Input";
import type { DownloadAction } from "@/lib/actions";
import { availableActions } from "./RowActions";
import { BAR_TONE } from "./bits";
import { cn } from "@/lib/cn";

function fmtDate(ms: number | null) {
  return ms ? new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function fmtDuration(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function DownloadDetails({
  download: d,
  provider,
  onAction,
}: {
  download: Download;
  provider: ProviderSummary | undefined;
  onAction: (a: DownloadAction, extra?: { category?: string }) => void;
}) {
  const files = useQuery({
    queryKey: ["files", d.id],
    queryFn: () => api<{ files: DownloadFile[] }>(`/downloads/${encodeURIComponent(d.id)}/files`),
    staleTime: 10_000,
    refetchInterval: d.state === "downloading" ? 5000 : false,
  });
  const actions = availableActions(d, provider);
  const labels: Record<DownloadAction, string> = { pause: "Pause", resume: "Resume", retry: "Retry", top: "Move to top", bottom: "Move to bottom", delete: "Delete…", setCategory: "Set category" };
  const rows: [string, string][] = [
    ["Provider", provider?.name ?? d.providerId],
    ["Category", d.category ?? "—"],
    ["Save path", d.savePath ?? "—"],
    ["Size", formatBytes(d.size)],
    ["Added", fmtDate(d.addedAt)],
    ["Completed", fmtDate(d.completedAt)],
  ];
  if (d.torrent) rows.push(["Ratio", d.torrent.ratio.toFixed(2)], ["Seeding time", fmtDuration(d.torrent.seedingTime)], ["Peers", `${d.torrent.seeds} seeds · ${d.torrent.peers} peers`]);
  if (d.usenet?.stage) rows.push(["Stage", d.usenet.stage]);
  if (d.eta !== null) rows.push(["ETA", formatEta(d.eta)]);
  if (d.error) rows.push(["Error", d.error]);

  return (
    <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
      <div>
        <h4 className="label-caps mb-2">Details</h4>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className={cn("min-w-0 [overflow-wrap:anywhere] font-mono text-[12px]", k === "Error" && "text-bad")}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="min-w-0">
        <h4 className="label-caps mb-2">Files{files.data ? ` · ${files.data.files.length}` : ""}</h4>
        {files.isLoading ? (
          <p className="text-[12.5px] text-muted">Loading…</p>
        ) : files.isError ? (
          <p className="text-[12.5px] text-bad">{files.error instanceof Error ? files.error.message : "Could not load files"}</p>
        ) : files.data && files.data.files.length > 0 ? (
          <div className="grid max-h-[260px] gap-1.5 overflow-y-auto pr-1">
            {files.data.files.map((f) => (
              <div key={f.name} className="grid grid-cols-[minmax(0,1fr)_80px_72px] items-center gap-2.5 text-[12.5px]">
                <span className="truncate" title={f.name}>
                  {f.name}
                </span>
                <span className="h-1 rounded-sm bg-track">
                  <span className={cn("block h-full rounded-sm", f.progress >= 1 ? "bg-ok" : BAR_TONE[d.state])} style={{ width: `${f.progress * 100}%` }} />
                </span>
                <span className="text-right font-mono text-[12px] text-muted tnum">{formatBytes(f.size)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] text-muted">No file list available.</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 md:col-span-2">
        {actions.map((a) => (
          <Button key={a} size="sm" variant={a === "delete" ? "danger" : "default"} onClick={() => onAction(a)}>
            {labels[a]}
          </Button>
        ))}
        {provider?.capabilities.categories && provider.categories.length > 0 ? (
          <NativeSelect
            aria-label="Set category"
            className="w-[180px] py-1 text-[12.5px] sm:ml-auto"
            value={d.category ?? ""}
            onChange={(e) => onAction("setCategory", { category: e.target.value })}
          >
            <option value="">No category</option>
            {provider.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        ) : null}
      </div>
    </div>
  );
}
