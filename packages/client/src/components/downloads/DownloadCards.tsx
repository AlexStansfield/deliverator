import { ArrowDown, ArrowUp } from "lucide-react";
import { formatBytes, formatEta, formatRelative, formatSpeed, type Download, type ProviderSummary } from "@deliverator/shared";
import { cn } from "@/lib/cn";
import type { DownloadAction } from "@/lib/actions";
import { ProgressBar, ProviderTag, StatusPill } from "./bits";
import { RowActions, availableActions } from "./RowActions";
import { DownloadDetails } from "./DownloadDetails";

interface Props {
  downloads: Download[];
  providers: Map<string, ProviderSummary>;
  expanded: string | null;
  onExpanded: (id: string | null) => void;
  onAction: (ids: string[], action: DownloadAction, extra?: { category?: string }) => void;
  now: number;
}

/** Phone layout: one card per download, tap to expand details. */
export function DownloadCards({ downloads, providers, expanded, onExpanded, onAction, now }: Props) {
  return (
    <div className="grid min-w-0 gap-2.5">
      {downloads.map((d) => {
        const provider = providers.get(d.providerId);
        const open = expanded === d.id;
        const pct = Math.floor(d.progress * 100);
        return (
          <div key={d.id} data-open={open} className={cn("group grid min-w-0 gap-2 rounded-xl border border-line bg-panel p-3", open && "border-muted")}>
            <button className="flex w-full min-w-0 items-center gap-2 text-left" onClick={() => onExpanded(open ? null : d.id)}>
              {provider ? <ProviderTag type={provider.type} /> : null}
              <span className="min-w-0 flex-1 truncate font-semibold">{d.name}</span>
              <StatusPill state={d.state} />
            </button>
            <ProgressBar value={d.state === "queued" ? 0 : d.progress} state={d.state} animated={d.state === "downloading" && d.downloadSpeed > 0} />
            <div className={cn("flex justify-between gap-2 font-mono text-[11.5px] text-muted tnum", d.error && "text-bad")}>
              <span className="truncate">{d.error ? d.error : d.state === "queued" ? "Queued" : `${pct}% · ${formatBytes(d.downloaded)} / ${formatBytes(d.size)}`}</span>
              <span className="shrink-0">{d.eta !== null ? formatEta(d.eta) : formatRelative(d.addedAt ?? d.completedAt, now)}</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[12px] tnum">
              {d.downloadSpeed > 0 ? (
                <span className="inline-flex items-center gap-1 text-down">
                  <ArrowDown className="size-3" />
                  {formatSpeed(d.downloadSpeed)}
                </span>
              ) : null}
              {d.uploadSpeed > 0 ? (
                <span className="inline-flex items-center gap-1 text-up">
                  <ArrowUp className="size-3" />
                  {formatSpeed(d.uploadSpeed)}
                </span>
              ) : null}
              {d.torrent && d.state === "seeding" ? <span className="text-muted">ratio {d.torrent.ratio.toFixed(2)}</span> : null}
              <RowActions className="ml-auto" alwaysVisible size={16} actions={availableActions(d, provider)} onAction={(a) => onAction([d.id], a)} />
            </div>
            {open ? (
              <div className="border-t border-line pt-3">
                <DownloadDetails download={d} provider={provider} onAction={(a, extra) => onAction([d.id], a, extra)} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
